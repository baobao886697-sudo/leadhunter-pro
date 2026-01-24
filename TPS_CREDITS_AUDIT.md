# TPS 积分扣除系统审计报告

## 审计时间
2026-01-24

## 一、积分扣除代码逻辑分析

### 1.1 费用配置
```typescript
// 从数据库配置获取
const searchCost = parseFloat(config.searchCost);  // 搜索页单价
const detailCost = parseFloat(config.detailCost);  // 详情页单价
```

**默认值：**
- `searchCost` = 0.3 积分/页
- `detailCost` = 0.3 积分/页

### 1.2 积分扣除公式

```
实际消耗 = (搜索页数 × 搜索页单价) + (详情页数 × 详情页单价)
actualCost = totalSearchPages × searchCost + totalDetailPages × detailCost
```

**代码位置：** router.ts 第 660 行
```typescript
const actualCost = totalSearchPages * searchCost + totalDetailPages * detailCost;
```

### 1.3 积分扣除流程

```
1. 任务提交时
   └── 检查积分是否足够最大预估消耗
   
2. 搜索阶段完成后
   └── 再次检查积分是否足够详情阶段
   └── 如果不足，只扣搜索页费用并终止
   
3. 任务完成时
   └── 计算实际消耗 = 搜索页 × 0.3 + 详情页 × 0.3
   └── 扣除积分
   └── 记录日志
```

### 1.4 关键代码审查

#### 任务完成时的扣费（router.ts 第 660-666 行）
```typescript
// 计算实际消耗
const actualCost = totalSearchPages * searchCost + totalDetailPages * detailCost;

// 扣除积分
if (actualCost > 0) {
  await deductCredits(userId, actualCost, `TPS搜索 [${taskId}]`);
  await logCreditChange(userId, -actualCost, "search", `TPS搜索任务 ${taskId}`, taskId);
}
```

#### 提前终止时的扣费（router.ts 第 556-559 行）
```typescript
// 只扣除已完成的搜索页费用
if (searchPageCostSoFar > 0) {
  await deductCredits(userId, searchPageCostSoFar, `TPS搜索[提前终止] [${taskId}]`);
  await logCreditChange(userId, -searchPageCostSoFar, "search", `TPS搜索任务[提前终止] ${taskId}`, taskId);
}
```

## 二、历史任务数据验证

### 待验证任务列表

| 任务 ID | 搜索页 | 详情页 | 缓存命中 | 显示消耗 | 理论消耗 | 差异 |
|---------|--------|--------|----------|----------|----------|------|
| | | | | | | |

## 三、潜在问题分析

### 3.1 缓存命中是否扣费？

**问题：** 当详情页从缓存获取时，是否仍然扣费？

**代码分析：**
- `totalDetailPages` 统计的是**实际 API 请求数**，不包括缓存命中
- 缓存命中记录在 `totalCacheHits` 中

**结论：** ✅ 缓存命中不扣费，这是正确的

### 3.2 搜索页失败是否扣费？

**问题：** 如果搜索页请求失败（如 502 错误），是否仍然扣费？

**代码分析：**
- `totalSearchPages` 在 `searchOnly` 函数中统计
- 需要检查是否只统计成功的请求

**待验证**

### 3.3 详情页失败是否扣费？

**问题：** 如果详情页请求失败，是否仍然扣费？

**代码分析：**
- `totalDetailPages` 在 `fetchDetailsInBatch` 函数中统计
- 需要检查是否只统计成功的请求

**待验证**

## 四、搜索时间分析

### 待分析数据

| 任务 ID | 开始时间 | 完成时间 | 总耗时 | 搜索页数 | 详情页数 | 平均速度 |
|---------|----------|----------|--------|----------|----------|----------|
| | | | | | | |

