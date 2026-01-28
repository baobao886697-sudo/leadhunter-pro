# LinkedIn 精准搜索代码全面检查报告

**检查日期**: 2026-01-28  
**检查范围**: LinkedIn精准搜索模块的所有代码和运行逻辑  
**检查方式**: 代码静态分析（不进行实际搜索测试）

---

## 一、模块架构概览

LinkedIn搜索模块采用模块化架构，包含以下核心文件：

| 文件 | 功能 | 状态 |
|------|------|------|
| `router.ts` | 路由定义和API入口 | ✅ 正常 |
| `processor.ts` | 搜索处理器（核心逻辑） | ✅ 正常 |
| `brightdata.ts` | BrightData API调用 | ✅ 正常 |
| `pdl.ts` | People Data Labs 数据丰富 | ✅ 正常 |
| `db.ts` | 数据库操作（积分、任务、缓存） | ✅ 正常 |
| `config.ts` | 配置常量 | ✅ 正常 |
| `scraper.ts` | 电话验证（TPS/FPS） | ✅ 正常 |
| `apify.ts` | Apify API调用（模糊搜索） | ✅ 正常 |

---

## 二、精准搜索流程分析

### 2.1 搜索入口 (router.ts)

```
用户请求 → preview → start → executeSearchV3
```

**检查结果**: ✅ 正常

- `mode` 参数支持 `fuzzy` 和 `exact` 两种模式
- 积分检查在搜索开始前执行
- 正确传递所有参数到 `executeSearchV3`

### 2.2 预扣费机制 (processor.ts + db.ts)

**流程**:
1. 计算最大预估费用: `searchCredits + requestedCount × creditsPerPerson`
2. 检查用户积分是否足够
3. 调用 `freezeCredits()` 预扣积分
4. 执行搜索任务
5. 任务完成后调用 `settleCredits()` 结算退还

**检查结果**: ✅ 正常

**关键代码验证**:
```typescript
// processor.ts 第376-404行
const maxEstimatedCost = currentSearchCredits + requestedCount * currentPhoneCreditsPerPerson;

if (user.credits < maxEstimatedCost) {
  throw new Error(`积分不足...`);
}

const freezeResult = await freezeCredits(userId, maxEstimatedCost, task.taskId);
```

### 2.3 精准搜索与模糊搜索的差异

| 特性 | 模糊搜索 (Apify) | 精准搜索 (BrightData) |
|------|------------------|----------------------|
| 数据源 | Apify Leads Finder | BrightData + PDL |
| 缓存支持 | ✅ 支持 | ❌ 不支持 |
| 无结果退款 | ❌ 收取搜索费 | ✅ 全额退款 |
| 默认搜索费 | 1积分 | 5积分 |
| 默认数据费 | 2积分/条 | 10积分/条 |

**检查结果**: ✅ 正常

**关键代码验证** (processor.ts 第527-568行):
```typescript
if (mode === 'fuzzy') {
  // 调用 Apify API
  const apifyResult = await apifySearchPeople(...);
} else {
  // 调用 BrightData API
  searchResults = await brightdataSearchPeople(...);
}
```

---

## 三、BrightData API 调用分析 (brightdata.ts)

### 3.1 API 调用流程

1. **触发数据采集**: `triggerBrightDataCollection()`
   - 构建搜索关键词: `${searchName} ${searchTitle} ${searchState}`
   - 调用 BrightData Trigger API
   - 返回 `snapshot_id`

2. **轮询获取结果**: `pollBrightDataSnapshot()`
   - 最长等待 3 分钟
   - 每 5 秒轮询一次
   - 返回 `BrightDataProfile[]`

3. **PDL 数据丰富**: `enrichWithPDL()`
   - 使用 LinkedIn URL 查询 PDL
   - 获取电话号码和邮箱
   - 并发限制: 10

4. **数据转换**: `convertToLeadPerson()`
   - 转换为统一的 `LeadPerson` 格式

**检查结果**: ✅ 正常

### 3.2 API Token 获取优先级

```typescript
// 优先从数据库配置读取
const dbApiKey = await getConfig('BRIGHT_DATA_API_KEY');
// 回退到环境变量
return ENV_BRIGHT_DATA_API_TOKEN;
```

**检查结果**: ✅ 正常

---

## 四、积分计算逻辑分析

### 4.1 积分配置 (config.ts)

| 配置项 | 默认值 | 数据库键名 |
|--------|--------|-----------|
| 模糊搜索费 | 1 | FUZZY_SEARCH_CREDITS |
| 模糊数据费 | 2/条 | FUZZY_CREDITS_PER_PERSON |
| 精准搜索费 | 5 | EXACT_SEARCH_CREDITS |
| 精准数据费 | 10/条 | EXACT_CREDITS_PER_PERSON |

**检查结果**: ✅ 正常

### 4.2 积分计算公式

**预扣费计算**:
```
预扣积分 = 搜索费 + 请求数量 × 单条数据费
```

**实际消耗计算**:
```
实际消耗 = 搜索费 + 实际返回数量 × 单条数据费
```

**退还计算**:
```
退还积分 = 预扣积分 - 实际消耗
```

**检查结果**: ✅ 正常

### 4.3 特殊情况处理

| 情况 | 模糊搜索 | 精准搜索 |
|------|----------|----------|
| 无结果 | 收取搜索费 | 全额退款 |
| 任务失败 | 按已消耗结算 | 按已消耗结算 |
| 用户停止 | 按已消耗结算 | 按已消耗结算 |
| API积分耗尽 | 按已消耗结算 | 按已消耗结算 |

**关键代码验证** (processor.ts 第577-598行):
```typescript
if (searchResults.length === 0) {
  if (mode === 'exact') {
    // 精准搜索无结果，实际消耗为0，退还全部预扣积分
    stats.creditsUsed = 0;
  } else {
    // 模糊搜索无结果，仍收取搜索基础费
    stats.creditsUsed = currentSearchCredits;
  }
}
```

**检查结果**: ✅ 正常

---

## 五、数据处理和CSV导出分析

### 5.1 数据处理流程

1. 分类有电话/无电话记录
2. 快速处理无电话记录（不验证）
3. 并发验证有电话记录（批次大小: 16）
4. 保存结果到数据库

**检查结果**: ✅ 正常

### 5.2 电话号码格式化

```typescript
function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `1${digits}`;  // 10位加1变11位
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits;  // 已经是11位以1开头，直接返回
  }
  return digits;
}
```

**检查结果**: ✅ 正常（已修复为纯数字格式）

### 5.3 CSV导出格式

支持三种格式:
- `standard`: 标准版（18列）
- `detailed`: 详细版（36列）
- `minimal`: 简洁版（6列）

**检查结果**: ✅ 正常

### 5.4 CSV导出过滤逻辑

```typescript
const filteredResults = input.includeUnverified 
  ? results 
  : results.filter(r => r.verified);
```

**默认行为**: 只导出已验证的记录

**检查结果**: ✅ 正常

---

## 六、潜在问题和建议

### 6.1 ⚠️ 需要注意的点

1. **精准搜索不支持缓存**
   - 每次搜索都会调用 BrightData API
   - 代码中明确设置: `const cached = mode === 'fuzzy' ? await getCacheByKey(cacheKey) : null;`
   - **建议**: 考虑为精准搜索添加短期缓存（如1天）以节省API成本

2. **PDL API 错误处理**
   - 当 PDL 返回 402 (积分不足) 或 429 (速率限制) 时，只记录日志，不中断搜索
   - **建议**: 考虑在 PDL 积分耗尽时提前终止搜索

3. **BrightData 超时设置**
   - 最长等待 3 分钟 (`maxWaitMs: 180000`)
   - **建议**: 对于大量数据请求，可能需要更长的超时时间

### 6.2 ✅ 代码质量良好的点

1. **模块化架构清晰**
   - 每个文件职责明确
   - 便于维护和扩展

2. **预扣费机制完善**
   - 先扣后退，确保不会超额消费
   - 各种异常情况都有处理

3. **日志记录详细**
   - 搜索过程中记录详细日志
   - 便于问题排查

4. **配置灵活**
   - 积分配置可通过数据库动态调整
   - API Token 支持数据库配置和环境变量两种方式

---

## 七、总结

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 路由入口 | ✅ 正常 | 参数传递正确 |
| 预扣费机制 | ✅ 正常 | 先扣后退，逻辑完整 |
| BrightData API | ✅ 正常 | 触发-轮询-丰富流程完整 |
| PDL 数据丰富 | ✅ 正常 | 并发控制合理 |
| 积分计算 | ✅ 正常 | 公式正确 |
| 特殊情况处理 | ✅ 正常 | 无结果退款逻辑正确 |
| CSV导出 | ✅ 正常 | 电话格式已修复 |
| 数据验证 | ✅ 正常 | TPS/FPS 双验证 |

**结论**: LinkedIn精准搜索模块代码逻辑正确，预扣费机制完善，可以正常使用。

---

*报告生成时间: 2026-01-28*
