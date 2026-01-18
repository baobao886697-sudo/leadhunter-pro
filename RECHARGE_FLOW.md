# 云端寻踪 Pro 2.0 充值流程说明

## 充值流程概览

```
用户创建订单 → 用户转账USDT → 系统自动检测 → 自动/手动确认 → 积分到账
```

---

## 1. 用户创建充值订单

### 流程
1. 用户选择充值积分数量（最低100积分）
2. 系统计算USDT金额：`积分数 / 100 = USDT金额`
3. 系统生成**唯一尾数金额**，避免订单混淆
4. 返回收款地址和精确金额

### 唯一尾数机制
- 基础金额：如 1.00 USDT
- 唯一尾数：系统自动添加 0.01-0.99 的尾数
- 最终金额：如 1.23 USDT（每个订单金额唯一）

### 代码位置
- `server/routers.ts` - `recharge.create`
- `server/db.ts` - `createRechargeOrderWithUniqueAmount()`

---

## 2. USDT自动监控服务

### 工作原理
系统每30秒自动检查配置的USDT钱包地址，获取最新交易记录。

### 支持的网络
- ✅ TRC20（已实现，使用TronGrid API）
- ⏳ ERC20（待实现）
- ⏳ BEP20（待实现）

### 必需配置
| 配置项 | 说明 |
|--------|------|
| `USDT_WALLET_TRC20` | TRC20收款钱包地址（数据库配置） |
| `TRONGRID_API_KEY` | TronGrid API密钥（环境变量） |

### 代码位置
- `server/services/usdtMonitor.ts`
- `server/_core/index.ts` - 启动监控服务

---

## 3. 订单匹配逻辑

### 精确匹配（自动确认）
当收到的USDT金额与某个待处理订单的金额**完全一致**时：
- 自动确认订单
- 自动派发积分
- 记录系统日志

### 模糊匹配（需人工处理）
当收到的USDT金额与订单金额**整数部分相同但尾数不同**时：
- 标记订单为"金额不匹配"
- 需要管理员在后台手动确认

### 无匹配
当收到的USDT金额没有匹配的订单时：
- 记录日志
- 不做任何处理

---

## 4. 积分派发

### 自动派发（精确匹配时）
```typescript
// server/db.ts - confirmRechargeOrder()
await addCredits(order.userId, order.credits, "recharge", `充值订单 ${orderId}`, orderId);
```

### 手动派发（管理员确认时）
管理员在后台点击"确认支付"后，系统调用相同的积分派发逻辑。

### 积分记录
每次积分变动都会记录到 `credit_logs` 表：
- 用户ID
- 变动金额
- 变动后余额
- 类型（recharge/admin_add/refund）
- 描述
- 关联订单ID

---

## 5. 管理员操作

### 查看待处理订单
路径：管理后台 → 充值订单

### 手动确认订单
1. 查看订单详情
2. 核对交易哈希
3. 输入实际收到金额
4. 点击确认

### API
```typescript
// server/routers.ts - recharge.confirm
adminProcedure.input({
  orderId: string,
  txHash: string,
  actualAmount: string
})
```

---

## 6. 当前配置状态

### 已配置 ✅
- USDT_WALLET_TRC20: `TEtRGZvdPqvUDhopMi1MEGCEiD9Ehdh1iZ`
- CREDITS_PER_USDT: 100
- MIN_RECHARGE_CREDITS: 100
- ORDER_EXPIRE_MINUTES: 30

### 需要配置 ⚠️
- **TRONGRID_API_KEY**：需要在Railway环境变量中配置，否则自动监控无法工作

---

## 7. 问题排查

### 自动确认不工作？
1. 检查 `TRONGRID_API_KEY` 是否配置
2. 检查 `USDT_WALLET_TRC20` 是否正确
3. 检查订单金额是否精确匹配

### 积分未到账？
1. 检查订单状态是否为 "paid"
2. 检查 `credit_logs` 表是否有记录
3. 检查用户 `credits` 字段是否更新

### 订单显示"金额不匹配"？
用户转账金额与订单金额不完全一致，需要管理员手动确认。

---

## 8. 建议

1. **配置TronGrid API Key**：在Railway环境变量中添加 `TRONGRID_API_KEY`，启用自动监控功能。

2. **定期检查待处理订单**：即使有自动监控，也建议定期检查是否有需要人工处理的订单。

3. **保留交易记录**：所有充值操作都会记录日志，方便追溯问题。
