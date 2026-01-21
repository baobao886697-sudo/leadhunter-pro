# Apify API 消耗分析报告

**作者**: Manus AI  
**日期**: 2026年1月21日

---

## 1. Apify Leads Finder 计费机制

根据 Apify 官方文档，Leads Finder Actor 采用 **Pay per event（按事件计费）** 模式：

| 事件类型 | Free 计划 | Business 计划 |
|---------|----------|--------------|
| **Lead fetched**（每获取一条数据） | $2.00 / 1,000 条 | $1.50 / 1,000 条 |
| **Actor start**（每次启动） | $0.02 | $0.02 |

**关键点**：
- 计费是按**实际获取的 Lead 数量**计算，不是按请求数量
- 每次 Actor 启动都会收取 $0.02 的启动费
- Free 计划每次运行最多只能获取 100 条数据

---

## 2. Apify 返回的数据内容

根据文档，Apify Leads Finder **一次性返回完整数据**，包括：

### 人员信息
- `first_name`, `last_name`, `full_name`, `job_title`
- `email` (已验证的邮箱)
- **`mobile_number`** (手机号码 - 仅付费计划)
- `personal_email` (个人邮箱)
- `linkedin` (LinkedIn 链接)
- `city`, `state`, `country`

### 公司信息
- `company_name`, `company_domain`, `company_website`
- `company_linkedin`, `company_size`, `industry`
- `company_annual_revenue`, `company_total_funding`
- `company_phone` 等

**结论**：Apify 返回的数据**已经包含电话号码**，无需二次获取！

---

## 3. 当前代码中的问题分析

### 问题 1：请求数量翻倍

```typescript
// searchProcessorV3.ts 第 600 行和第 637 行
const searchResult = await apifySearchPeople(searchName, searchTitle, searchState, requestedCount * 2, userId);
```

**问题**：用户请求 100 条，系统向 Apify 请求 200 条（`requestedCount * 2`）

**影响**：
- 用户请求 100 条 → 实际消耗 200 条的 Apify 费用
- 费用翻倍！$0.30 变成 $0.60（Business 计划）

**原因推测**：可能是为了确保有足够的数据进行筛选，但这造成了严重浪费。

### 问题 2：Apify 已返回电话，但仍调用 Scrape.do 验证

查看代码逻辑：

```typescript
// Apify 返回的数据结构已包含电话
phone_numbers: PhoneNumber[];  // 电话号码列表

// 但代码仍然调用 Scrape.do 进行二次验证
if (enableVerification) {
  const verifyResult = await verifyPhoneNumber(personToVerify, userId);
  // ...
}
```

**问题**：
1. Apify 返回的 `mobile_number` 已经是真实数据
2. 系统又调用 Scrape.do API 进行"验证"
3. 这造成了**双重 API 消耗**

### 问题 3：缓存键包含数量，导致重复调用

```typescript
// 缓存键生成
const searchHash = generateSearchHash(searchName, searchTitle, searchState, requestedCount);
```

**问题**：
- 搜索 `CEO + California + 100` 和 `CEO + California + 500` 是不同的缓存键
- 即使数据库中有相同条件的数据，也会重新调用 Apify

---

## 4. API 消耗计算示例

### 场景：用户搜索 100 条 CEO + California 数据

**当前系统消耗**：
| 项目 | 消耗 |
|-----|-----|
| Apify Actor 启动 | $0.02 |
| Apify 获取数据 (100 × 2 = 200 条) | $0.30 |
| Scrape.do 验证 (假设 100 条) | 约 $0.50 |
| **总计** | **约 $0.82** |

**优化后预期消耗**：
| 项目 | 消耗 |
|-----|-----|
| Apify Actor 启动 | $0.02 |
| Apify 获取数据 (100 条) | $0.15 |
| Scrape.do 验证 | $0 (可选) |
| **总计** | **$0.17** |

**节省比例**：约 **80%**！

---

## 5. 优化建议

### 建议 1：移除 `requestedCount * 2`

```typescript
// 修改前
const searchResult = await apifySearchPeople(searchName, searchTitle, searchState, requestedCount * 2, userId);

// 修改后
const searchResult = await apifySearchPeople(searchName, searchTitle, searchState, requestedCount, userId);
```

### 建议 2：直接使用 Apify 返回的电话号码

Apify 返回的 `mobile_number` 已经是真实数据，可以：
1. **完全移除** Scrape.do 验证步骤
2. 或者将验证改为**可选功能**，默认关闭

### 建议 3：优化缓存键策略

考虑移除缓存键中的数量参数，使用更智能的缓存策略：
- 缓存键：`name + title + state`（不含数量）
- 缓存数据量：尽可能多
- 命中时：从缓存中随机提取用户需要的数量

### 建议 4：添加 Apify 消耗监控

在管理后台添加 Apify API 消耗统计：
- 每日/每周/每月的 API 调用次数
- 每日/每周/每月的数据获取量
- 费用估算

---

## 6. 总结

**Apify API 消耗过快的主要原因**：

1. **请求数量翻倍** (`requestedCount * 2`) - 造成 100% 浪费
2. **重复获取电话数据** - Apify 已返回电话，又调用 Scrape.do
3. **缓存策略不够智能** - 相似搜索条件无法复用缓存

**核心结论**：Apify 在获取 LinkedIn 数据时**已经包含了电话号码**，无需二次获取。当前系统存在严重的 API 浪费问题，优化后可节省约 80% 的 API 成本。
