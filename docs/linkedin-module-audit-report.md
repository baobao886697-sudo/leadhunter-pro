# LinkedIn 模块全面审查报告

**审查日期**: 2026-01-28  
**审查范围**: server/linkedin/ 模块及相关前后端代码  
**审查目的**: 确保前后端联动、功能运行逻辑、所有修改过的地方完整无误

---

## 一、模块文件结构审查

### 1.1 新模块目录结构

```
server/linkedin/
├── index.ts          # 模块入口，统一导出
├── router.ts         # 路由定义（363行）
├── db.ts             # 数据库操作（388行）
├── processor.ts      # 搜索处理器（1085行）
├── apify.ts          # 模糊搜索API（604行）
├── brightdata.ts     # 精准搜索API（413行）
├── pdl.ts            # PDL电话匹配
├── scraper.ts        # 电话验证
├── types.ts          # 类型定义
└── config.ts         # 配置常量（76行）
```

### 1.2 与旧模块对比

| 文件 | 旧位置 | 新位置 | 状态 |
|------|--------|--------|------|
| searchProcessorV3.ts | server/services/ | server/linkedin/processor.ts | ✅ 已迁移 |
| apify.ts | server/services/ | server/linkedin/apify.ts | ✅ 已迁移 |
| brightdata.ts | server/services/ | server/linkedin/brightdata.ts | ✅ 已迁移 |
| pdl.ts | server/services/ | server/linkedin/pdl.ts | ✅ 已迁移 |
| scraper.ts | server/services/ | server/linkedin/scraper.ts | ✅ 已迁移 |
| db.ts (积分函数) | server/db.ts | server/linkedin/db.ts | ✅ 已独立 |
| config.ts | 无（内嵌） | server/linkedin/config.ts | ✅ 新增 |
| types.ts | 无（内嵌） | server/linkedin/types.ts | ✅ 新增 |

---

## 二、预扣费机制审查

### 2.1 预扣费函数

**文件**: `server/linkedin/db.ts`

| 函数 | 功能 | 状态 |
|------|------|------|
| `freezeCredits()` | 预扣积分（冻结） | ✅ 正确实现 |
| `settleCredits()` | 结算积分（退还多扣部分） | ✅ 正确实现 |

### 2.2 预扣费调用点

**文件**: `server/linkedin/processor.ts`

| 行号 | 调用点 | 功能 | 状态 |
|------|--------|------|------|
| 400 | `freezeCredits()` | 任务开始前预扣 | ✅ 正确 |
| 589 | `settleCredits()` | 无结果时结算 | ✅ 正确 |
| 945 | `settleCredits()` | 任务完成时结算 | ✅ 正确 |
| 986 | `settleCredits()` | 任务失败时结算 | ✅ 正确 |

### 2.3 预扣费流程

```
用户提交搜索任务
    ↓
计算最大预估费用 = 搜索费 + (请求数量 × 单条费用)
    ↓
调用 freezeCredits() 预扣积分
    ↓ 成功
执行搜索任务（统计实际消耗，不再扣费）
    ↓
任务完成/失败
    ↓
调用 settleCredits() 结算，退还多扣的积分
```

---

## 三、模糊搜索 vs 精准搜索 审查

### 3.1 配置对比

**文件**: `server/linkedin/config.ts`

| 配置项 | 模糊搜索 (fuzzy) | 精准搜索 (exact) |
|--------|------------------|------------------|
| 搜索基础费 | 1 积分 | 5 积分 |
| 每条数据费 | 2 积分 | 10 积分 |
| 数据源 | Apify Leads Finder | BrightData + PDL |
| 支持缓存 | ✅ 是（180天） | ❌ 否 |
| 无结果退款 | ❌ 收取搜索费 | ✅ 全额退还 |

### 3.2 API调用对比

| 特性 | 模糊搜索 | 精准搜索 |
|------|----------|----------|
| API文件 | `apify.ts` | `brightdata.ts` |
| 主函数 | `apifySearchPeople()` | `brightdataSearchPeople()` |
| 缓存键前缀 | `search:fuzzy:` | `search:exact:` |
| 缓存检查 | ✅ 检查缓存 | ❌ 不检查 |

### 3.3 无结果处理

**文件**: `server/linkedin/processor.ts` (第573-600行)

```typescript
if (searchResults.length === 0) {
  if (mode === 'exact') {
    // 精准搜索无结果，实际消耗为0，退还全部预扣积分
    stats.creditsUsed = 0;
  } else {
    // 模糊搜索无结果，仍收取搜索基础费
    stats.creditsUsed = currentSearchCredits;
  }
  // 结算退还
  const settlement = await settleCredits(userId, frozenAmount, stats.creditsUsed, task.taskId);
}
```

**状态**: ✅ 正确实现

---

## 四、路由定义审查

### 4.1 新模块路由

**文件**: `server/linkedin/router.ts`

| 路由 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `creditsConfig` | query | 获取积分配置 | ✅ 正确 |
| `preview` | mutation | 预览搜索 | ✅ 正确 |
| `start` | mutation | 开始搜索 | ✅ 正确 |
| `taskStatus` | query | 获取任务状态 | ✅ 正确 |
| `tasks` | query | 获取任务列表 | ✅ 正确 |
| `results` | query | 获取搜索结果 | ✅ 正确 |
| `stop` | mutation | 停止任务 | ✅ 正确 |
| `exportCsv` | mutation | 导出CSV | ✅ 正确 |

### 4.2 与主路由对比

**新模块路由** (`linkedinRouter`) 与 **主路由** (`routers.ts` 中的 `search`) 功能完全一致。

---

## 五、前后端联动审查

### 5.1 前端调用

**文件**: `client/src/pages/Search.tsx`

| 前端调用 | 后端路由 | 状态 |
|----------|----------|------|
| `trpc.search.creditsConfig.useQuery()` | `search.creditsConfig` | ✅ 匹配 |
| `trpc.search.preview.useMutation()` | `search.preview` | ✅ 匹配 |
| `trpc.search.start.useMutation()` | `search.start` | ✅ 匹配 |

### 5.2 参数传递

| 参数 | 前端 | 后端 | 状态 |
|------|------|------|------|
| name | ✅ | ✅ | ✅ 一致 |
| title | ✅ | ✅ | ✅ 一致 |
| state | ✅ | ✅ | ✅ 一致 |
| limit | ✅ | ✅ | ✅ 一致 |
| ageMin | ✅ | ✅ | ✅ 一致 |
| ageMax | ✅ | ✅ | ✅ 一致 |
| mode | ✅ (fuzzy/exact) | ✅ (fuzzy/exact) | ✅ 一致 |
| enableVerification | ✅ | ✅ | ✅ 一致 |

---

## 六、发现的问题

### 6.1 新模块未启用

**问题**: 新创建的 `server/linkedin/` 模块目前还未被使用。前端调用的 `trpc.search.*` 仍然指向 `server/routers.ts` 中的旧路由，而旧路由调用的是 `server/services/searchProcessorV3.ts`。

**影响**: 新模块的代码不会被执行，预扣费机制实际上是在旧模块中实现的。

**建议**: 
1. 保持现状（旧模块已包含预扣费机制，功能正常）
2. 或者修改 `server/routers.ts`，将 `search` 路由替换为新模块的 `linkedinRouter`

### 6.2 函数命名差异

**问题**: 旧模块使用 `freezeCreditsLinkedIn` 和 `settleCreditsLinkedIn`，新模块使用 `freezeCredits` 和 `settleCredits`。

**影响**: 无功能影响，只是命名不同。

**状态**: ✅ 已处理（新模块使用简化命名）

---

## 七、审查结论

### 7.1 总体评估

| 评估项 | 状态 | 说明 |
|--------|------|------|
| 模块文件结构 | ✅ 正确 | 所有文件已正确创建 |
| 预扣费机制 | ✅ 正确 | 预扣、结算、退还逻辑完整 |
| 模糊搜索逻辑 | ✅ 正确 | 缓存、API调用、费用计算正确 |
| 精准搜索逻辑 | ✅ 正确 | 无缓存、无结果退款正确 |
| 路由定义 | ✅ 正确 | 与主路由功能一致 |
| 前后端联动 | ✅ 正确 | 参数传递一致 |
| TypeScript编译 | ✅ 通过 | 无新增错误 |

### 7.2 当前运行状态

**当前生产环境使用的是旧模块** (`server/services/searchProcessorV3.ts`)，预扣费机制已在旧模块中实现并正常工作。

**新模块** (`server/linkedin/`) 已创建完成，可以随时切换启用。

### 7.3 建议

1. **短期**: 保持现状，旧模块功能正常
2. **中期**: 在测试环境验证新模块后，切换到新模块
3. **长期**: 删除旧模块文件，完全使用新的独立模块

---

## 八、修改记录

| 日期 | 文件 | 修改内容 |
|------|------|----------|
| 2026-01-28 | server/linkedin/db.ts | 新增 freezeCredits, settleCredits 函数 |
| 2026-01-28 | server/linkedin/processor.ts | 实现预扣费机制 |
| 2026-01-28 | server/linkedin/config.ts | 新增配置常量文件 |
| 2026-01-28 | server/linkedin/types.ts | 新增类型定义文件 |
| 2026-01-28 | server/linkedin/router.ts | 新增独立路由文件 |
| 2026-01-28 | server/linkedin/index.ts | 新增模块入口文件 |
| 2026-01-28 | server/services/searchProcessorV3.ts | 实现预扣费机制（旧模块） |
| 2026-01-28 | server/db.ts | 新增 freezeCreditsLinkedIn, settleCreditsLinkedIn 函数 |

---

**审查完成**
