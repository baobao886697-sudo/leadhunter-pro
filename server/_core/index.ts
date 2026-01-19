import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startUsdtMonitor } from "../services/usdtMonitor";
import { handleApolloWebhook } from "../services/apolloWebhook";
import { startOrderExpirationChecker } from "../services/orderExpiration";
import { getDbSync } from "../db";
import { sql } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function ensureTables() {
  try {
    console.log("[Database] Ensuring all tables exist...");
    const db = getDbSync();
    if (!db) {
      console.log("[Database] No database connection, skipping table creation");
      return;
    }
    
    // ========== 核心业务表 ==========
    
    // 1. 用户表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        openId VARCHAR(64) NOT NULL,
        email VARCHAR(320) NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        name TEXT,
        credits INT NOT NULL DEFAULT 0,
        status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
        role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
        emailVerified BOOLEAN DEFAULT FALSE,
        resetToken VARCHAR(100),
        resetTokenExpires TIMESTAMP NULL,
        currentDeviceId VARCHAR(100),
        currentDeviceLoginAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE KEY users_openId_unique (openId),
        UNIQUE KEY users_email_unique (email)
      )
    `);
    console.log("[Database] Users table ready");
    
    // 2. 系统配置表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        updatedBy VARCHAR(50),
        UNIQUE KEY system_configs_key_unique (\`key\`)
      )
    `);
    console.log("[Database] System configs table ready");
    
    // 3. 充值订单表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recharge_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId VARCHAR(32) NOT NULL,
        userId INT NOT NULL,
        credits INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        walletAddress VARCHAR(100) NOT NULL,
        network VARCHAR(20) NOT NULL DEFAULT 'TRC20',
        status ENUM('pending', 'paid', 'cancelled', 'expired', 'mismatch') NOT NULL DEFAULT 'pending',
        txId VARCHAR(100),
        receivedAmount DECIMAL(10,2),
        adminNote TEXT,
        expiresAt TIMESTAMP NOT NULL,
        paidAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        UNIQUE KEY recharge_orders_orderId_unique (orderId),
        INDEX idx_userId (userId),
        INDEX idx_status (status)
      )
    `);
    console.log("[Database] Recharge orders table ready");
    
    // 4. 搜索任务表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS search_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        taskId VARCHAR(32) NOT NULL,
        userId INT NOT NULL,
        searchHash VARCHAR(32) NOT NULL,
        params JSON NOT NULL,
        requestedCount INT NOT NULL,
        actualCount INT DEFAULT 0,
        creditsUsed INT DEFAULT 0,
        status ENUM('pending', 'running', 'completed', 'failed', 'stopped', 'insufficient_credits') NOT NULL DEFAULT 'pending',
        progress INT DEFAULT 0,
        logs JSON,
        errorMessage TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completedAt TIMESTAMP NULL,
        UNIQUE KEY search_tasks_taskId_unique (taskId),
        INDEX idx_userId (userId),
        INDEX idx_status (status)
      )
    `);
    console.log("[Database] Search tasks table ready");
    
    // 5. 搜索结果表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS search_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        taskId INT NOT NULL,
        apolloId VARCHAR(64) NOT NULL,
        data JSON NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        verificationScore INT,
        verificationDetails JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_taskId (taskId),
        INDEX idx_apolloId (apolloId)
      )
    `);
    console.log("[Database] Search results table ready");
    
    // 6. 全局缓存表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS global_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cacheKey VARCHAR(100) NOT NULL,
        cacheType ENUM('search', 'person', 'verification') NOT NULL,
        data JSON NOT NULL,
        hitCount INT DEFAULT 0,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE KEY global_cache_cacheKey_unique (cacheKey)
      )
    `);
    console.log("[Database] Global cache table ready");
    
    // 7. 积分变动记录表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        amount INT NOT NULL,
        balanceAfter INT NOT NULL,
        type ENUM('recharge', 'search', 'admin_add', 'admin_deduct', 'refund', 'admin_adjust', 'bonus') NOT NULL,
        description TEXT,
        relatedOrderId VARCHAR(32),
        relatedTaskId VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_userId (userId),
        INDEX idx_type (type)
      )
    `);
    console.log("[Database] Credit logs table ready");
    
    // 8. 搜索日志表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS search_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        searchHash VARCHAR(32),
        params JSON,
        requestedCount INT,
        actualCount INT,
        creditsUsed INT,
        cacheHit BOOLEAN DEFAULT FALSE,
        status VARCHAR(20),
        errorMessage TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_userId (userId)
      )
    `);
    console.log("[Database] Search logs table ready");
    
    // 9. 管理员操作日志表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adminUsername VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        targetType VARCHAR(50),
        targetId VARCHAR(50),
        details JSON,
        ipAddress VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_adminUsername (adminUsername),
        INDEX idx_action (action)
      )
    `);
    console.log("[Database] Admin logs table ready");
    
    // 10. 登录日志表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        deviceId VARCHAR(100),
        ipAddress VARCHAR(50),
        userAgent TEXT,
        success BOOLEAN DEFAULT TRUE,
        failReason TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_userId (userId)
      )
    `);
    console.log("[Database] Login logs table ready");
    
    // 11. API调用日志表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        apiType ENUM('apollo_search', 'apollo_enrich', 'scrape_tps', 'scrape_fps') NOT NULL,
        endpoint VARCHAR(255),
        requestParams JSON,
        responseStatus INT,
        responseTime INT,
        success BOOLEAN DEFAULT TRUE,
        errorMessage TEXT,
        creditsUsed INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_userId (userId),
        INDEX idx_apiType (apiType)
      )
    `);
    console.log("[Database] API logs table ready");
    
    // ========== 辅助表 ==========
    
    // 12. 公告表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        type ENUM('info', 'warning', 'success', 'error') DEFAULT 'info' NOT NULL,
        isPinned BOOLEAN DEFAULT FALSE,
        isActive BOOLEAN DEFAULT TRUE,
        startTime TIMESTAMP NULL,
        endTime TIMESTAMP NULL,
        createdBy VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
      )
    `);
    console.log("[Database] Announcements table ready");
    
    // 13. 用户消息表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        type ENUM('system', 'support', 'notification', 'promotion') DEFAULT 'system' NOT NULL,
        isRead BOOLEAN DEFAULT FALSE,
        createdBy VARCHAR(50),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_userId (userId),
        INDEX idx_isRead (isRead)
      )
    `);
    console.log("[Database] User messages table ready");
    
    // 14. 用户活动日志表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        details JSON,
        ipAddress VARCHAR(50),
        userAgent TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_userId (userId),
        INDEX idx_action (action),
        INDEX idx_createdAt (createdAt)
      )
    `);
    console.log("[Database] User activity logs table ready");
    
    // 15. API统计表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date VARCHAR(10) NOT NULL,
        apiName VARCHAR(50) NOT NULL,
        callCount INT DEFAULT 0,
        successCount INT DEFAULT 0,
        errorCount INT DEFAULT 0,
        totalCreditsUsed INT DEFAULT 0,
        avgResponseTime INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
        UNIQUE KEY unique_date_api (date, apiName)
      )
    `);
    console.log("[Database] API stats table ready");
    
    // 16. 错误日志表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS error_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level ENUM('error', 'warn', 'info') DEFAULT 'error' NOT NULL,
        source VARCHAR(100),
        message TEXT NOT NULL,
        stack TEXT,
        userId INT,
        requestPath VARCHAR(255),
        requestBody JSON,
        resolved BOOLEAN DEFAULT FALSE,
        resolvedBy VARCHAR(50),
        resolvedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_level (level),
        INDEX idx_source (source),
        INDEX idx_resolved (resolved),
        INDEX idx_createdAt (createdAt)
      )
    `);
    console.log("[Database] Error logs table ready");
    
    // ========== 初始化默认数据 ==========
    
    // 插入默认系统配置（如果不存在）
    await db.execute(sql`
      INSERT IGNORE INTO system_configs (\`key\`, value, description) VALUES
      ('USDT_WALLET_TRC20', '', 'TRC20 USDT 收款钱包地址'),
      ('USDT_RATE', '7.2', 'USDT 兑人民币汇率'),
      ('CREDIT_PRICE', '1', '每积分价格(人民币)'),
      ('ORDER_EXPIRE_MINUTES', '30', '订单过期时间(分钟)'),
      ('SEARCH_COST_PER_RESULT', '1', '每条搜索结果消耗积分'),
      ('NEW_USER_BONUS', '0', '新用户赠送积分')
    `);
    console.log("[Database] Default system configs inserted");
    
    console.log("[Database] All tables ensured successfully");
  } catch (error) {
    console.error("[Database] Table creation error:", error);
    // 不阻止服务器启动
  }
}

async function startServer() {
  // 确保数据库表存在
  await ensureTables();
  
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Apollo Webhook endpoint
  app.post('/api/apollo-webhook', async (req, res) => {
    try {
      console.log('[Apollo Webhook] Received request');
      await handleApolloWebhook(req.body);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[Apollo Webhook] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
    
    // 启动后台服务
    if (process.env.NODE_ENV === 'production') {
      // 启动USDT自动检测服务（每30秒检查一次）
      startUsdtMonitor(30000);
      console.log("[Background] USDT monitor started");
      
      // 启动订单过期检查服务（每5分钟检查一次）
      startOrderExpirationChecker(5 * 60 * 1000);
      console.log("[Background] Order expiration checker started");
    }
  });
}

startServer().catch(console.error);
