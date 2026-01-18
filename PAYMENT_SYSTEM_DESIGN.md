# 云端寻踪 Pro 2.0 支付系统升级方案

## 一、功能需求

### 1. 后台支付管理控制台
- 钱包余额实时查询（USDT/TRX）
- 最近交易记录查看
- 订单手动确认（输入交易哈希）
- 自动支付检测状态

### 2. 用户端支付信息展示
- 详细的账单信息展示
- 收款地址二维码
- 支付倒计时
- 订单状态实时更新

### 3. 账单保存功能
- 导出账单为图片
- 复制账单文本
- 账单分享功能

## 二、技术实现

### 2.1 新增API路由

```typescript
// server/routers.ts 新增

// TRC20支付检查路由
trc20: router({
  // 检查钱包余额
  getWalletBalance: adminProcedure.query(),
  
  // 获取最近交易
  getRecentTransfers: adminProcedure.query(),
  
  // 手动检查支付
  checkPayment: adminProcedure.mutation(),
})
```

### 2.2 新增页面

1. **PaymentDetail.tsx** - 用户支付详情页（带账单导出）
2. **Admin.tsx 增强** - 添加钱包监控面板

### 2.3 数据库无需修改
现有的 recharge_orders 表已满足需求

## 三、实现步骤

1. 添加TRC20 API路由
2. 创建用户支付详情页
3. 增强管理后台钱包监控
4. 添加账单导出功能
5. 测试部署
