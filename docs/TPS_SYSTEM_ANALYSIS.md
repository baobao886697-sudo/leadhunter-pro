# TruePeopleSearch (TPS) 系统全面分析文档

## 一、系统架构概览

### 1.1 核心文件结构

```
leadhunter-pro/
├── server/tps/
│   ├── router.ts      # tRPC API 路由，业务逻辑入口
│   ├── scraper.ts     # 核心爬虫逻辑，数据解析
│   └── db.ts          # 数据库操作，缓存管理
├── client/src/pages/
│   ├── TpsSearch.tsx  # 搜索页面（用户输入）
│   ├── TpsTask.tsx    # 任务详情页面（结果展示）
│   └── TpsHistory.tsx # 搜索历史页面
└── drizzle/schema.ts  # 数据库表定义
```

### 1.2 数据库表结构

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `tps_config` | 系统配置 | searchCost, detailCost, scrapeDoToken, maxPages, enabled |
| `tps_detail_cache` | 详情页缓存 | detailLink, data(JSON), expiresAt |
| `tps_search_tasks` | 搜索任务 | taskId, userId, mode, names, locations, filters, status |
| `tps_search_results` | 搜索结果 | taskId, name, age, phone, city, state, carrier, fromCache |

---

## 二、后端 API 路由分析 (router.ts)

### 2.1 API 端点列表

| 端点 | 类型 | 功能 | 输入参数 |
|------|------|------|----------|
| `tps.getConfig` | Query | 获取TPS配置 | 无 |
| `tps.estimateCost` | Query | 预估搜索费用 | names, locations, mode, filters |
| `tps.search` | Mutation | 提交搜索任务 | names, locations, mode, filters |
| `tps.getTaskStatus` | Query | 获取任务状态 | taskId |
| `tps.getTaskResults` | Query | 获取任务结果 | taskId, page, pageSize |
| `tps.getHistory` | Query | 获取搜索历史 | page, pageSize |
| `tps.exportResults` | Mutation | 导出CSV | taskId |

### 2.2 搜索任务执行流程

```
用户提交搜索
    ↓
检查TPS是否启用
    ↓
检查用户积分是否足够
    ↓
创建搜索任务（数据库记录）
    ↓
异步执行搜索（不阻塞响应）
    ↓
返回 taskId 给用户
```

### 2.3 核心搜索执行逻辑 (executeTpsSearchUnifiedQueue)

**两阶段执行模式：**

**阶段一：并发搜索（4任务并发 × 25页并发）**
```javascript
// 构建子任务列表
if (mode === "nameOnly") {
  // 每个姓名一个子任务
} else {
  // 姓名 × 地点 = 组合子任务
}

// 并发执行搜索
for (subTask of subTasks) {
  await searchOnly(name, location, token, maxPages, filters);
  // 收集详情任务链接
}
```

**阶段二：统一队列获取详情（40并发）**
```javascript
// 去重详情链接
const uniqueLinks = [...new Set(allDetailTasks.map(t => t.searchResult.detailLink))];

// 统一获取详情
await fetchDetailsInBatch(allDetailTasks, token, TOTAL_CONCURRENCY, filters);
```

### 2.4 积分扣除逻辑

```javascript
// 实际消耗 = 搜索页费用 + 详情页费用
const actualCost = totalSearchPages * searchCost + totalDetailPages * detailCost;

// 扣除积分
await deductCredits(userId, actualCost, `TPS搜索 [${taskId}]`);
await logCreditChange(userId, -actualCost, "search", `TPS搜索任务 ${taskId}`, taskId);
```

**费用计算公式：**
- 搜索页费用 = 搜索页数 × 0.3 积分/页
- 详情页费用 = 详情页数 × 0.3 积分/页
- 缓存命中的详情页不收费

---

## 三、爬虫核心逻辑分析 (scraper.ts)

### 3.1 配置常量

```javascript
export const TPS_CONFIG = {
  TASK_CONCURRENCY: 4,      // 同时执行的搜索任务数
  SCRAPEDO_CONCURRENCY: 10, // 每个任务的 Scrape.do 并发数
  TOTAL_CONCURRENCY: 40,    // 总并发数 (4 * 10)
  MAX_SAFE_PAGES: 25,       // 最大搜索页数
  SEARCH_COST: 0.3,         // 搜索页成本
  DETAIL_COST: 0.3,         // 详情页成本
};
```

### 3.2 Scrape.do API 调用

```javascript
async function fetchWithScrapedo(url: string, token: string): Promise<string> {
  const encodedUrl = encodeURIComponent(url);
  const apiUrl = `https://api.scrape.do/?token=${token}&url=${encodedUrl}&super=true&geoCode=us&timeout=${SCRAPE_TIMEOUT_MS}`;
  
  // 超时配置：5秒超时，最多重试1次
  // 返回 HTML 内容
}
```

### 3.3 搜索页解析 (parseSearchPage)

**提取字段：**
- **姓名**: `.h4` 或 `.content-header` 元素
- **年龄**: DOM + 正则组合方法
  - 方法1: 查找 "Age " 后面的 `.content-value`
  - 方法2: 正则匹配 `/Age\s+(\d+)/i`
  - 方法3: 第一个 `.content-value` 回退
- **位置**: `.content-value` 第二个元素
- **详情链接**: `a[href*="/find/person/"]`
- **已故标记**: 检测文本包含 "Deceased"

```javascript
export function parseSearchPage(html: string): TpsSearchResult[] {
  const $ = cheerio.load(html);
  const results: TpsSearchResult[] = [];
  
  $('.card-summary').each((index, card) => {
    // 检查是否已故
    const isDeceased = cardText.includes('Deceased');
    
    // 提取姓名
    let name = $card.find('.h4').first().text().trim();
    
    // 提取年龄 - DOM + 正则组合
    let age: number | undefined;
    // ... 三种方法尝试
    
    // 提取位置
    const location = $card.find('.content-value').eq(1).text().trim();
    
    // 提取详情链接
    const detailLink = $card.find('a[href*="/find/person/"]').first().attr('href');
    
    results.push({ name, age, location, detailLink, isDeceased });
  });
  
  return results;
}
```

### 3.4 详情页解析 (parseDetailPage)

**提取字段：**

| 字段 | 提取方法 | 选择器/正则 |
|------|----------|-------------|
| 姓名 | 从搜索结果传入 | - |
| 年龄 | 标题/页面内容 | `/Age[:\s]*(\d{1,3})\b/i` |
| 城市/州 | 标题/地址区域 | `/in\s+([^,]+),\s*([A-Z]{2})/` |
| 电话号码 | 电话链接 | `a[data-link-to-more="phone"]` |
| 电话类型 | 容器文本 | Wireless/Landline/VoIP |
| 运营商 | `.dt-ln, .dt-sb` | 文本匹配 |
| 报告年份 | 容器文本 | `/reported.*?(\d{4})/i` |
| 是否主号 | 容器文本 | 包含 "primary" |
| 房产价值 | 地址容器 | `/\$([0-9,]+)/` |
| 建造年份 | 地址容器 | `/Built\s*(\d{4})/i` |

```javascript
export function parseDetailPage(html: string, searchResult: TpsSearchResult): TpsDetailResult[] {
  // 1. 解析城市/州
  const title = $('title').text();
  const titleMatch = title.match(/in\s+([^,]+),\s*([A-Z]{2})/);
  
  // 2. 解析房产信息
  const addressLink = $('a[data-link-to-more="address"]').first();
  addressContainer.find('.dt-sb').each((_, el) => {
    // 匹配 $xxx,xxx 格式的价格
    // 匹配 Built 年份
  });
  
  // 3. 解析电话号码（核心）
  $('.col-12.col-md-6.mb-3').each((_, container) => {
    const phoneLink = $container.find('a[data-link-to-more="phone"]');
    
    // 提取电话号码
    const href = phoneLink.attr('href');
    const hrefMatch = href.match(/\/find\/phone\/(\d+)/);
    
    // 提取电话类型
    if (containerText.includes('Wireless')) phoneType = 'Wireless';
    
    // 提取运营商
    // 提取报告年份
    // 提取是否主号
    
    results.push({ name, age, city, state, phone, phoneType, carrier, ... });
  });
  
  return results;
}
```

### 3.5 过滤逻辑

**搜索页预过滤 (preFilterByAge):**
```javascript
export function preFilterByAge(results: TpsSearchResult[], filters: TpsFilters): PreFilterResult {
  const minAge = filters.minAge ?? 50;  // 默认 50 岁
  const maxAge = filters.maxAge ?? 79;  // 默认 79 岁
  
  const filtered = results.filter(r => {
    // 1. 排除已故人员（固定启用）
    if (r.isDeceased) return false;
    
    // 2. 没有年龄信息的保留
    if (r.age === undefined) return true;
    
    // 3. 精确匹配年龄范围
    if (r.age < minAge || r.age > maxAge) return false;
    
    return true;
  });
  
  return { filtered, stats: { skippedDeceased, skippedAgeRange } };
}
```

**详情页精确过滤 (shouldIncludeResult):**
```javascript
export function shouldIncludeResult(result: TpsDetailResult, filters: TpsFilters): boolean {
  // 1. 已故人员检查
  if (result.isDeceased) return false;
  
  // 2. 数据完整性：必须有电话号码
  if (!result.phone || result.phone.length < 10) return false;
  
  // 3. 数据完整性：必须有年龄
  if (result.age === undefined) return false;
  
  // 4. 年龄范围验证
  if (result.age < minAge || result.age > maxAge) return false;
  
  // 5. 电话年份验证
  if (filters.minYear && result.reportYear < filters.minYear) return false;
  
  // 6. 房产价值验证
  if (filters.minPropertyValue && result.propertyValue < filters.minPropertyValue) return false;
  
  // 7. 运营商排除
  if (filters.excludeTMobile && carrier.includes('t-mobile')) return false;
  if (filters.excludeComcast && carrier.includes('comcast')) return false;
  
  // 8. 固话排除
  if (filters.excludeLandline && phoneType === 'landline') return false;
  
  return true;
}
```

---

## 四、数据库操作分析 (db.ts)

### 4.1 配置管理

```javascript
// 获取配置（优先从 systemConfigs 表读取）
export async function getTpsConfig() {
  // 1. 尝试从 tps_config 表获取
  // 2. 从 systemConfigs 表获取（管理后台配置）
  // 3. 合并配置，systemConfigs 优先
  
  return {
    searchCost,           // 搜索页成本
    detailCost,           // 详情页成本
    maxConcurrent,        // 最大并发数
    cacheDays,            // 缓存天数
    scrapeDoToken,        // Scrape.do API Token
    maxPages,             // 最大搜索页数
    enabled,              // 是否启用
    defaultMinAge,        // 默认最小年龄
    defaultMaxAge,        // 默认最大年龄
  };
}
```

### 4.2 缓存机制

```javascript
// 获取缓存的详情页数据
export async function getCachedTpsDetails(links: string[]) {
  return await database.select()
    .from(tpsDetailCache)
    .where(and(
      inArray(tpsDetailCache.detailLink, links),
      gte(tpsDetailCache.expiresAt, now)  // 检查过期时间
    ));
}

// 保存详情页缓存
export async function saveTpsDetailCache(items, cacheDays = 30) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + cacheDays);
  
  // 使用 upsert 逻辑
  await database.insert(tpsDetailCache).values({
    detailLink: item.link,
    data: item.data,
    expiresAt,
  }).onDuplicateKeyUpdate({ ... });
}
```

### 4.3 积分操作

```javascript
// 扣除积分
export async function deductCredits(userId: number, amount: number, description: string) {
  await database.update(users).set({
    credits: sql`${users.credits} - ${Math.ceil(amount * 10) / 10}`,
  }).where(eq(users.id, userId));
}

// 记录积分变动
export async function logCreditChange(userId, amount, type, description, relatedTaskId) {
  await database.insert(creditLogs).values({
    userId,
    amount: Math.round(amount * 10) / 10,
    balanceAfter: result[0]?.credits || 0,
    type,
    description,
    relatedTaskId,
  });
}
```

---

## 五、前端页面分析

### 5.1 TpsSearch.tsx - 搜索页面

**功能模块：**
1. **搜索模式选择**: 仅姓名 / 姓名+地点
2. **输入区域**: 姓名列表（每行一个）、地点列表
3. **高级选项**: 年龄范围、电话年份、房产价值、运营商排除
4. **费用预估**: 实时计算预估消耗
5. **提交搜索**: 检查积分后提交

**过滤条件状态：**
```javascript
const [filters, setFilters] = useState({
  minAge: 50,
  maxAge: 79,
  minYear: 2025,
  minPropertyValue: 0,
  excludeTMobile: false,
  excludeComcast: false,
  excludeLandline: false,
});
```

### 5.2 TpsTask.tsx - 任务详情页面

**功能模块：**
1. **任务状态卡片**: 状态、进度、结果数、消耗积分
2. **任务日志**: 实时显示执行日志
3. **错误信息**: 显示失败原因
4. **搜索结果表格**: 分页展示结果
5. **导出CSV**: 下载完整结果

**结果表格字段：**
- 姓名、年龄、位置、电话、类型、运营商、报告年份、房产价值、建造年份

### 5.3 TpsHistory.tsx - 搜索历史页面

**功能模块：**
1. **历史记录表格**: 任务ID、模式、子任务数、结果数、消耗积分、状态、创建时间
2. **分页导航**: 支持翻页
3. **查看详情**: 跳转到任务详情页

---

## 六、数据提取细节总结

### 6.1 搜索页提取的字段

| 字段 | 类型 | 必填 | 提取方法 |
|------|------|------|----------|
| name | string | 是 | `.h4` 或 `.content-header` |
| age | number | 否 | DOM + 正则组合 |
| location | string | 否 | `.content-value` 第二个 |
| detailLink | string | 是 | `a[href*="/find/person/"]` |
| isDeceased | boolean | 否 | 文本包含 "Deceased" |

### 6.2 详情页提取的字段

| 字段 | 类型 | 必填 | 提取方法 |
|------|------|------|----------|
| name | string | 是 | 从搜索结果传入 |
| age | number | 是 | 标题/页面正则 |
| city | string | 否 | 标题/地址区域 |
| state | string | 否 | 标题/地址区域 |
| phone | string | 是 | `a[data-link-to-more="phone"]` |
| phoneType | string | 否 | Wireless/Landline/VoIP |
| carrier | string | 否 | `.dt-ln, .dt-sb` |
| reportYear | number | 否 | `/reported.*?(\d{4})/i` |
| isPrimary | boolean | 否 | 包含 "primary" |
| propertyValue | number | 否 | `/\$([0-9,]+)/` |
| yearBuilt | number | 否 | `/Built\s*(\d{4})/i` |

### 6.3 CSV 导出字段

```javascript
const headers = [
  "姓名", "年龄", "城市", "州", "位置", "电话", "电话类型", 
  "运营商", "报告年份", "是否主号", "房产价值", "建造年份",
  "搜索姓名", "搜索地点", "缓存命中", "详情链接"
];
```

**电话号码格式化：**
```javascript
const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
};
```

---

## 七、关键业务逻辑

### 7.1 费用计算

```
总费用 = 搜索页费用 + 详情页费用
搜索页费用 = 搜索页数 × 0.3 积分/页
详情页费用 = (详情页数 - 缓存命中数) × 0.3 积分/页
```

### 7.2 缓存策略

- 缓存有效期：180 天（可配置）
- 缓存粒度：详情页链接级别
- 缓存命中：免费使用，不扣积分
- 缓存更新：使用 upsert 逻辑

### 7.3 并发控制

- 搜索任务并发：4 个
- Scrape.do 并发：10 个/任务
- 总并发数：40 个
- 超时配置：5 秒，最多重试 1 次

### 7.4 过滤优先级

1. **搜索页过滤**（节省详情页费用）
   - 排除已故人员
   - 年龄范围预过滤

2. **详情页过滤**（确保数据质量）
   - 必须有电话号码
   - 必须有年龄
   - 年龄范围精确匹配
   - 电话年份、房产价值、运营商、固话等可选过滤

---

## 八、系统配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| searchCost | 0.3 | 每搜索页消耗积分 |
| detailCost | 0.3 | 每详情页消耗积分 |
| maxConcurrent | 40 | 最大并发数 |
| cacheDays | 180 | 缓存天数 |
| maxPages | 25 | 最大搜索页数 |
| batchDelay | 200 | 批次间延迟(ms) |
| enabled | true | 是否启用 |
| defaultMinAge | 50 | 默认最小年龄 |
| defaultMaxAge | 79 | 默认最大年龄 |

---

## 九、潜在优化点

1. **年龄提取准确性**: 当前使用三种方法组合，可能存在遗漏
2. **电话号码去重**: 跨任务去重已实现，但同一详情页多电话可能重复
3. **缓存命中率**: 可以增加搜索页级别的缓存
4. **错误处理**: 部分错误静默处理，可增加更详细的日志
5. **房产信息提取**: 备用方法可能匹配到非房产价格

---

## 十、数据解析细节深度分析

### 10.1 搜索页 HTML 结构

**TruePeopleSearch 搜索结果页面结构：**

```html
<div class="card-summary">
  <a href="/find/person/xxx" class="h4">John Smith</a>
  <div class="content-value">65</div>           <!-- 年龄 -->
  <div class="content-value">New York, NY</div> <!-- 位置 -->
  <span>Deceased</span>                          <!-- 已故标记（可选）-->
</div>
```

**解析选择器映射：**

| 数据字段 | CSS 选择器 | 备注 |
|----------|------------|------|
| 结果卡片 | `.card-summary` | 每个人员一个卡片 |
| 姓名 | `.h4` 或 `.content-header` | 优先使用 .h4 |
| 年龄 | `.content-value` 第一个 | 需要验证是否为数字 |
| 位置 | `.content-value` 第二个 | 城市, 州 格式 |
| 详情链接 | `a[href*="/find/person/"]` | 用于获取详情页 |
| 已故标记 | 文本包含 "Deceased" | 固定排除 |
| 总记录数 | `.record-count .col` | "X records found" |
| 下一页按钮 | `#btnNextPage` | 判断是否有更多页 |

### 10.2 详情页 HTML 结构

**TruePeopleSearch 详情页面结构：**

```html
<title>John Smith, Age 65 in New York, NY | TruePeopleSearch</title>

<!-- 地址区域 -->
<a data-link-to-more="address">123 Main St</a>
<div class="dt-sb">$500,000</div>    <!-- 房产价值 -->
<div class="dt-sb">Built 1990</div>  <!-- 建造年份 -->

<!-- 电话区域 -->
<div class="col-12 col-md-6 mb-3">
  <a data-link-to-more="phone" href="/find/phone/1234567890">
    (123) 456-7890
  </a>
  <div class="dt-ln">Wireless</div>      <!-- 电话类型 -->
  <div class="dt-sb">T-Mobile</div>      <!-- 运营商 -->
  <div class="dt-sb">reported 2024</div> <!-- 报告年份 -->
  <span>Primary</span>                    <!-- 主号标记 -->
</div>
```

**解析选择器映射：**

| 数据字段 | CSS 选择器/正则 | 备注 |
|----------|-----------------|------|
| 年龄 | 标题正则 `/Age\s*(\d+)/i` | 从 title 提取 |
| 城市/州 | 标题正则 `/in\s+([^,]+),\s*([A-Z]{2})/` | 从 title 提取 |
| 电话容器 | `.col-12.col-md-6.mb-3` | 每个电话一个容器 |
| 电话号码 | `a[data-link-to-more="phone"]` href | 从链接提取数字 |
| 电话类型 | 容器文本包含 Wireless/Landline/VoIP | 文本匹配 |
| 运营商 | `.dt-ln, .dt-sb` | 排除特定关键词后的文本 |
| 报告年份 | 正则 `/reported.*?(\d{4})/i` | 从容器文本提取 |
| 主号标记 | 文本包含 "primary" | 不区分大小写 |
| 房产价值 | 正则 `/\$([0-9,]+)/` | 从地址容器提取 |
| 建造年份 | 正则 `/Built\s*(\d{4})/i` | 从地址容器提取 |

### 10.3 年龄提取三重方法

**方法优先级：**

1. **DOM 方法**：查找 "Age" 标签后的 `.content-value`
   ```javascript
   const prevText = $el.prev().text().trim();
   if (prevText.includes('Age')) {
     age = parseInt($el.text().trim(), 10);
   }
   ```

2. **正则方法**：从卡片文本匹配 "Age XX"
   ```javascript
   const ageMatch = cardText.match(/Age\s+(\d+)/i);
   if (ageMatch) age = parseInt(ageMatch[1], 10);
   ```

3. **回退方法**：取第一个 `.content-value` 的数字
   ```javascript
   const ageText = $card.find('.content-value').first().text().trim();
   const ageMatch = ageText.match(/(\d+)/);
   ```

### 10.4 电话号码提取逻辑

**主要方法：**
```javascript
// 从链接 href 提取
const href = phoneLink.attr('href'); // "/find/phone/1234567890"
const hrefMatch = href.match(/\/find\/phone\/(\d+)/);
phone = hrefMatch[1]; // "1234567890"
```

**备用方法：**
```javascript
// 从链接文本提取
const phoneText = phoneLink.text().replace(/\D/g, '');
if (phoneText.length >= 10) phone = phoneText;
```

**正则回退（无结构化数据时）：**
```javascript
const phonePattern = /\((\d{3})\)\s*(\d{3})-(\d{4})/g;
while ((match = phonePattern.exec(html)) !== null) {
  const phone = match[1] + match[2] + match[3];
  phones.add(phone);
}
```

### 10.5 房产信息提取逻辑

**主要方法（地址容器内）：**
```javascript
const addressLink = $('a[data-link-to-more="address"]').first();
const addressContainer = addressLink.parent();

addressContainer.find('.dt-sb').each((_, el) => {
  const text = $(el).text();
  
  // 匹配价格
  const priceMatch = text.match(/\$([0-9,]+)/);
  if (priceMatch) {
    propertyValue = parseInt(priceMatch[1].replace(/,/g, ''), 10);
  }
  
  // 匹配建造年份
  const builtMatch = text.match(/Built\s*(\d{4})/i);
  if (builtMatch) {
    yearBuilt = parseInt(builtMatch[1], 10);
  }
});
```

**备用方法（全页面搜索）：**
```javascript
const pageText = $('body').text();
const priceMatches = pageText.match(/\$([0-9]{1,3}(?:,[0-9]{3})+)(?!\d)/g);
// 取第一个在 $50,000-$10,000,000 范围内的价格
```

### 10.6 运营商提取逻辑

```javascript
const dtLn = $container.find('.dt-ln, .dt-sb');
dtLn.each((_, el) => {
  const text = $(el).text().trim();
  // 排除特定关键词
  if (text && 
      !text.includes('reported') && 
      !text.includes('Primary') && 
      !text.includes('Phone')) {
    // 只保留纯字母文本（运营商名称）
    if (/^[A-Za-z\s]+$/.test(text) && text.length > 3) {
      carrier = text;
    }
  }
});
```

### 10.7 过滤条件详细说明

**搜索页过滤（节省 API 费用）：**

| 条件 | 默认值 | 说明 |
|------|--------|------|
| 已故排除 | 固定启用 | 检测 "Deceased" 文本 |
| 年龄范围 | 50-79 | 可由用户调整 |

**详情页过滤（确保数据质量）：**

| 条件 | 默认值 | 说明 |
|------|--------|------|
| 电话必填 | 固定启用 | 长度 >= 10 位 |
| 年龄必填 | 固定启用 | 必须有年龄信息 |
| 年龄范围 | 50-79 | 精确匹配 |
| 电话年份 | 2025 | 可选，排除过旧号码 |
| 房产价值 | 0 | 可选，最低房产价值 |
| 排除 T-Mobile | 关闭 | 可选 |
| 排除 Comcast | 关闭 | 包括 Spectrum/Xfinity |
| 排除固话 | 关闭 | Landline 类型 |

---

## 十一、系统流程图

### 11.1 搜索任务执行流程

```
用户提交搜索
    │
    ▼
┌─────────────────────────────────────┐
│  1. 检查 TPS 是否启用                │
│  2. 检查用户积分是否足够              │
│  3. 创建搜索任务记录                  │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  阶段一：并发搜索                     │
│  • 4 任务并发                        │
│  • 每任务并发获取 25 页               │
│  • 搜索页预过滤（年龄、已故）          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  积分检查点                          │
│  • 计算已消耗搜索页费用               │
│  • 预估详情页费用                     │
│  • 检查用户积分是否足够               │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  阶段二：统一队列获取详情              │
│  • 40 并发                          │
│  • 检查缓存命中                       │
│  • 详情页精确过滤                     │
│  • 保存缓存                          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  完成处理                            │
│  • 扣除实际消耗积分                   │
│  • 记录积分变动日志                   │
│  • 记录 API 调用日志                  │
│  • 更新任务状态为完成                  │
└─────────────────────────────────────┘
```

### 11.2 数据流向图

```
TruePeopleSearch.com
        │
        ▼
┌───────────────────┐
│   Scrape.do API   │  ← 代理请求
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   HTML 内容       │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   Cheerio 解析    │  ← DOM + 正则
└───────────────────┘
        │
        ├──────────────────────┐
        ▼                      ▼
┌───────────────────┐  ┌───────────────────┐
│   搜索结果        │  │   详情结果        │
│   TpsSearchResult │  │   TpsDetailResult │
└───────────────────┘  └───────────────────┘
        │                      │
        ▼                      ▼
┌───────────────────┐  ┌───────────────────┐
│   预过滤          │  │   精确过滤        │
│   (年龄、已故)    │  │   (全部条件)      │
└───────────────────┘  └───────────────────┘
        │                      │
        └──────────┬───────────┘
                   ▼
        ┌───────────────────┐
        │   tps_search_     │
        │   results 表      │
        └───────────────────┘
                   │
                   ▼
        ┌───────────────────┐
        │   CSV 导出        │
        │   (带格式化)      │
        └───────────────────┘
```

---

## 十二、已知问题和优化建议

### 12.1 当前已知问题

1. **年龄提取不稳定**
   - 问题：部分页面年龄位置不固定，三种方法可能都失败
   - 影响：无年龄的结果会被详情页过滤排除
   - 建议：增加更多年龄提取模式，或放宽年龄必填限制

2. **房产价值误匹配**
   - 问题：备用方法可能匹配到非房产价格（如保险金额）
   - 影响：房产过滤可能不准确
   - 建议：增加上下文验证，确保价格在地址区域内

3. **运营商提取不完整**
   - 问题：部分运营商名称格式不标准，无法正确提取
   - 影响：运营商过滤可能遗漏
   - 建议：建立运营商名称映射表

### 12.2 优化建议

1. **增加搜索页缓存**
   - 当前只缓存详情页，搜索页每次都重新请求
   - 可以缓存搜索页结果，减少重复搜索费用

2. **智能页数控制**
   - 当前固定 25 页，可能浪费积分
   - 可以根据总记录数动态调整页数

3. **增量更新机制**
   - 当前缓存过期后完全重新获取
   - 可以增加增量更新，只获取新数据

4. **批量导出优化**
   - 当前导出全部结果到单个 CSV
   - 可以支持分批导出、自定义字段

---

*文档生成时间: 2026-01-28*
*版本: v2.0*
*更新内容: 添加数据解析细节、流程图、已知问题*
