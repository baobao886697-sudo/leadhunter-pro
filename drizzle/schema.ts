import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, json, bigint } from "drizzle-orm/mysql-core";

// ============ 用户系统 ============
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  verificationToken: varchar("verificationToken", { length: 64 }),
  verificationExpires: timestamp("verificationExpires"),
  resetToken: varchar("resetToken", { length: 64 }),
  resetExpires: timestamp("resetExpires"),
  credits: int("credits").default(0).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "disabled"]).default("active").notNull(),
  openId: varchar("openId", { length: 64 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============ 积分交易记录 ============
export const creditTransactions = mysqlTable("credit_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(), // 正数为增加，负数为扣除
  type: mysqlEnum("type", ["recharge", "search", "phone_fetch", "admin_adjust", "refund"]).notNull(),
  description: text("description"),
  balanceAfter: int("balanceAfter").notNull(),
  relatedId: int("relatedId"), // 关联的订单或任务ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;

// ============ 搜索任务 ============
export const searchTasks = mysqlTable("search_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  searchName: varchar("searchName", { length: 255 }).notNull(),
  searchTitle: varchar("searchTitle", { length: 255 }).notNull(),
  searchState: varchar("searchState", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["pending", "searching", "fetching_phones", "verifying", "completed", "failed", "stopped"]).default("pending").notNull(),
  totalResults: int("totalResults").default(0).notNull(),
  phonesRequested: int("phonesRequested").default(0).notNull(),
  phonesFetched: int("phonesFetched").default(0).notNull(),
  phonesVerified: int("phonesVerified").default(0).notNull(),
  creditsUsed: int("creditsUsed").default(0).notNull(),
  errorMessage: text("errorMessage"),
  processLog: json("processLog"), // 实时进度日志
  apolloSearchId: varchar("apolloSearchId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  expiresAt: timestamp("expiresAt"), // 7天后过期
});

export type SearchTask = typeof searchTasks.$inferSelect;

// ============ 搜索结果 ============
export const searchResults = mysqlTable("search_results", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  apolloId: varchar("apolloId", { length: 255 }),
  firstName: varchar("firstName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  fullName: varchar("fullName", { length: 512 }),
  title: varchar("title", { length: 512 }),
  company: varchar("company", { length: 512 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  linkedinUrl: varchar("linkedinUrl", { length: 1024 }),
  email: varchar("email", { length: 320 }),
  phoneNumber: varchar("phoneNumber", { length: 50 }),
  phoneType: mysqlEnum("phoneType", ["mobile", "landline", "voip", "unknown"]),
  carrier: varchar("carrier", { length: 255 }),
  age: int("age"),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "failed", "skipped"]).default("pending").notNull(),
  verificationSource: mysqlEnum("verificationSource", ["truepeoplesearch", "fastpeoplesearch", "both", "none"]),
  matchScore: int("matchScore"), // 匹配分数 0-100
  rawApolloData: json("rawApolloData"),
  rawVerificationData: json("rawVerificationData"),
  fromCache: boolean("fromCache").default(false).notNull(), // 是否来自储存库
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type SearchResult = typeof searchResults.$inferSelect;

// ============ 储存库（缓存Apollo数据）============
export const dataCache = mysqlTable("data_cache", {
  id: int("id").autoincrement().primaryKey(),
  cacheKey: varchar("cacheKey", { length: 512 }).notNull().unique(), // 搜索条件的hash
  searchName: varchar("searchName", { length: 255 }).notNull(),
  searchTitle: varchar("searchTitle", { length: 255 }).notNull(),
  searchState: varchar("searchState", { length: 100 }).notNull(),
  apolloId: varchar("apolloId", { length: 255 }).notNull(),
  firstName: varchar("firstName", { length: 255 }),
  lastName: varchar("lastName", { length: 255 }),
  fullName: varchar("fullName", { length: 512 }),
  title: varchar("title", { length: 512 }),
  company: varchar("company", { length: 512 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  linkedinUrl: varchar("linkedinUrl", { length: 1024 }),
  email: varchar("email", { length: 320 }),
  phoneNumber: varchar("phoneNumber", { length: 50 }),
  phoneType: mysqlEnum("phoneType", ["mobile", "landline", "voip", "unknown"]),
  carrier: varchar("carrier", { length: 255 }),
  rawData: json("rawData"),
  hitCount: int("hitCount").default(0).notNull(), // 被命中次数
  lastHitAt: timestamp("lastHitAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DataCache = typeof dataCache.$inferSelect;

// ============ USDT充值订单 ============
export const rechargeOrders = mysqlTable("recharge_orders", {
  id: int("id").autoincrement().primaryKey(),
  orderId: varchar("orderId", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  credits: int("credits").notNull(), // 购买的积分数量
  usdtAmount: decimal("usdtAmount", { precision: 18, scale: 6 }).notNull(),
  usdtNetwork: mysqlEnum("usdtNetwork", ["TRC20", "ERC20", "BEP20"]).default("TRC20").notNull(),
  walletAddress: varchar("walletAddress", { length: 255 }).notNull(),
  expectedAmount: decimal("expectedAmount", { precision: 18, scale: 6 }).notNull(),
  actualAmount: decimal("actualAmount", { precision: 18, scale: 6 }),
  txHash: varchar("txHash", { length: 255 }),
  status: mysqlEnum("status", ["pending", "confirmed", "expired", "failed"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RechargeOrder = typeof rechargeOrders.$inferSelect;

// ============ API调用日志 ============
export const apiLogs = mysqlTable("api_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  taskId: int("taskId"),
  apiType: mysqlEnum("apiType", ["apollo_search", "apollo_enrich", "scrape_tps", "scrape_fps", "blockchain"]).notNull(),
  endpoint: varchar("endpoint", { length: 512 }),
  requestData: json("requestData"),
  responseData: json("responseData"),
  responseTimeMs: int("responseTimeMs"),
  statusCode: int("statusCode"),
  success: boolean("success").default(false).notNull(),
  errorMessage: text("errorMessage"),
  creditsUsed: int("creditsUsed").default(0).notNull(),
  cacheHit: boolean("cacheHit").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiLog = typeof apiLogs.$inferSelect;

// ============ 系统配置 ============
export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  configKey: varchar("configKey", { length: 100 }).notNull().unique(),
  configValue: text("configValue").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;

// ============ 任务队列 ============
export const taskQueue = mysqlTable("task_queue", {
  id: int("id").autoincrement().primaryKey(),
  taskType: mysqlEnum("taskType", ["fetch_phones", "verify_phone", "check_payment"]).notNull(),
  payload: json("payload").notNull(),
  priority: int("priority").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  errorMessage: text("errorMessage"),
  scheduledAt: timestamp("scheduledAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskQueueItem = typeof taskQueue.$inferSelect;
