# 云端寻踪 Pro 2.0 系统检查报告

## 检查日期
2026-01-18

## 1. 系统架构概览

### 1.1 技术栈
- **前端**: React + TypeScript + TailwindCSS + Vite
- **后端**: Express + tRPC + Drizzle ORM
- **数据库**: MySQL (TiDB)
- **部署**: Railway

### 1.2 主要功能模块
- 用户认证（邮箱注册/登录，单设备限制）
- LinkedIn专业人士搜索
- USDT充值系统
- 管理员后台

---

## 2. 环境变量配置

### 2.1 必需的环境变量

| 变量名 | 用途 | 状态 |
|--------|------|------|
| `DATABASE_URL` | 数据库连接 | ✅ 已配置 |
| `JWT_SECRET` | 会话加密密钥 | ✅ 已配置 |
| `VITE_APP_ID` | 应用ID | ✅ 已配置 |
| `OAUTH_SERVER_URL` | OAuth服务器地址 | ✅ 已配置 |

### 2.2 管理员认证变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ADMIN_USERNAME` | admin | 管理员用户名 |
| `ADMIN_PASSWORD` | bao12345678.. | 管理员密码 |
| `ADMIN_JWT_SECRET` | (使用JWT_SECRET) | 管理员JWT密钥 |

### 2.3 外部API密钥

| 变量名 | 用途 | 状态 |
|--------|------|------|
| `APOLLO_API_KEY` | Apollo.io搜索API | ⚠️ 需要在Railway配置 |
| `SCRAPEDO_API_KEY` | ScrapeDo爬虫API | ⚠️ 需要在Railway配置 |
| `TRONGRID_API_KEY` | TronGrid区块链API | ⚠️ 需要在Railway配置 |

---

## 3. 数据库配置项

以下配置项存储在 `system_configs` 表中，需要通过管理员后台设置：

| 配置键 | 用途 | 说明 |
|--------|------|------|
| `USDT_WALLET_TRC20` | TRC20收款地址 | USDT充值收款钱包地址 |
| `USDT_WALLET_ERC20` | ERC20收款地址 | （可选）ERC20网络收款地址 |
| `USDT_WALLET_BEP20` | BEP20收款地址 | （可选）BEP20网络收款地址 |
| `APOLLO_API_KEY` | Apollo API密钥 | 用于LinkedIn搜索 |
| `SCRAPE_DO_TOKEN` | ScrapeDo令牌 | 用于网页爬取 |

---

## 4. API路由检查

### 4.1 认证路由 (`auth.*`)
- ✅ `auth.register` - 用户注册
- ✅ `auth.login` - 用户登录（支持单设备限制）
- ✅ `auth.logout` - 用户登出
- ✅ `auth.me` - 获取当前用户
- ✅ `auth.verifyEmail` - 邮箱验证
- ✅ `auth.requestPasswordReset` - 请求密码重置
- ✅ `auth.resetPassword` - 重置密码

### 4.2 用户路由 (`user.*`)
- ✅ `user.profile` - 获取用户资料
- ✅ `user.credits` - 获取积分余额
- ✅ `user.creditHistory` - 获取积分交易记录

### 4.3 搜索路由 (`search.*`)
- ✅ `search.start` - 开始搜索
- ✅ `search.taskStatus` - 获取任务状态
- ✅ `search.tasks` - 获取任务列表
- ✅ `search.results` - 获取搜索结果
- ✅ `search.exportCsv` - 导出CSV

### 4.4 充值路由 (`recharge.*`)
- ✅ `recharge.create` - 创建充值订单
- ✅ `recharge.status` - 获取订单状态
- ✅ `recharge.history` - 获取充值记录（已修复参数传递问题）
- ✅ `recharge.confirm` - 确认支付（管理员）

### 4.5 管理员认证路由 (`adminAuth.*`)
- ✅ `adminAuth.login` - 管理员登录
- ✅ `adminAuth.verify` - 验证管理员令牌

### 4.6 管理员路由 (`admin.*`)
- ✅ `admin.dashboardStats` - 仪表盘统计
- ✅ `admin.users` - 用户管理
- ✅ `admin.updateUserStatus` - 更新用户状态
- ✅ `admin.updateUserRole` - 更新用户角色
- ✅ `admin.addCredits` - 添加积分
- ✅ `admin.configs` - 获取所有配置
- ✅ `admin.setConfig` - 设置配置
- ✅ `admin.orders` - 订单管理
- ✅ `admin.apiLogs` - API日志
- ✅ `admin.adminLogs` - 管理员日志
- ✅ `admin.loginLogs` - 登录日志

---

## 5. 已修复的问题

### 5.1 充值记录查询参数问题
**问题**: `recharge.history` 路由的参数传递不正确，导致查询结果为空。

**修复**: 更新了路由参数处理，正确传递 `page` 和 `limit` 参数。

```typescript
// 修复前
return getUserRechargeOrders(ctx.user.id, input.limit);

// 修复后
return getUserRechargeOrders(ctx.user.id, input.page || 1, input.limit || 20);
```

---

## 6. 待配置项

### 6.1 Railway环境变量
需要在Railway控制台配置以下环境变量：

1. **APOLLO_API_KEY** - Apollo.io API密钥
   - 用于LinkedIn专业人士搜索
   - 获取地址: https://app.apollo.io/

2. **TRONGRID_API_KEY** - TronGrid API密钥
   - 用于USDT交易监控
   - 获取地址: https://www.trongrid.io/

### 6.2 数据库配置
需要通过管理员后台设置：

1. **USDT_WALLET_TRC20** - TRC20收款钱包地址
2. **APOLLO_API_KEY** - Apollo API密钥（也可在数据库中配置）

---

## 7. 功能测试结果

| 功能 | 状态 | 备注 |
|------|------|------|
| 用户注册 | ✅ 正常 | API测试通过 |
| 用户登录 | ✅ 正常 | API测试通过，支持单设备限制 |
| 仪表盘 | ✅ 正常 | 页面加载正常 |
| 搜索功能 | ⚠️ 待配置 | 需要配置Apollo API密钥 |
| 充值订单创建 | ✅ 正常 | API测试通过 |
| 充值记录查询 | ✅ 已修复 | 参数传递问题已修复 |
| 管理员登录 | ⚠️ 待验证 | 需要确认Railway环境变量 |

---

## 8. 建议

1. **配置Apollo API密钥**: 在Railway环境变量或数据库中配置 `APOLLO_API_KEY`，以启用搜索功能。

2. **配置USDT钱包地址**: 通过管理员后台设置 `USDT_WALLET_TRC20`，以启用充值功能。

3. **验证管理员密码**: 确认Railway中的 `ADMIN_PASSWORD` 环境变量是否正确设置。

4. **定期检查日志**: 通过管理员后台监控API日志和登录日志，确保系统安全。

---

## 9. 联系方式

如有问题，请联系开发团队。
