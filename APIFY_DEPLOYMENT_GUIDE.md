# LeadHunter Pro - Apify 集成部署指南

## 概述

本次更新将数据源从 Apollo 切换到 Apify Leads Finder，实现了约 **95% 的成本降低**。

### 成本对比

| 数据源 | 成本 | 说明 |
|--------|------|------|
| Apollo | $30-50/千条 | 需要 credits，有月度限制 |
| Apify | ~$1.5/千条 | 按使用量计费，无月度限制 |

## 部署步骤

### 1. 获取 Apify API Token

1. 访问 [Apify Console](https://console.apify.com/)
2. 注册/登录账户
3. 进入 **Settings** → **Integrations**
4. 复制 **API Token**

### 2. 配置 Railway 环境变量

在 Railway 项目的 Variables 页面添加：

```
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**注意**：可以保留 `APOLLO_API_KEY`，但系统不再使用它。

### 3. 更新数据库 Schema

如果需要记录 Apify API 调用日志，需要更新数据库：

```sql
ALTER TABLE api_logs 
MODIFY COLUMN apiType ENUM('apollo_search', 'apollo_enrich', 'apify_search', 'scrape_tps', 'scrape_fps') NOT NULL;
```

或者通过 Drizzle 迁移：

```bash
pnpm db:push
```

### 4. 重新部署

Railway 会自动检测到代码更新并重新部署。如果没有自动部署，可以手动触发：

1. 进入 Railway 项目
2. 点击 **Deployments** 标签
3. 点击 **Redeploy** 按钮

## 功能变化

### 保持不变

- ✅ 搜索功能（姓名、职位、州）
- ✅ 电话号码获取
- ✅ Scrape.do 二次验证
- ✅ CSV 导出
- ✅ 积分系统
- ✅ 缓存机制

### 改进

- 🚀 **更快的响应**：Apify 一次性返回所有数据，无需 Webhook
- 💰 **更低的成本**：约 $1.5/千条 vs Apollo 的 $30-50/千条
- 📊 **更完整的数据**：包含更多字段（公司信息、社交媒体等）

### 移除

- ❌ Apollo Webhook 端点（保留但不再使用）
- ❌ 异步电话号码获取（改为同步）

## 新增文件

| 文件 | 说明 |
|------|------|
| `server/services/apify.ts` | Apify 服务模块 |
| `server/services/searchProcessorV3.ts` | 新搜索处理器 |
| `.env.example` | 环境变量示例 |

## 回滚方案

如果需要回滚到 Apollo：

1. 修改 `server/routers.ts`：
   ```typescript
   // 将 executeSearchV3 改回 executeSearchV2
   const task = await executeSearchV2(...);
   ```

2. 修改导入：
   ```typescript
   import { previewSearch, executeSearchV2 } from "./services/searchProcessorV2";
   ```

3. 提交并部署

## 监控

### 检查 Apify 使用情况

访问 [Apify Console](https://console.apify.com/) → **Billing** 查看：
- 当前计划
- 已使用的 credits
- 剩余 credits

### 检查日志

在 Railway 的 Logs 中查找：
- `[Apify]` - Apify 相关日志
- `[Scrape.do]` - 电话验证日志

## 常见问题

### Q: Apify API Token 无效？

确保：
1. Token 格式正确（以 `apify_api_` 开头）
2. 账户有足够的 credits
3. 环境变量名称正确（`APIFY_API_TOKEN`）

### Q: 搜索没有返回结果？

可能原因：
1. 搜索条件太严格
2. Apify Actor 运行超时
3. 网络问题

查看 Railway 日志获取详细错误信息。

### Q: 电话验证失败？

确保 `SCRAPEDO_API_TOKEN` 环境变量正确配置。

## 联系支持

如有问题，请查看 Railway 日志或联系开发团队。
