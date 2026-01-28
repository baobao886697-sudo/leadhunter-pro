# LinkedIn 搜索模块代码分析报告

## 1. 代码文件分布

### 1.1 核心文件

| 文件路径 | 行数 | 功能描述 |
|----------|------|----------|
| `server/services/searchProcessorV3.ts` | 1085 | 核心搜索处理器，包含预览、执行、验证逻辑 |
| `server/services/apify.ts` | 604 | Apify API调用（模糊搜索数据源） |
| `server/services/brightdata.ts` | 413 | BrightData API调用（精准搜索数据源） |
| `server/services/pdl.ts` | - | People Data Labs API（电话号码丰富） |
| `server/services/scraper.ts` | - | 电话验证服务 |

### 1.2 路由文件

| 文件路径 | 相关行号 | 功能描述 |
|----------|----------|----------|
| `server/routers.ts` | 351-665 | search路由定义（约315行） |

### 1.3 数据库文件

| 文件路径 | 相关函数 | 功能描述 |
|----------|----------|----------|
| `server/db.ts` | 多个函数 | 搜索任务、结果、积分、缓存操作 |

---

## 2. 模糊搜索 vs 精准搜索 详细对比

### 2.1 数据源差异

| 特性 | 模糊搜索 (fuzzy) | 精准搜索 (exact) |
|------|------------------|------------------|
| **数据源** | Apify Leads Finder | BrightData + PDL |
| **API文件** | `apify.ts` | `brightdata.ts` + `pdl.ts` |
| **搜索方式** | 按职位+地区批量获取 | 按关键词精准匹配 |
| **缓存策略** | 支持缓存（180天） | 不支持缓存 |
| **数据标记** | `source: 'apify'` | `source: 'brightdata'` |

### 2.2 积分配置差异

| 配置项 | 模糊搜索 | 精准搜索 |
|--------|----------|----------|
| **搜索基础费** | `FUZZY_SEARCH_CREDITS` (默认1) | `EXACT_SEARCH_CREDITS` (默认5) |
| **每条数据费** | `FUZZY_CREDITS_PER_PERSON` (默认2) | `EXACT_CREDITS_PER_PERSON` (默认10) |

### 2.3 代码中的模式判断位置

```typescript
// searchProcessorV3.ts 第357-358行
const currentSearchCredits = mode === 'fuzzy' ? creditsConfig.fuzzySearchCredits : creditsConfig.exactSearchCredits;
const currentPhoneCreditsPerPerson = mode === 'fuzzy' ? creditsConfig.fuzzyCreditsPerPerson : creditsConfig.exactCreditsPerPerson;

// 第412-413行
dataSource: mode === 'fuzzy' ? 'apify' : 'brightdata',
mode

// 第508行 - 缓存只用于模糊搜索
const cached = mode === 'fuzzy' ? await getCacheByKey(cacheKey) : null;

// 第549-589行 - API调用分支
if (mode === 'fuzzy') {
  // 调用 apifySearchPeople
} else {
  // 调用 brightdataSearchPeople
}

// 第732行, 818行 - 数据来源标记
dataSource: mode === 'fuzzy' ? 'apify' : 'brightdata',
```

### 2.4 特殊处理差异

| 场景 | 模糊搜索 | 精准搜索 |
|------|----------|----------|
| **无结果时** | 不退还搜索费 | 退还搜索费（第598-614行） |
| **缓存命中** | 跳过API调用 | 不使用缓存 |
| **日志标记** | `[模糊搜索]` | `[精准搜索]` |

---

## 3. 当前积分扣费流程分析

### 3.1 扣费时间线

```
1. 任务提交 (routers.ts 第416-439行)
   └── 检查积分是否足够总预估费用
   
2. 预扣费 (searchProcessorV3.ts 第419-424行) [已实现]
   └── freezeCreditsLinkedIn(userId, maxEstimatedCost, taskId)
   
3. 搜索费扣除 (searchProcessorV3.ts 第496-502行) [需要移除]
   └── deductCredits(userId, currentSearchCredits, 'search', ...)
   
4. 数据费扣除 (searchProcessorV3.ts 第640-655行) [需要移除]
   └── deductCredits(userId, dataCreditsNeeded, 'search', ...)
   
5. API积分耗尽退款 (searchProcessorV3.ts 第920-933行) [需要调整]
   └── 直接操作数据库退款
   
6. 任务完成 [需要添加结算]
   └── 目前没有调用 settleCreditsLinkedIn
```

### 3.2 问题分析

**问题1：双重扣费**
- 预扣费已经扣除了最大预估费用
- 但第496-502行又扣除了搜索费
- 第640-655行又扣除了数据费
- 导致用户被扣了两倍的费用

**问题2：没有结算退还**
- 任务完成后没有调用 `settleCreditsLinkedIn`
- 预扣的积分没有退还多扣的部分

**问题3：失败时没有退款**
- catch块（第1019-1041行）没有退还预扣的积分

---

## 4. 数据库函数依赖

### 4.1 搜索相关函数（db.ts）

| 函数名 | 行号 | 用途 |
|--------|------|------|
| `createSearchTask` | 489 | 创建搜索任务 |
| `getSearchTask` | 497 | 获取搜索任务 |
| `updateSearchTask` | 504 | 更新搜索任务 |
| `updateSearchTaskStatus` | 568 | 更新任务状态 |
| `getUserSearchTasks` | 574 | 获取用户任务列表 |
| `saveSearchResult` | 585 | 保存搜索结果 |
| `getSearchResults` | 597 | 获取搜索结果 |
| `updateSearchResult` | 603 | 更新搜索结果 |

### 4.2 积分相关函数（db.ts）

| 函数名 | 行号 | 用途 |
|--------|------|------|
| `deductCredits` | 163 | 扣除积分 |
| `addCredits` | 178 | 添加积分 |
| `freezeCreditsLinkedIn` | 197 | 预扣积分（已添加） |
| `settleCreditsLinkedIn` | 247 | 结算积分（已添加） |
| `getCreditLogs` | 288 | 获取积分日志 |

### 4.3 缓存相关函数（db.ts）

| 函数名 | 行号 | 用途 |
|--------|------|------|
| `setCache` | 701 | 设置缓存 |
| `getCacheByKey` | - | 获取缓存 |
| `getCacheStats` | 708 | 获取缓存统计 |

---

## 5. 路由依赖分析

### 5.1 search路由（routers.ts 第351-665行）

| 路由名 | 类型 | 调用的函数 |
|--------|------|------------|
| `creditsConfig` | query | `getSearchCreditsConfig()` |
| `preview` | mutation | `previewSearch()` |
| `start` | mutation | `executeSearchV3()` |
| `taskStatus` | query | `getSearchTask()` |
| `tasks` | query | `getUserSearchTasks()` |
| `results` | query | `getSearchResults()` |
| `stop` | mutation | `updateSearchTaskStatus()` |
| `exportCsv` | mutation | `getSearchResults()` |

---

## 6. 模块化剥离方案

### 6.1 目标目录结构

```
server/linkedin/
├── index.ts           # 模块入口，导出所有公共函数
├── router.ts          # LinkedIn搜索路由
├── db.ts              # LinkedIn相关数据库操作
├── processor.ts       # 搜索处理器（原searchProcessorV3.ts）
├── apify.ts           # Apify API服务
├── brightdata.ts      # BrightData API服务
├── pdl.ts             # PDL API服务
├── scraper.ts         # 电话验证服务
└── types.ts           # 类型定义
```

### 6.2 需要迁移的代码

| 源文件 | 目标文件 | 迁移内容 |
|--------|----------|----------|
| `server/services/searchProcessorV3.ts` | `server/linkedin/processor.ts` | 全部内容 |
| `server/services/apify.ts` | `server/linkedin/apify.ts` | 全部内容 |
| `server/services/brightdata.ts` | `server/linkedin/brightdata.ts` | 全部内容 |
| `server/services/pdl.ts` | `server/linkedin/pdl.ts` | 全部内容 |
| `server/services/scraper.ts` | `server/linkedin/scraper.ts` | 电话验证相关 |
| `server/routers.ts` | `server/linkedin/router.ts` | search路由（351-665行） |
| `server/db.ts` | `server/linkedin/db.ts` | 搜索相关函数 |

### 6.3 需要修改的导入

| 文件 | 修改内容 |
|------|----------|
| `server/routers.ts` | 导入 `linkedinRouter` 并挂载 |
| `server/_core/index.ts` | 更新导入路径 |

---

## 7. 风险评估

### 7.1 高风险点

1. **数据库函数共享**：`db.ts` 中的函数被多个模块使用，需要谨慎处理
2. **类型定义依赖**：`LeadPerson` 等类型被多处引用
3. **缓存键格式**：缓存键格式必须保持一致，否则会导致缓存失效

### 7.2 中风险点

1. **路由挂载**：需要确保路由路径不变
2. **环境变量**：API Token 的读取方式需要保持一致
3. **日志格式**：日志格式变化可能影响监控

### 7.3 低风险点

1. **文件移动**：纯粹的文件移动风险较低
2. **导入路径更新**：IDE 可以自动处理

---

## 8. 建议方案

### 方案A：完整模块化（工作量大，风险中等）
- 创建 `server/linkedin/` 目录
- 迁移所有相关文件
- 更新所有导入路径
- 预计工作量：2-3小时

### 方案B：仅完成预扣费修改（工作量小，风险低）✅ 推荐
- 在现有代码基础上完成预扣费机制
- 移除双重扣费
- 添加结算退还逻辑
- 预计工作量：30分钟

### 方案C：渐进式重构（工作量中等，风险低）
- 先完成预扣费修改
- 后续逐步迁移文件
- 每次迁移后测试验证

---

## 9. 当前需要修改的代码

### 9.1 移除双重扣费（searchProcessorV3.ts）

**删除第496-502行**：
```typescript
// 删除这段代码
currentStep++;
addLog(`💳 正在扣除搜索基础费用...`, 'info', 'init', '');
const modeLabel = mode === 'fuzzy' ? '模糊搜索' : '精准搜索';
const searchDeducted = await deductCredits(userId, currentSearchCredits, 'search', `[${modeLabel}] ${searchName} | ${searchTitle} | ${searchState}`, task.taskId);
if (!searchDeducted) throw new Error('扣除搜索积分失败');
stats.creditsUsed += currentSearchCredits;
addLog(`✅ 已扣除搜索费用: ${currentSearchCredits} 积分`, 'success', 'init', '✅');
await updateProgress('扣除搜索积分', undefined, undefined, 20);
```

**删除第640-655行**：
```typescript
// 删除这段代码
addLog(`💳 正在扣除数据费用...`, 'info', 'process', '');
const dataDeducted = await deductCredits(
  userId, 
  dataCreditsNeeded, 
  'search', 
  `[${modeLabel}] 数据费用: ${actualCount} 条 × ${currentPhoneCreditsPerPerson} 积分`, 
  task.taskId
);
// ... 后续代码
```

### 9.2 添加结算逻辑（searchProcessorV3.ts）

**在任务完成时（约第1006行前）添加**：
```typescript
// 计算实际消耗
const actualCost = stats.creditsUsed;

// 结算退还
const settlement = await settleCreditsLinkedIn(userId, frozenAmount, actualCost, task.taskId);

// 更新日志
addLog(`💰 费用结算:`);
addLog(`   • 预扣积分: ${frozenAmount} 积分`);
addLog(`   • 实际消耗: ${actualCost} 积分`);
if (settlement.refundAmount > 0) {
  addLog(`   • ✅ 已退还: ${settlement.refundAmount} 积分`);
}
addLog(`   • 当前余额: ${settlement.newBalance} 积分`);
```

### 9.3 添加失败退款（searchProcessorV3.ts）

**在catch块（约第1019行后）添加**：
```typescript
// 失败时结算退还
const settlement = await settleCreditsLinkedIn(userId, frozenAmount, stats.creditsUsed, task.taskId);
addLog(`💰 失败结算: 已退还 ${settlement.refundAmount} 积分`);
```

---

## 10. 结论

**建议采用方案B**：先在现有代码基础上完成预扣费机制的修改，确保功能正常后，再考虑模块化重构。

**原因**：
1. 当前代码已经添加了预扣费函数，但没有正确使用
2. 存在双重扣费问题，需要紧急修复
3. 模块化重构可以后续进行，不影响当前功能
