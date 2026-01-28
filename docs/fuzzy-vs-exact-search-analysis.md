# 模糊搜索 vs 精准搜索 详细对比分析报告

## 1. 前端参数对比

### 1.1 搜索表单参数（Search.tsx）

| 参数名 | 类型 | 模糊搜索 | 精准搜索 | 说明 |
|--------|------|----------|----------|------|
| `name` | string | ✅ 必填 | ✅ 必填 | 姓名关键词 |
| `title` | string | ✅ 必填 | ✅ 必填 | 职位关键词 |
| `state` | string | ✅ 必填 | ✅ 必填 | 美国州名 |
| `limit` | number | ✅ 10-10000 | ✅ 10-10000 | 请求数量 |
| `ageMin` | number | ✅ 可选 | ✅ 可选 | 最小年龄 |
| `ageMax` | number | ✅ 可选 | ✅ 可选 | 最大年龄 |
| `enableVerification` | boolean | ✅ 默认true | ✅ 默认true | 电话验证 |
| `mode` | 'fuzzy' \| 'exact' | 'fuzzy' | 'exact' | 搜索模式 |

### 1.2 积分配置（前端默认值）

```typescript
// Search.tsx 第40-44行
const DEFAULT_FUZZY_SEARCH_COST = 1;           // 模糊搜索基础费
const DEFAULT_FUZZY_PHONE_COST_PER_PERSON = 2; // 模糊搜索每条数据费
const DEFAULT_EXACT_SEARCH_COST = 5;           // 精准搜索基础费
const DEFAULT_EXACT_PHONE_COST_PER_PERSON = 10; // 精准搜索每条数据费
```

### 1.3 积分计算逻辑（前端）

```typescript
// Search.tsx 第171-191行
const creditEstimate = useMemo(() => {
  const searchCost = searchMode === 'fuzzy' ? FUZZY_SEARCH_COST : EXACT_SEARCH_COST;
  const phoneCostPerPerson = searchMode === 'fuzzy' ? FUZZY_PHONE_COST_PER_PERSON : EXACT_PHONE_COST_PER_PERSON;
  const phoneCost = searchLimit * phoneCostPerPerson;
  const totalCost = searchCost + phoneCost;
  // ...
}, [searchLimit, profile?.credits, searchMode]);
```

---

## 2. 后端参数对比

### 2.1 路由定义（routers.ts）

| 路由 | 参数验证 | 模糊搜索 | 精准搜索 |
|------|----------|----------|----------|
| `search.preview` | `mode: z.enum(["fuzzy", "exact"]).default("fuzzy")` | ✅ | ✅ |
| `search.start` | `mode: z.enum(["fuzzy", "exact"]).default("fuzzy")` | ✅ | ✅ |

### 2.2 积分配置获取（routers.ts 第416-424行）

```typescript
const creditsConfig = await getSearchCreditsConfig();
const searchCost = input.mode === 'exact' 
  ? creditsConfig.exactSearchCredits 
  : creditsConfig.fuzzySearchCredits;
const phoneCostPerPerson = input.mode === 'exact' 
  ? creditsConfig.exactCreditsPerPerson 
  : creditsConfig.fuzzyCreditsPerPerson;
```

### 2.3 搜索处理器参数（searchProcessorV3.ts）

| 参数 | 类型 | 传递位置 |
|------|------|----------|
| `userId` | number | 第1个参数 |
| `searchName` | string | 第2个参数 |
| `searchTitle` | string | 第3个参数 |
| `searchState` | string | 第4个参数 |
| `requestedCount` | number | 第5个参数 |
| `ageMin` | number \| undefined | 第6个参数 |
| `ageMax` | number \| undefined | 第7个参数 |
| `enableVerification` | boolean | 第8个参数 |
| `mode` | 'fuzzy' \| 'exact' | 第9个参数 |

---

## 3. API调用差异

### 3.1 模糊搜索 - Apify

```typescript
// searchProcessorV3.ts 第548-576行
if (mode === 'fuzzy') {
  stats.apifyApiCalls++;
  addLog(`🔍 正在调用 LinkedIn Leads Finder (Apify)...`, 'info', 'search', '');
  
  const apifyResult = await apifySearchPeople(
    searchName, 
    searchTitle, 
    searchState, 
    requestedCount, 
    userId
  );
  
  searchResults = apifyResult.people;
  
  // 缓存结果（180天有效）
  await setCache(cacheKey, 'search', newCacheData, 180);
}
```

**Apify API 特点：**
- 数据源：LinkedIn Leads Finder
- 缓存：✅ 支持（180天）
- 返回格式：`LeadPerson[]`
- 数据标记：`source: 'apify'`

### 3.2 精准搜索 - BrightData + PDL

```typescript
// searchProcessorV3.ts 第577-588行
else {
  addLog(`🎯 正在执行精准搜索 (Bright Data + PDL)...`, 'info', 'search', '');
  
  searchResults = await brightdataSearchPeople(
    searchName, 
    searchTitle, 
    searchState, 
    requestedCount
  );
}
```

**BrightData API 特点：**
- 数据源：BrightData LinkedIn Scraper + PDL
- 缓存：❌ 不支持
- 返回格式：`LeadPerson[]`
- 数据标记：`source: 'brightdata'`

---

## 4. 特殊处理差异

### 4.1 无结果时的处理

| 场景 | 模糊搜索 | 精准搜索 |
|------|----------|----------|
| 无结果 | 不退还搜索费 | ✅ 退还搜索费 |

```typescript
// searchProcessorV3.ts 第593-618行
if (searchResults.length === 0) {
  // 精准搜索无结果时，退还搜索基础费用
  if (mode === 'exact') {
    addLog(`💰 精准搜索无结果，正在退还搜索费用...`, 'info', 'complete', '');
    const refunded = await deductCredits(
      userId, 
      -currentSearchCredits, // 负数表示退还
      'refund', 
      `精准搜索无结果退款: ${searchName} | ${searchTitle} | ${searchState}`, 
      task.taskId
    );
    if (refunded) {
      stats.creditsUsed -= currentSearchCredits;
    }
  }
}
```

### 4.2 缓存策略

| 场景 | 模糊搜索 | 精准搜索 |
|------|----------|----------|
| 缓存键格式 | `search:fuzzy:{hash}` | `search:exact:{hash}` |
| 缓存读取 | ✅ 读取缓存 | ❌ 跳过缓存 |
| 缓存写入 | ✅ 写入缓存 | ❌ 不写入 |
| 缓存有效期 | 180天 | N/A |

```typescript
// searchProcessorV3.ts 第505-508行
const cacheKey = `search:${mode}:${searchHash}`;
const cached = mode === 'fuzzy' ? await getCacheByKey(cacheKey) : null;
```

### 4.3 数据来源标记

```typescript
// searchProcessorV3.ts 第412-413行（任务创建时）
dataSource: mode === 'fuzzy' ? 'apify' : 'brightdata',
mode

// searchProcessorV3.ts 第732行, 818行（结果保存时）
dataSource: mode === 'fuzzy' ? 'apify' : 'brightdata',
```

---

## 5. 预扣费机制对比

### 5.1 预扣费计算（已实现）

```typescript
// searchProcessorV3.ts 第394-401行
// 计算最大预估费用（搜索费 + 最大数据费）
const maxEstimatedCost = currentSearchCredits + requestedCount * currentPhoneCreditsPerPerson;

// 检查积分是否足够
if (user.credits < maxEstimatedCost) {
  throw new Error(`积分不足，预估最大消耗 ${maxEstimatedCost} 积分...`);
}
```

### 5.2 结算退还（已实现）

| 场景 | 模糊搜索 | 精准搜索 |
|------|----------|----------|
| 任务完成 | ✅ 结算退还 | ✅ 结算退还 |
| 任务失败 | ✅ 结算退还 | ✅ 结算退还 |
| API耗尽 | ✅ 更新统计 | ✅ 更新统计 |

---

## 6. 前后端参数一致性检查

### 6.1 积分配置一致性

| 配置项 | 前端默认值 | 后端配置键 | 一致性 |
|--------|------------|------------|--------|
| 模糊搜索费 | 1 | `FUZZY_SEARCH_CREDITS` | ✅ |
| 模糊数据费 | 2 | `FUZZY_CREDITS_PER_PERSON` | ✅ |
| 精准搜索费 | 5 | `EXACT_SEARCH_CREDITS` | ✅ |
| 精准数据费 | 10 | `EXACT_CREDITS_PER_PERSON` | ✅ |

### 6.2 参数传递一致性

| 参数 | 前端发送 | 后端接收 | 处理器接收 | 一致性 |
|------|----------|----------|------------|--------|
| name | ✅ | ✅ | ✅ | ✅ |
| title | ✅ | ✅ | ✅ | ✅ |
| state | ✅ | ✅ | ✅ | ✅ |
| limit | ✅ | ✅ | ✅ | ✅ |
| ageMin | ✅ | ✅ | ✅ | ✅ |
| ageMax | ✅ | ✅ | ✅ | ✅ |
| enableVerification | ✅ | ✅ | ✅ | ✅ |
| mode | ✅ | ✅ | ✅ | ✅ |

---

## 7. 问题发现与修复建议

### 7.1 已发现问题

**问题1：精准搜索无结果退款逻辑需要调整**

当前代码在预扣费机制下，精准搜索无结果时仍然调用 `deductCredits` 退款，但预扣费机制下应该通过 `settleCreditsLinkedIn` 统一结算。

```typescript
// 当前代码（searchProcessorV3.ts 第598-612行）
if (mode === 'exact') {
  const refunded = await deductCredits(
    userId, 
    -currentSearchCredits, // 这里的退款逻辑需要调整
    'refund', 
    ...
  );
}
```

**修复建议**：在预扣费机制下，精准搜索无结果时应该将 `stats.creditsUsed` 设为0，然后通过结算机制退还全部预扣积分。

### 7.2 需要修复的代码

```typescript
// 修复后的代码
if (searchResults.length === 0) {
  if (mode === 'exact') {
    addLog(`💰 精准搜索无结果，将退还全部预扣积分`, 'info', 'complete', '');
    stats.creditsUsed = 0; // 设为0，结算时会退还全部预扣积分
  }
  
  // 结算退还
  const settlement = await settleCreditsLinkedIn(userId, frozenAmount, stats.creditsUsed, task.taskId);
  // ...
}
```

---

## 8. 总结

### 8.1 模糊搜索特点
- 数据源：Apify LinkedIn Leads Finder
- 积分：搜索费1 + 数据费2/条
- 缓存：✅ 支持（180天）
- 无结果：不退还搜索费

### 8.2 精准搜索特点
- 数据源：BrightData + PDL
- 积分：搜索费5 + 数据费10/条
- 缓存：❌ 不支持
- 无结果：✅ 退还搜索费

### 8.3 一致性确认
- ✅ 前后端参数传递一致
- ✅ 积分配置一致
- ✅ 搜索模式判断一致
- ⚠️ 精准搜索无结果退款逻辑需要调整
