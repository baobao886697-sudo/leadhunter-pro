# 云端寻踪 Pro 2.0 全面系统检查报告

## 检查日期
2026-01-18

---

## 一、系统概览

### 1.1 技术架构
| 组件 | 技术栈 |
|------|--------|
| 前端 | React + TypeScript + TailwindCSS + Vite |
| 后端 | Express + tRPC + Drizzle ORM |
| 数据库 | MySQL (TiDB) |
| 部署 | Railway |

### 1.2 核心功能模块
- ✅ 用户认证（邮箱注册/登录，单设备限制）
- ✅ LinkedIn专业人士搜索
- ✅ USDT充值系统
- ✅ 管理员后台

---

## 二、配置参数核对

### 2.1 管理员账号
| 项目 | 值 |
|------|-----|
| 用户名 | 88888888 |
| 密码 | Bao12345678.. |

### 2.2 数据库配置项（system_configs表）

#### 充值配置
| 配置键 | 当前值 | 说明 |
|--------|--------|------|
| USDT_WALLET_TRC20 | TEtRGZvdPqvUDhopMi1MEGCEiD9Ehdh1iZ | ✅ TRC20收款地址 |
| USDT_WALLET_ERC20 | 未配置 | ⚠️ ERC20收款地址 |
| USDT_WALLET_BEP20 | 未配置 | ⚠️ BEP20收款地址 |
| MIN_RECHARGE_CREDITS | 100 | ✅ 最低充值积分 |
| CREDITS_PER_USDT | 100 | ✅ 1 USDT = 100积分 |
| ORDER_EXPIRE_MINUTES | 30 | ✅ 订单过期时间 |

#### 搜索配置
| 配置键 | 当前值 | 说明 |
|--------|--------|------|
| SEARCH_CREDITS_PER_PERSON | 2 | ✅ 每条结果消耗积分 |
| PREVIEW_CREDITS | 1 | ✅ 预览消耗积分 |
| CACHE_TTL_DAYS | 180 | ✅ 缓存有效期 |

### 2.3 环境变量配置（Railway）

#### 必需配置
| 变量名 | 状态 | 说明 |
|--------|------|------|
| DATABASE_URL | ✅ 已配置 | 数据库连接 |
| JWT_SECRET | ✅ 已配置 | JWT密钥 |
| VITE_APP_ID | ✅ 已配置 | 应用ID |
| ADMIN_USERNAME | ✅ 已配置 | 管理员用户名 |
| ADMIN_PASSWORD | ✅ 已配置 | 管理员密码 |

#### 外部API配置
| 变量名 | 状态 | 说明 |
|--------|------|------|
| APOLLO_API_KEY | ⚠️ 需要检查 | Apollo搜索API |
| TRONGRID_API_KEY | ⚠️ 需要配置 | USDT自动监控 |
| SCRAPEDO_API_KEY | ⚠️ 需要检查 | 网页爬取API |

---

## 三、充值判定和积分派发机制

### 3.1 充值流程

```
1. 用户创建订单
   ↓
2. 系统生成唯一尾数金额（如 1.23 USDT）
   ↓
3. 用户转账到指定钱包
   ↓
4. 系统自动监控（每30秒）或管理员手动确认
   ↓
5. 积分自动派发到用户账户
```

### 3.2 自动监控机制

**工作原理**：
- 系统每30秒检查配置的USDT钱包地址
- 使用TronGrid API获取TRC20交易记录
- 通过金额精确匹配订单

**匹配规则**：
| 匹配类型 | 条件 | 处理方式 |
|----------|------|----------|
| 精确匹配 | 金额完全一致 | 自动确认，自动派发积分 |
| 模糊匹配 | 整数相同，尾数不同 | 标记为"金额不匹配"，需人工确认 |
| 无匹配 | 没有对应订单 | 记录日志，不处理 |

**关键代码**：
```typescript
// server/services/usdtMonitor.ts
if (match.exactMatch) {
  // 精确匹配，自动确认
  await confirmRechargeOrder(match.orderId, tx.txId, tx.amount.toString());
} else {
  // 金额不匹配，标记需要人工处理
  await markOrderMismatch(match.orderId, tx.amount.toString(), tx.txId);
}
```

### 3.3 积分派发逻辑

**确认订单时自动派发**：
```typescript
// server/db.ts - confirmRechargeOrder()
export async function confirmRechargeOrder(orderId, txId, receivedAmount) {
  // 1. 更新订单状态为"已支付"
  await db.update(rechargeOrders).set({ 
    status: "paid", 
    txId, 
    receivedAmount, 
    paidAt: new Date() 
  });
  
  // 2. 派发积分给用户
  await addCredits(
    order.userId, 
    order.credits,  // 订单中的积分数量
    "recharge", 
    `充值订单 ${orderId}`, 
    orderId
  );
}
```

**积分记录**：
- 每次积分变动都记录到 `credit_logs` 表
- 包含：用户ID、变动金额、变动后余额、类型、描述、关联订单ID

### 3.4 当前问题

**⚠️ 自动监控可能未工作**

原因：`TRONGRID_API_KEY` 环境变量可能未配置。

代码中的处理：
```typescript
const apiKey = process.env.TRONGRID_API_KEY;
if (!apiKey) {
  // 没有API Key时静默跳过，不输出错误日志
  return [];
}
```

**建议**：在Railway环境变量中配置 `TRONGRID_API_KEY`，启用自动监控功能。

---

## 四、功能测试结果

### 4.1 用户功能
| 功能 | 状态 | 备注 |
|------|------|------|
| 用户注册 | ✅ 正常 | API测试通过 |
| 用户登录 | ✅ 正常 | 支持单设备限制 |
| 仪表盘 | ✅ 正常 | 页面加载正常 |
| 搜索功能 | ⚠️ 待配置 | 需要Apollo API密钥 |
| 充值订单创建 | ✅ 正常 | 唯一尾数机制正常 |
| 充值记录查询 | ✅ 已修复 | 参数传递问题已修复 |

### 4.2 管理员功能
| 功能 | 状态 | 备注 |
|------|------|------|
| 管理员登录 | ✅ 正常 | 账号：88888888 |
| 仪表盘统计 | ✅ 正常 | 显示正确 |
| 用户管理 | ✅ 正常 | 可查看和管理用户 |
| 充值订单管理 | ✅ 正常 | 可手动确认订单 |
| 系统配置 | ✅ 正常 | 可修改配置项 |

### 4.3 系统统计
| 指标 | 值 |
|------|-----|
| 总用户数 | 6 |
| 活跃用户 | 6 |
| 待处理订单 | 5 |
| 本月收入 | $0.00 |
| 今日搜索 | 1 |
| 总搜索次数 | 1 |

---

## 五、已修复的问题

### 5.1 充值记录查询参数问题
**问题**：`recharge.history` 路由的参数传递不正确，导致查询结果为空。

**修复**：
```typescript
// 修复前
return getUserRechargeOrders(ctx.user.id, input.limit);

// 修复后
return getUserRechargeOrders(ctx.user.id, input.page || 1, input.limit || 20);
```

---

## 六、待处理事项

### 6.1 必须配置
1. **TRONGRID_API_KEY**
   - 用途：启用USDT自动监控
   - 获取：https://www.trongrid.io/
   - 配置位置：Railway环境变量

2. **APOLLO_API_KEY**（如需搜索功能）
   - 用途：LinkedIn专业人士搜索
   - 获取：https://app.apollo.io/
   - 配置位置：Railway环境变量或数据库

### 6.2 建议优化
1. 添加ERC20和BEP20网络支持
2. 添加充值金额不匹配时的邮件通知
3. 添加订单即将过期的提醒功能

---

## 七、结论

云端寻踪 Pro 2.0 系统整体架构完善，核心功能正常工作。充值判定和积分派发机制设计合理：

1. **唯一尾数机制**：确保每个订单金额唯一，避免混淆
2. **自动监控**：每30秒检查一次，精确匹配自动确认
3. **积分派发**：订单确认后立即派发，有完整日志记录
4. **人工兜底**：金额不匹配时标记需人工处理

**主要待办**：配置 `TRONGRID_API_KEY` 以启用自动监控功能。在此之前，所有订单需要管理员手动确认。
