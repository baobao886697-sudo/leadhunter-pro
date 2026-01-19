import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and, gte, lte, desc, sql, or, like, inArray, isNull, gt, lt, ne, asc, SQL, count } from 'drizzle-orm';
import * as crypto from 'crypto';
import {
  users, User, InsertUser,
  systemConfigs, SystemConfig,
  rechargeOrders, RechargeOrder,
  searchTasks, SearchTask,
  searchResults, SearchResult,
  globalCache, GlobalCache,
  creditLogs, CreditLog,
  adminLogs, AdminLog,
  userMessages, UserMessage,
  apiLogs, ApiLog,
  apiStats, ApiStat,
  errorLogs, ErrorLog,
  searchLogs, SearchLog,
  loginLogs, LoginLog,
  userActivityLogs, UserActivityLog,
  announcements, Announcement
} from '../drizzle/schema';

let db: MySql2Database | null = null;
let pool: mysql.Pool | null = null;

export async function getDb(): Promise<MySql2Database | null> {
  if (db) return db;
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    return null;
  }
  
  try {
    pool = mysql.createPool({
      uri: databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    
    db = drizzle(pool);
    console.log('Database connected successfully');
    return db;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    return null;
  }
}

// 获取原始连接池用于原生 SQL
export async function getPool(): Promise<mysql.Pool | null> {
  if (pool) return pool;
  await getDb();
  return pool;
}

// ============ 配置缓存 ============
const configCache = new Map<string, { value: string; expiry: number }>();
const CONFIG_CACHE_TTL = 60 * 1000; // 1分钟缓存

export async function getConfig(key: string): Promise<string | null> {
  // 检查缓存
  const cached = configCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }
  
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(systemConfigs).where(eq(systemConfigs.key, key)).limit(1);
  if (result.length > 0) {
    configCache.set(key, { value: result[0].value, expiry: Date.now() + CONFIG_CACHE_TTL });
    return result[0].value;
  }
  return null;
}

export async function setConfig(key: string, value: string, description?: string, updatedBy?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(systemConfigs).values({ key, value, description, updatedBy })
    .onDuplicateKeyUpdate({ set: { value, description, updatedBy } });
  configCache.set(key, { value, expiry: Date.now() + CONFIG_CACHE_TTL });
}

export async function getAllConfigs(): Promise<SystemConfig[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemConfigs);
}

export async function deleteConfig(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(systemConfigs).where(eq(systemConfigs.key, key));
  configCache.delete(key);
}

// ============ 用户相关 ============

export async function createUser(openId: string, email: string, passwordHash: string, name?: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(users).values({ openId, email, passwordHash, name });
  return getUserByEmail(email);
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, updates: Partial<User>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(updates).where(eq(users.id, id));
}

export async function getAllUsers(page: number = 1, limit: number = 20): Promise<{ users: User[]; total: number }> {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
  return { users: result, total: countResult[0]?.count || 0 };
}

export async function addCredits(userId: number, amount: number, type: string, description: string, referenceId?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // 更新用户积分
  await db.update(users).set({ credits: sql`credits + ${amount}` }).where(eq(users.id, userId));
  
  // 获取更新后的余额
  const user = await getUserById(userId);
  const balanceAfter = user?.credits || 0;
  
  // 记录积分变动
  await db.insert(creditLogs).values({
    userId,
    amount,
    type,
    description,
    referenceId,
    balanceAfter
  });
}

export async function deductCredits(userId: number, amount: number, type: string, description: string, referenceId?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const user = await getUserById(userId);
  if (!user || user.credits < amount) return false;
  
  await db.update(users).set({ credits: sql`credits - ${amount}` }).where(eq(users.id, userId));
  
  const updatedUser = await getUserById(userId);
  const balanceAfter = updatedUser?.credits || 0;
  
  await db.insert(creditLogs).values({
    userId,
    amount: -amount,
    type,
    description,
    referenceId,
    balanceAfter
  });
  
  return true;
}

export async function getUserCreditLogs(userId: number, page: number = 1, limit: number = 20): Promise<{ logs: CreditLog[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(creditLogs).where(eq(creditLogs.userId, userId)).orderBy(desc(creditLogs.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(creditLogs).where(eq(creditLogs.userId, userId));
  return { logs: result, total: countResult[0]?.count || 0 };
}

// ============ 充值订单相关 ============

export async function createRechargeOrder(userId: number, credits: number, amount: string, walletAddress: string, network: string = "TRC20"): Promise<RechargeOrder | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const orderId = crypto.randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.insert(rechargeOrders).values({ orderId, userId, credits, amount, walletAddress, network, expiresAt });
  return getRechargeOrder(orderId);
}

// 创建带唯一尾数的充值订单
export async function createRechargeOrderWithUniqueAmount(userId: number, credits: number, baseAmount: number, walletAddress: string, network: string = "TRC20"): Promise<RechargeOrder | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  // 获取所有活跃订单的尾数
  const activeOrders = await getPendingOrders();
  const usedDecimals = new Set(
    activeOrders
      .filter(o => Math.floor(parseFloat(o.amount)) === Math.floor(baseAmount))
      .map(o => Math.round((parseFloat(o.amount) % 1) * 100))
  );
  
  // 生成未使用的尾数 (01-99)
  let decimal = 1;
  for (let i = 1; i <= 99; i++) {
    if (!usedDecimals.has(i)) {
      decimal = i;
      break;
    }
  }
  
  const uniqueAmount = (baseAmount + decimal / 100).toFixed(2);
  const orderId = crypto.randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  
  await db.insert(rechargeOrders).values({ orderId, userId, credits, amount: uniqueAmount, walletAddress, network, expiresAt });
  return getRechargeOrder(orderId);
}

export async function getRechargeOrder(orderId: string): Promise<RechargeOrder | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(rechargeOrders).where(eq(rechargeOrders.orderId, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserRechargeOrders(userId: number, page: number = 1, limit: number = 20): Promise<{ orders: RechargeOrder[]; total: number }> {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(rechargeOrders).where(eq(rechargeOrders.userId, userId)).orderBy(desc(rechargeOrders.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(rechargeOrders).where(eq(rechargeOrders.userId, userId));
  return { orders: result, total: countResult[0]?.count || 0 };
}

export async function getPendingOrders(): Promise<RechargeOrder[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rechargeOrders).where(and(eq(rechargeOrders.status, "pending"), gte(rechargeOrders.expiresAt, new Date())));
}

export async function confirmRechargeOrder(orderId: string, txId: string, receivedAmount?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const order = await getRechargeOrder(orderId);
  if (!order || order.status !== "pending") return false;
  await db.update(rechargeOrders).set({ status: "paid", txId, receivedAmount, paidAt: new Date() }).where(eq(rechargeOrders.orderId, orderId));
  await addCredits(order.userId, order.credits, "recharge", `充值订单 ${orderId}`, orderId);
  return true;
}

export async function getAllRechargeOrders(page: number = 1, limit: number = 20, status?: string): Promise<{ orders: RechargeOrder[]; total: number }> {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  const offset = (page - 1) * limit;
  let query = db.select().from(rechargeOrders);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(rechargeOrders);
  if (status) {
    query = query.where(eq(rechargeOrders.status, status as any)) as typeof query;
    countQuery = countQuery.where(eq(rechargeOrders.status, status as any)) as typeof countQuery;
  }
  const result = await query.orderBy(desc(rechargeOrders.createdAt)).limit(limit).offset(offset);
  const countResult = await countQuery;
  return { orders: result, total: countResult[0]?.count || 0 };
}

// 更新订单状态
export async function updateRechargeOrderStatus(orderId: string, status: "pending" | "paid" | "cancelled" | "expired" | "mismatch", adminNote?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const order = await getRechargeOrder(orderId);
  if (!order) return false;
  
  const updates: any = { status };
  if (adminNote) updates.adminNote = adminNote;
  if (status === "paid") updates.paidAt = new Date();
  
  await db.update(rechargeOrders).set(updates).where(eq(rechargeOrders.orderId, orderId));
  
  // 如果是确认支付，添加积分
  if (status === "paid" && order.status !== "paid") {
    await addCredits(order.userId, order.credits, "recharge", `充值订单 ${orderId} (管理员确认)`, orderId);
  }
  
  return true;
}

// ============ 搜索任务相关 ============

export async function createSearchTask(userId: number, params: any, requestedCount: number): Promise<SearchTask | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const taskId = crypto.randomBytes(8).toString('hex');
  const searchHash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
  await db.insert(searchTasks).values({ taskId, userId, searchHash, params, requestedCount });
  return getSearchTask(taskId);
}

export async function getSearchTask(taskId: string): Promise<SearchTask | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(searchTasks).where(eq(searchTasks.taskId, taskId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 使用完全原生 SQL 的 updateSearchTask 函数
export async function updateSearchTask(taskId: string, updates: Partial<SearchTask>): Promise<void> {
  const pool = await getPool();
  if (!pool) {
    console.error('[DB] updateSearchTask: Database pool not available');
    return;
  }
  
  // 构建 SET 子句
  const setClauses: string[] = [];
  const values: any[] = [];
  
  // 处理 logs 字段，截断过长的日志
  if (updates.logs && Array.isArray(updates.logs)) {
    if (updates.logs.length > 100) {
      updates.logs = updates.logs.slice(-100);
    }
  }
  
  // 遍历所有更新字段
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    
    // 跳过不应该更新的字段
    if (key === 'id' || key === 'taskId' || key === 'createdAt') continue;
    
    if (key === 'logs' || key === 'params') {
      // JSON 字段
      setClauses.push(`\`${key}\` = ?`);
      values.push(JSON.stringify(value));
    } else if (value instanceof Date) {
      setClauses.push(`\`${key}\` = ?`);
      values.push(value);
    } else if (value === null) {
      setClauses.push(`\`${key}\` = NULL`);
    } else {
      setClauses.push(`\`${key}\` = ?`);
      values.push(value);
    }
  }
  
  if (setClauses.length === 0) {
    console.warn('[DB] updateSearchTask: No fields to update');
    return;
  }
  
  // 添加 taskId 到 values
  values.push(taskId);
  
  const sqlQuery = `UPDATE search_tasks SET ${setClauses.join(', ')} WHERE taskId = ?`;
  
  // 重试机制
  const maxRetries = 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.execute(sqlQuery, values);
      return; // 成功则返回
    } catch (error: any) {
      lastError = error;
      console.error(`[DB] updateSearchTask attempt ${attempt}/${maxRetries} failed:`, error.message);
      console.error(`[DB] SQL: ${sqlQuery}`);
      console.error(`[DB] Values: ${JSON.stringify(values).substring(0, 500)}`);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
  }
  
  console.error('[DB] updateSearchTask failed after all retries:', lastError?.message);
}

export async function updateSearchTaskStatus(taskId: string, status: string): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.execute('UPDATE search_tasks SET status = ? WHERE taskId = ?', [status, taskId]);
}

export async function getUserSearchTasks(userId: number, page: number = 1, limit: number = 20): Promise<{ tasks: SearchTask[]; total: number }> {
  const db = await getDb();
  if (!db) return { tasks: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(searchTasks).where(eq(searchTasks.userId, userId)).orderBy(desc(searchTasks.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(searchTasks).where(eq(searchTasks.userId, userId));
  return { tasks: result, total: countResult[0]?.count || 0 };
}

// ============ 搜索结果相关 ============

export async function saveSearchResult(taskId: number, apolloId: string, data: any, verified: boolean = false, verificationScore?: number, verificationDetails?: any): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(searchResults).values({ taskId, apolloId, data, verified, verificationScore, verificationDetails });
}

export async function getSearchResults(taskId: number): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(searchResults).where(eq(searchResults.taskId, taskId)).orderBy(desc(searchResults.createdAt));
}

export async function updateSearchResult(resultId: number, updates: Partial<{ data: any; verified: boolean; verificationScore: number; verificationDetails: any }>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(searchResults).set(updates).where(eq(searchResults.id, resultId));
}

export async function updateSearchResultByApolloId(taskId: string, apolloId: string, dataUpdates: Record<string, any>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // 先获取任务ID
  const task = await getSearchTask(taskId);
  if (!task) return;
  
  // 查找对应的搜索结果
  const results = await db.select().from(searchResults).where(
    and(
      eq(searchResults.taskId, task.id),
      eq(searchResults.apolloId, apolloId)
    )
  ).limit(1);
  
  if (results.length === 0) return;
  
  const result = results[0];
  const currentData = result.data as Record<string, any>;
  const newData = { ...currentData, ...dataUpdates };
  
  await db.update(searchResults).set({ data: newData }).where(eq(searchResults.id, result.id));
}

// ============ 全局缓存相关 ============

export async function getCachedPerson(apolloId: string): Promise<GlobalCache | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(globalCache).where(
    and(
      eq(globalCache.apolloId, apolloId),
      gte(globalCache.expiresAt, new Date())
    )
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function cachePerson(apolloId: string, data: any, phone?: string, phoneVerified?: boolean, verificationScore?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 180天
  await db.insert(globalCache).values({ apolloId, data, phone, phoneVerified, verificationScore, expiresAt })
    .onDuplicateKeyUpdate({ set: { data, phone, phoneVerified, verificationScore, expiresAt } });
}

export async function updateCachedPersonPhone(apolloId: string, phone: string, verified: boolean, score?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(globalCache).set({ phone, phoneVerified: verified, verificationScore: score }).where(eq(globalCache.apolloId, apolloId));
}

// ============ 管理员日志相关 ============

export async function logAdminAction(adminId: number, action: string, targetType: string, targetId: string, details?: any): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminLogs).values({ adminId, action, targetType, targetId, details });
}

export async function getAdminLogs(page: number = 1, limit: number = 50): Promise<{ logs: AdminLog[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(adminLogs);
  return { logs: result, total: countResult[0]?.count || 0 };
}

// ============ 用户消息相关 ============

export async function createUserMessage(userId: number, type: string, title: string, content: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userMessages).values({ userId, type, title, content });
}

export async function getUserMessages(userId: number, page: number = 1, limit: number = 20): Promise<{ messages: UserMessage[]; total: number; unread: number }> {
  const db = await getDb();
  if (!db) return { messages: [], total: 0, unread: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(userMessages).where(eq(userMessages.userId, userId)).orderBy(desc(userMessages.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(userMessages).where(eq(userMessages.userId, userId));
  const unreadResult = await db.select({ count: sql<number>`count(*)` }).from(userMessages).where(and(eq(userMessages.userId, userId), eq(userMessages.read, false)));
  return { messages: result, total: countResult[0]?.count || 0, unread: unreadResult[0]?.count || 0 };
}

export async function markMessageAsRead(messageId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(userMessages).set({ read: true }).where(eq(userMessages.id, messageId));
}

export async function markAllMessagesAsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(userMessages).set({ read: true }).where(eq(userMessages.userId, userId));
}

// ============ API日志相关 ============

export async function logApiCall(service: string, endpoint: string, success: boolean, responseTime: number, errorMessage?: string, userId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(apiLogs).values({ service, endpoint, success, responseTime, errorMessage, userId });
  
  // 更新统计
  const today = new Date().toISOString().split('T')[0];
  const existingStat = await db.select().from(apiStats).where(
    and(eq(apiStats.service, service), eq(apiStats.date, today))
  ).limit(1);
  
  if (existingStat.length > 0) {
    await db.update(apiStats).set({
      totalCalls: sql`totalCalls + 1`,
      successCalls: success ? sql`successCalls + 1` : sql`successCalls`,
      failedCalls: success ? sql`failedCalls` : sql`failedCalls + 1`,
      avgResponseTime: sql`(avgResponseTime * totalCalls + ${responseTime}) / (totalCalls + 1)`
    }).where(eq(apiStats.id, existingStat[0].id));
  } else {
    await db.insert(apiStats).values({
      service,
      date: today,
      totalCalls: 1,
      successCalls: success ? 1 : 0,
      failedCalls: success ? 0 : 1,
      avgResponseTime: responseTime
    });
  }
}

export async function getApiStats(days: number = 7): Promise<ApiStat[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return db.select().from(apiStats).where(gte(apiStats.date, startDate)).orderBy(desc(apiStats.date));
}

// ============ 错误日志相关 ============

export async function logError(errorType: string, message: string, stack?: string, context?: any, userId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(errorLogs).values({ errorType, message, stack, context, userId });
}

export async function getErrorLogs(page: number = 1, limit: number = 50): Promise<{ logs: ErrorLog[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(errorLogs);
  return { logs: result, total: countResult[0]?.count || 0 };
}

// ============ 搜索日志相关 ============

export async function logSearch(taskId: string, userId: number, params: any, status: string, resultsCount?: number, creditsUsed?: number, duration?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(searchLogs).values({ taskId, userId, params, status, resultsCount, creditsUsed, duration });
}

export async function getSearchLogs(page: number = 1, limit: number = 50): Promise<{ logs: SearchLog[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(searchLogs).orderBy(desc(searchLogs.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(searchLogs);
  return { logs: result, total: countResult[0]?.count || 0 };
}

// ============ 登录日志相关 ============

export async function logLogin(userId: number, ip: string, userAgent: string, success: boolean, failReason?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(loginLogs).values({ userId, ip, userAgent, success, failReason });
}

export async function getLoginLogs(userId?: number, page: number = 1, limit: number = 50): Promise<{ logs: LoginLog[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const offset = (page - 1) * limit;
  let query = db.select().from(loginLogs);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(loginLogs);
  if (userId) {
    query = query.where(eq(loginLogs.userId, userId)) as typeof query;
    countQuery = countQuery.where(eq(loginLogs.userId, userId)) as typeof countQuery;
  }
  const result = await query.orderBy(desc(loginLogs.createdAt)).limit(limit).offset(offset);
  const countResult = await countQuery;
  return { logs: result, total: countResult[0]?.count || 0 };
}

// ============ 用户活动日志相关 ============

export async function logUserActivity(userId: number, action: string, details?: any, ip?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userActivityLogs).values({ userId, action, details, ip });
}

export async function getUserActivityLogs(userId: number, page: number = 1, limit: number = 50): Promise<{ logs: UserActivityLog[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(userActivityLogs).where(eq(userActivityLogs.userId, userId)).orderBy(desc(userActivityLogs.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(userActivityLogs).where(eq(userActivityLogs.userId, userId));
  return { logs: result, total: countResult[0]?.count || 0 };
}

// ============ 公告相关 ============

export async function createAnnouncement(title: string, content: string, type: string = "info", priority: number = 0, expiresAt?: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(announcements).values({ title, content, type, priority, active: true, expiresAt });
}

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(announcements).where(
    and(
      eq(announcements.active, true),
      or(
        isNull(announcements.expiresAt),
        gte(announcements.expiresAt, new Date())
      )
    )
  ).orderBy(desc(announcements.priority), desc(announcements.createdAt));
}

export async function getAllAnnouncements(page: number = 1, limit: number = 20): Promise<{ announcements: Announcement[]; total: number }> {
  const db = await getDb();
  if (!db) return { announcements: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(announcements);
  return { announcements: result, total: countResult[0]?.count || 0 };
}

export async function updateAnnouncement(id: number, updates: Partial<{ title: string; content: string; type: string; priority: number; active: boolean; expiresAt: Date | null }>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(announcements).set(updates).where(eq(announcements.id, id));
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(announcements).where(eq(announcements.id, id));
}

// ============ 统计相关 ============

export async function getDashboardStats(): Promise<{
  totalUsers: number;
  activeUsers: number;
  totalSearches: number;
  totalCreditsUsed: number;
  pendingOrders: number;
}> {
  const db = await getDb();
  if (!db) return { totalUsers: 0, activeUsers: 0, totalSearches: 0, totalCreditsUsed: 0, pendingOrders: 0 };
  
  const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [activeUsersCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.status, "active"));
  const [searchesCount] = await db.select({ count: sql<number>`count(*)` }).from(searchTasks);
  const [creditsSum] = await db.select({ sum: sql<number>`COALESCE(SUM(creditsUsed), 0)` }).from(searchTasks);
  const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(rechargeOrders).where(eq(rechargeOrders.status, "pending"));
  
  return {
    totalUsers: usersCount?.count || 0,
    activeUsers: activeUsersCount?.count || 0,
    totalSearches: searchesCount?.count || 0,
    totalCreditsUsed: creditsSum?.sum || 0,
    pendingOrders: pendingCount?.count || 0
  };
}
