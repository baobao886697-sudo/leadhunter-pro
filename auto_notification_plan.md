# 自动通知集成方案

## 需要添加通知的 3 个入口

### 1. 充值自动到账（usdtMonitor.ts → confirmRechargeOrder）
- 位置: `server/services/usdtMonitor.ts` 的 `processTransaction()` 函数
- 当 `match.exactMatch` 为 true 且 `confirmRechargeOrder` 成功后
- 需要获取订单信息（order.credits, order.amount, order.userId）
- 也需要在 `confirmRechargeOrder` (db.ts:415) 中添加，因为手动确认也走这个函数

### 2. 手动确认订单（routers.ts:1164 confirmOrder）
- 也调用 `confirmRechargeOrder`，所以在 db.ts 的 confirmRechargeOrder 中统一添加即可

### 3. 管理员调整积分（routers.ts:1101 adjustCredits）
- 位置: `server/routers.ts` 的 `adjustCredits` mutation
- input.amount > 0 为增加，< 0 为扣除
- 有 input.reason 原因说明

### 4. 处理金额不匹配订单（routers.ts:1236 resolveMismatchOrder）
- 也调用 `addCredits`，但走的是 `resolveMismatchOrder` (db.ts:482)
- 也需要发送通知

## 最佳方案
在 `confirmRechargeOrder` 和 `resolveMismatchOrder` 函数中直接添加通知逻辑
在 `adjustCredits` 路由中添加通知逻辑
