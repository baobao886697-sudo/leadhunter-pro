import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  users, InsertUser, User,
  creditTransactions, CreditTransaction,
  searchTasks, SearchTask,
  searchResults, SearchResult,
  dataCache, DataCache,
  rechargeOrders, RechargeOrder,
  apiLogs, ApiLog,
  systemConfig, SystemConfig,
  taskQueue, TaskQueueItem
} from "../drizzle/schema";
import { ENV } from './_core/env';
import crypto from 'crypto';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ 用户相关 ============

export async function createUser(email: string, passwordHash: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时

  await db.insert(users).values({
    email,
    passwordHash,
    verificationToken,
    verificationExpires,
    credits: 100, // 新用户赠送100积分
  });

  return getUserByEmail(email);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function verifyUserEmail(token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(users)
    .set({ emailVerified: true, verificationToken: null, verificationExpires: null })
    .where(and(
      eq(users.verificationToken, token),
      gte(users.verificationExpires, new Date())
    ));

  return (result as any).affectedRows > 0;
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1小时

  const result = await db.update(users)
    .set({ resetToken, resetExpires })
    .where(eq(users.email, email));

  return (result as any).affectedRows > 0 ? resetToken : null;
}

export async function resetPassword(token: string, newPasswordHash: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(users)
    .set({ passwordHash: newPasswordHash, resetToken: null, resetExpires: null })
    .where(and(
      eq(users.resetToken, token),
      gte(users.resetExpires, new Date())
    ));

  return (result as any).affectedRows > 0;
}

export async function updateUserLastSignIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserStatus(userId: number, status: 'active' | 'disabled'): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(users)
    .set({ status })
    .where(eq(users.id, userId));

  return (result as any).affectedRows > 0;
}

export async function updateUserRole(userId: number, role: 'user' | 'admin'): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(users)
    .set({ role })
    .where(eq(users.id, userId));

  return (result as any).affectedRows > 0;
}

// ============ 积分相关 ============

export async function getUserCredits(userId: number): Promise<number> {
  const user = await getUserById(userId);
  return user?.credits ?? 0;
}

export async function deductCredits(
  userId: number, 
  amount: number, 
  type: 'search' | 'phone_fetch',
  description: string,
  relatedId?: number
): Promise<{ success: boolean; newBalance: number }> {
  const db = await getDb();
  if (!db) return { success: false, newBalance: 0 };

  const user = await getUserById(userId);
  if (!user || user.credits < amount) {
    return { success: false, newBalance: user?.credits ?? 0 };
  }

  const newBalance = user.credits - amount;

  await db.update(users)
    .set({ credits: newBalance })
    .where(eq(users.id, userId));

  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    type,
    description,
    balanceAfter: newBalance,
    relatedId,
  });

  return { success: true, newBalance };
}

export async function addCredits(
  userId: number,
  amount: number,
  type: 'recharge' | 'admin_adjust' | 'refund',
  description: string,
  relatedId?: number
): Promise<{ success: boolean; newBalance: number }> {
  const db = await getDb();
  if (!db) return { success: false, newBalance: 0 };

  const user = await getUserById(userId);
  if (!user) return { success: false, newBalance: 0 };

  const newBalance = user.credits + amount;

  await db.update(users)
    .set({ credits: newBalance })
    .where(eq(users.id, userId));

  await db.insert(creditTransactions).values({
    userId,
    amount,
    type,
    description,
    balanceAfter: newBalance,
    relatedId,
  });

  return { success: true, newBalance };
}

export async function getCreditTransactions(userId: number, limit = 50): Promise<CreditTransaction[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

// ============ 搜索任务相关 ============

export async function createSearchTask(
  userId: number,
  searchName: string,
  searchTitle: string,
  searchState: string
): Promise<SearchTask | null> {
  const db = await getDb();
  if (!db) return null;

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

  const result = await db.insert(searchTasks).values({
    userId,
    searchName,
    searchTitle,
    searchState,
    expiresAt,
    processLog: [],
  });

  const insertId = (result as any).insertId;
  const task = await db.select().from(searchTasks).where(eq(searchTasks.id, insertId)).limit(1);
  return task[0] || null;
}

export async function updateSearchTask(
  taskId: number,
  updates: Partial<SearchTask>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(searchTasks)
    .set(updates as any)
    .where(eq(searchTasks.id, taskId));

  return (result as any).affectedRows > 0;
}

export async function getSearchTask(taskId: number): Promise<SearchTask | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(searchTasks).where(eq(searchTasks.id, taskId)).limit(1);
  return result[0];
}

export async function getUserSearchTasks(userId: number, limit = 20): Promise<SearchTask[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(searchTasks)
    .where(eq(searchTasks.userId, userId))
    .orderBy(desc(searchTasks.createdAt))
    .limit(limit);
}

// ============ 搜索结果相关 ============

export async function saveSearchResults(results: Omit<SearchResult, 'id' | 'createdAt'>[]): Promise<void> {
  const db = await getDb();
  if (!db || results.length === 0) return;

  await db.insert(searchResults).values(results as any);
}

export async function getSearchResults(taskId: number): Promise<SearchResult[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(searchResults)
    .where(eq(searchResults.taskId, taskId))
    .orderBy(desc(searchResults.matchScore));
}

export async function updateSearchResult(
  resultId: number,
  updates: Partial<SearchResult>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(searchResults)
    .set(updates as any)
    .where(eq(searchResults.id, resultId));

  return (result as any).affectedRows > 0;
}

// ============ 储存库相关 ============

export function generateCacheKey(name: string, title: string, state: string, apolloId: string): string {
  const normalized = `${name.toLowerCase().trim()}|${title.toLowerCase().trim()}|${state.toLowerCase().trim()}|${apolloId}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function getCachedData(searchName: string, searchTitle: string, searchState: string): Promise<DataCache[]> {
  const db = await getDb();
  if (!db) return [];

  // 使用模糊匹配查找缓存
  return db.select()
    .from(dataCache)
    .where(and(
      eq(dataCache.searchName, searchName.toLowerCase().trim()),
      eq(dataCache.searchTitle, searchTitle.toLowerCase().trim()),
      eq(dataCache.searchState, searchState.toLowerCase().trim())
    ));
}

export async function saveToCacheAndUpdateHit(data: Omit<DataCache, 'id' | 'createdAt' | 'updatedAt' | 'hitCount' | 'lastHitAt'>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const cacheKey = generateCacheKey(data.searchName, data.searchTitle, data.searchState, data.apolloId);

  await db.insert(dataCache)
    .values({
      ...data,
      cacheKey,
      searchName: data.searchName.toLowerCase().trim(),
      searchTitle: data.searchTitle.toLowerCase().trim(),
      searchState: data.searchState.toLowerCase().trim(),
    } as any)
    .onDuplicateKeyUpdate({
      set: {
        hitCount: sql`${dataCache.hitCount} + 1`,
        lastHitAt: new Date(),
      }
    });
}

export async function incrementCacheHit(cacheId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(dataCache)
    .set({
      hitCount: sql`${dataCache.hitCount} + 1`,
      lastHitAt: new Date(),
    })
    .where(eq(dataCache.id, cacheId));
}

// ============ 充值订单相关 ============

export async function createRechargeOrder(
  userId: number,
  credits: number,
  usdtAmount: string,
  walletAddress: string,
  network: 'TRC20' | 'ERC20' | 'BEP20' = 'TRC20'
): Promise<RechargeOrder | null> {
  const db = await getDb();
  if (!db) return null;

  const orderId = `RCH${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟过期

  await db.insert(rechargeOrders).values({
    orderId,
    userId,
    credits,
    usdtAmount,
    usdtNetwork: network,
    walletAddress,
    expectedAmount: usdtAmount,
    expiresAt,
  });

  const order = await db.select().from(rechargeOrders).where(eq(rechargeOrders.orderId, orderId)).limit(1);
  return order[0] || null;
}

export async function getRechargeOrder(orderId: string): Promise<RechargeOrder | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(rechargeOrders).where(eq(rechargeOrders.orderId, orderId)).limit(1);
  return result[0];
}

export async function confirmRechargeOrder(
  orderId: string,
  txHash: string,
  actualAmount: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const order = await getRechargeOrder(orderId);
  if (!order || order.status !== 'pending') return false;

  await db.update(rechargeOrders)
    .set({
      status: 'confirmed',
      txHash,
      actualAmount,
      paidAt: new Date(),
    })
    .where(eq(rechargeOrders.orderId, orderId));

  // 添加积分
  await addCredits(order.userId, order.credits, 'recharge', `USDT充值 ${actualAmount}`, order.id);

  return true;
}

export async function getUserRechargeOrders(userId: number, limit = 20): Promise<RechargeOrder[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(rechargeOrders)
    .where(eq(rechargeOrders.userId, userId))
    .orderBy(desc(rechargeOrders.createdAt))
    .limit(limit);
}

// ============ API日志相关 ============

export async function logApiCall(log: Omit<ApiLog, 'id' | 'createdAt'>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(apiLogs).values(log as any);
}

export async function getApiLogs(filters: {
  userId?: number;
  taskId?: number;
  apiType?: string;
  limit?: number;
}): Promise<ApiLog[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(apiLogs);
  
  const conditions = [];
  if (filters.userId) conditions.push(eq(apiLogs.userId, filters.userId));
  if (filters.taskId) conditions.push(eq(apiLogs.taskId, filters.taskId));
  if (filters.apiType) conditions.push(eq(apiLogs.apiType, filters.apiType as any));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.orderBy(desc(apiLogs.createdAt)).limit(filters.limit || 100);
}

// ============ 系统配置相关 ============

export async function getConfig(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(systemConfig).where(eq(systemConfig.configKey, key)).limit(1);
  return result[0]?.configValue || null;
}

export async function setConfig(key: string, value: string, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(systemConfig)
    .values({ configKey: key, configValue: value, description })
    .onDuplicateKeyUpdate({
      set: { configValue: value, description }
    });
}

export async function getAllConfigs(): Promise<SystemConfig[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(systemConfig);
}

// ============ 任务队列相关 ============

export async function addToQueue(
  taskType: 'fetch_phones' | 'verify_phone' | 'check_payment',
  payload: any,
  priority = 0
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(taskQueue).values({
    taskType,
    payload,
    priority,
  });
}

export async function getNextQueueTask(): Promise<TaskQueueItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(taskQueue)
    .where(and(
      eq(taskQueue.status, 'pending'),
      lte(taskQueue.scheduledAt, new Date())
    ))
    .orderBy(desc(taskQueue.priority), taskQueue.scheduledAt)
    .limit(1);

  if (result[0]) {
    await db.update(taskQueue)
      .set({ status: 'processing', startedAt: new Date() })
      .where(eq(taskQueue.id, result[0].id));
  }

  return result[0];
}

export async function completeQueueTask(taskId: number, success: boolean, errorMessage?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(taskQueue)
    .set({
      status: success ? 'completed' : 'failed',
      completedAt: new Date(),
      errorMessage,
    })
    .where(eq(taskQueue.id, taskId));
}

// ============ 统计相关 ============

export async function getSearchStats(): Promise<{
  totalSearches: number;
  todaySearches: number;
  totalPhonesFetched: number;
  totalCreditsUsed: number;
}> {
  const db = await getDb();
  if (!db) return { totalSearches: 0, todaySearches: 0, totalPhonesFetched: 0, totalCreditsUsed: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalResult = await db.select({
    count: sql<number>`COUNT(*)`,
    phones: sql<number>`SUM(phonesFetched)`,
    credits: sql<number>`SUM(creditsUsed)`,
  }).from(searchTasks);

  const todayResult = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(searchTasks).where(gte(searchTasks.createdAt, today));

  return {
    totalSearches: totalResult[0]?.count || 0,
    todaySearches: todayResult[0]?.count || 0,
    totalPhonesFetched: totalResult[0]?.phones || 0,
    totalCreditsUsed: totalResult[0]?.credits || 0,
  };
}

// Legacy function for OAuth compatibility
export async function upsertUser(user: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  if (user.openId) {
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existing[0]) {
      // Update existing user
      const updateData: Record<string, any> = { lastSignedIn: new Date() };
      if (user.name !== undefined) updateData.name = user.name;
      if (user.email !== undefined) updateData.email = user.email;
      if (user.loginMethod !== undefined) updateData.loginMethod = user.loginMethod;
      
      await db.update(users)
        .set(updateData)
        .where(eq(users.openId, user.openId));
      return;
    }
    
    // Create new user from OAuth
    const email = user.email || `${user.openId}@oauth.local`;
    await db.insert(users).values({
      email,
      openId: user.openId,
      name: user.name || null,
      loginMethod: user.loginMethod || null,
      emailVerified: true, // OAuth users are verified
      credits: 100, // New user bonus
    });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
