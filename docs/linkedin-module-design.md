# LinkedIn 模块化架构设计方案

## 一、设计目标

1. **独立模块**：创建 `server/linkedin/` 目录，包含所有LinkedIn搜索相关代码
2. **清晰分离**：模糊搜索和精准搜索逻辑清晰分离，但共享通用组件
3. **向后兼容**：保持前端调用路径不变，确保无缝迁移
4. **易于维护**：参考TPS和Anywho模块结构，便于后期修改

## 二、目标目录结构

```
server/linkedin/
├── index.ts          # 模块入口，导出router
├── router.ts         # 路由定义（search相关的所有路由）
├── db.ts             # 数据库操作（搜索任务、结果、积分）
├── processor.ts      # 搜索处理器（核心搜索逻辑）
├── apify.ts          # Apify API（模糊搜索数据源）
├── brightdata.ts     # BrightData API（精准搜索数据源）
├── types.ts          # 类型定义
└── config.ts         # 配置常量
```

## 三、文件迁移计划

### 3.1 新建文件

| 文件 | 来源 | 说明 |
|------|------|------|
| `linkedin/index.ts` | 新建 | 模块入口 |
| `linkedin/types.ts` | 从各文件提取 | 统一类型定义 |
| `linkedin/config.ts` | 从各文件提取 | 配置常量 |

### 3.2 迁移文件

| 目标文件 | 来源文件 | 说明 |
|----------|----------|------|
| `linkedin/processor.ts` | `services/searchProcessorV3.ts` | 核心搜索处理器 |
| `linkedin/apify.ts` | `services/apify.ts` | 模糊搜索API |
| `linkedin/brightdata.ts` | `services/brightdata.ts` | 精准搜索API |
| `linkedin/router.ts` | `routers.ts` (351-665行) | search路由 |
| `linkedin/db.ts` | `db.ts` (部分函数) | 搜索相关数据库操作 |

### 3.3 需要迁移的数据库函数

从 `server/db.ts` 迁移到 `server/linkedin/db.ts`：

- `createSearchTask()`
- `updateSearchTaskProgress()`
- `completeSearchTask()`
- `failSearchTask()`
- `saveSearchResults()`
- `getSearchTask()`
- `getUserSearchTasks()`
- `getSearchResults()`
- `freezeCreditsLinkedIn()`
- `settleCreditsLinkedIn()`

## 四、模糊搜索 vs 精准搜索 架构

### 4.1 共享组件

```typescript
// linkedin/processor.ts
export async function executeSearch(params: SearchParams) {
  if (params.searchMode === 'fuzzy') {
    return executeFuzzySearch(params);
  } else {
    return executeExactSearch(params);
  }
}
```

### 4.2 差异处理

| 组件 | 模糊搜索 | 精准搜索 |
|------|----------|----------|
| 数据源 | `apify.ts` | `brightdata.ts` |
| 积分配置 | `FUZZY_SEARCH_COST`, `FUZZY_DATA_COST` | `EXACT_SEARCH_COST`, `EXACT_DATA_COST` |
| 缓存 | 支持（180天） | 不支持 |
| 无结果退款 | 不退还搜索费 | 退还全部 |

## 五、迁移步骤

### 步骤1：创建目录和基础文件
```bash
mkdir -p server/linkedin
touch server/linkedin/{index,router,db,processor,apify,brightdata,types,config}.ts
```

### 步骤2：迁移类型定义
- 从各文件提取类型定义到 `types.ts`
- 更新导入路径

### 步骤3：迁移配置常量
- 从各文件提取配置常量到 `config.ts`

### 步骤4：迁移数据库操作
- 从 `db.ts` 复制搜索相关函数到 `linkedin/db.ts`
- 保留原文件中的函数（向后兼容）
- 更新 `linkedin/db.ts` 中的导入路径

### 步骤5：迁移API文件
- 复制 `services/apify.ts` 到 `linkedin/apify.ts`
- 复制 `services/brightdata.ts` 到 `linkedin/brightdata.ts`
- 更新导入路径

### 步骤6：迁移搜索处理器
- 复制 `services/searchProcessorV3.ts` 到 `linkedin/processor.ts`
- 更新导入路径

### 步骤7：迁移路由
- 从 `routers.ts` 提取 search 路由到 `linkedin/router.ts`
- 在 `routers.ts` 中导入并挂载 `linkedinRouter`

### 步骤8：测试验证
- TypeScript编译检查
- 功能测试

## 六、风险控制

### 6.1 向后兼容策略

1. **保留原文件**：不删除 `services/` 下的原文件，只标记为废弃
2. **保留原函数**：`db.ts` 中的函数保留，新模块使用新路径
3. **路由挂载**：在 `routers.ts` 中使用相同的路由路径

### 6.2 回滚方案

如果迁移出现问题：
1. 恢复 `routers.ts` 中的原始 search 路由
2. 删除 `server/linkedin/` 目录
3. 代码回滚到迁移前的commit

## 七、预估工作量

| 步骤 | 预估时间 |
|------|----------|
| 创建目录和基础文件 | 5分钟 |
| 迁移类型定义 | 15分钟 |
| 迁移配置常量 | 10分钟 |
| 迁移数据库操作 | 20分钟 |
| 迁移API文件 | 15分钟 |
| 迁移搜索处理器 | 30分钟 |
| 迁移路由 | 20分钟 |
| 测试验证 | 15分钟 |
| **总计** | **约2小时** |
