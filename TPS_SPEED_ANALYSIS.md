# TPS 搜索速度深度对比分析报告

## 一、EXE 版本 vs Web 版本架构对比

### 1.1 EXE 版本核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXE 版本架构 (v8.4.11)                        │
├─────────────────────────────────────────────────────────────────┤
│  客户端 (Python PyQt5)                                          │
│  ├── ThreadPoolExecutor 多线程并发                              │
│  ├── 每个任务独立发起 API 请求                                   │
│  └── 客户端控制并发数 (max_threads 可配置)                       │
├─────────────────────────────────────────────────────────────────┤
│  后端 (Vercel Serverless)                                       │
│  ├── action=single: 单任务搜索 API                              │
│  ├── 每个请求独立完成: 搜索页 → 详情页 → 返回结果                │
│  └── Scrape.do 并发数: 40 (环境变量配置)                        │
└─────────────────────────────────────────────────────────────────┘

执行流程:
客户端 → 并发发起 N 个 /api/search?action=single 请求
       → 每个请求独立完成搜索+详情获取
       → 结果实时返回客户端
```

### 1.2 Web 版本核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web 版本架构 (当前)                           │
├─────────────────────────────────────────────────────────────────┤
│  前端 (React)                                                   │
│  ├── 提交任务后轮询状态                                          │
│  └── 不参与实际搜索执行                                          │
├─────────────────────────────────────────────────────────────────┤
│  后端 (Node.js tRPC)                                            │
│  ├── 统一队列模式                                                │
│  │   ├── 阶段一: 4 并发搜索 (顺序获取每页)                       │
│  │   └── 阶段二: 40 并发详情获取                                 │
│  └── 单进程执行所有任务                                          │
└─────────────────────────────────────────────────────────────────┘

执行流程:
前端提交任务 → 后端异步执行
            → 阶段一: 4个搜索任务并发，每个任务顺序获取25页
            → 阶段二: 收集所有详情链接，40并发统一获取
            → 任务完成，前端轮询获取结果
```

---

## 二、关键性能差异分析

### 2.1 搜索页获取策略对比

| 维度 | EXE 版本 | Web 版本 | 差异影响 |
|------|----------|----------|----------|
| **搜索页并发** | 并发获取所有页 | 顺序获取每页 | **🔴 重大瓶颈** |
| **第一页处理** | 获取第一页 → 计算总页数 → 并发获取剩余页 | 循环获取每页直到无结果 | EXE 更高效 |
| **页数计算** | 从 HTML 解析 totalRecords | 无结果时停止 | EXE 更精确 |

**EXE 版本搜索页获取代码 (scraper.js:450-525):**
```javascript
// 第一阶段：获取第一页，计算总页数
const firstPageResult = await fetchViaProxy(firstPageUrl);
const firstPageData = parseSearchPage(firstPageResult.html, filters);

// 第二阶段：并发获取剩余搜索页
if (totalPages > 1) {
    const remainingPageUrls = [];
    for (let page = 2; page <= totalPages; page++) {
        remainingPageUrls.push(buildSearchUrl(name, location, page));
    }
    // 并发获取所有剩余搜索页！
    const pageResults = await fetchBatch(remainingPageUrls, concurrency);
}
```

**Web 版本搜索页获取代码 (scraper.ts:476-506):**
```typescript
// 顺序循环获取每页
for (let page = 1; page <= maxPages; page++) {
    const html = await fetchWithScrapedo(url, token);  // 顺序等待！
    const results = parseSearchPage(html);
    if (results.length === 0) break;
}
```

**性能影响计算:**
- 假设搜索 25 页，每页 API 响应 2 秒
- EXE: 2秒(第一页) + 2秒(并发24页) = **4 秒**
- Web: 2秒 × 25页 = **50 秒**
- **差距: 12.5 倍！**

### 2.2 任务并发模式对比

| 维度 | EXE 版本 | Web 版本 | 差异影响 |
|------|----------|----------|----------|
| **任务并发** | 客户端控制 (可配置 max_threads) | 固定 4 并发 | EXE 更灵活 |
| **请求分发** | 每个任务独立请求后端 | 后端单进程处理所有任务 | EXE 更分散 |
| **Scrape.do 利用** | 每个任务内部 40 并发 | 搜索阶段仅 4 并发 | **🔴 严重浪费** |

**EXE 版本并发配置 (scraper.js:34):**
```javascript
SCRAPEDO_CONCURRENCY: parseInt(process.env.SCRAPEDO_CONCURRENCY) || 40,
```

**Web 版本并发配置 (scraper.ts:28-32):**
```typescript
export const TPS_CONFIG = {
  TASK_CONCURRENCY: 4,      // 同时执行的搜索任务数
  SCRAPEDO_CONCURRENCY: 10, // 每个任务的 Scrape.do 并发数 (未使用!)
  TOTAL_CONCURRENCY: 40,    // 总并发数 (仅详情阶段)
};
```

### 2.3 详情页缓存策略对比

| 维度 | EXE 版本 | Web 版本 | 差异影响 |
|------|----------|----------|----------|
| **缓存检查时机** | API 请求前批量检查 | API 请求前批量检查 | ✅ 相同 |
| **缓存存储** | 数据库 (30天过期) | 数据库 (可配置) | ✅ 相同 |
| **缓存命中处理** | 直接使用，不发请求 | 直接使用，不发请求 | ✅ 相同 |

### 2.4 批次间延迟对比

| 维度 | EXE 版本 | Web 版本 | 差异影响 |
|------|----------|----------|----------|
| **批次延迟** | 200ms (BATCH_DELAY) | 无延迟 | Web 更激进 |
| **重试延迟** | 1000ms (RETRY_DELAY) | 无重试机制 | EXE 更稳健 |

---

## 三、性能瓶颈总结

### 🔴 严重瓶颈 (必须修复)

1. **搜索页顺序获取**
   - 当前: 每页顺序等待 API 响应
   - 应改为: 并发获取所有搜索页
   - 预期提升: **10-15 倍**

2. **搜索阶段并发不足**
   - 当前: 4 个搜索任务并发，每个任务内部顺序获取
   - 应改为: 每个任务内部并发获取搜索页
   - 预期提升: **5-10 倍**

### 🟡 中等瓶颈 (建议修复)

3. **总记录数解析缺失**
   - 当前: 循环直到无结果
   - 应改为: 解析第一页的 totalRecords，计算精确页数
   - 预期提升: 减少无效请求

4. **错误重试机制缺失**
   - 当前: 失败直接跳过
   - 应改为: 429 限流时延后重试
   - 预期提升: 提高成功率

### 🟢 轻微瓶颈 (可选优化)

5. **日志写入同步**
   - 当前: 同步写入日志
   - 应改为: 异步写入
   - 预期提升: 微小

---

## 四、优化方案

### 4.1 核心优化: 搜索页并发获取

**修改 `searchOnly` 函数:**

```typescript
export async function searchOnly(
  name: string,
  location: string,
  token: string,
  maxPages: number,
  filters: TpsFilters,
  onProgress?: (message: string) => void
): Promise<SearchOnlyResult> {
  const baseUrl = 'https://www.truepeoplesearch.com/results';
  let searchPageRequests = 0;
  let filteredOut = 0;
  
  // 阶段一: 获取第一页，解析总记录数
  const firstPageUrl = buildSearchUrl(name, location, 1);
  onProgress?.(`获取第一页...`);
  
  const firstPageHtml = await fetchWithScrapedo(firstPageUrl, token);
  searchPageRequests++;
  
  const { results: firstResults, totalRecords, hasNextPage } = parseSearchPageWithTotal(firstPageHtml);
  
  if (firstResults.length === 0) {
    return { success: true, searchResults: [], stats: { searchPageRequests, filteredOut } };
  }
  
  // 计算总页数
  const totalPages = Math.min(
    Math.ceil(totalRecords / 10),
    maxPages
  );
  
  onProgress?.(`找到 ${totalRecords} 条记录，共 ${totalPages} 页`);
  
  // 阶段二: 并发获取剩余搜索页
  const allResults = [...preFilterByAge(firstResults, filters)];
  
  if (totalPages > 1 && hasNextPage) {
    const remainingUrls: string[] = [];
    for (let page = 2; page <= totalPages; page++) {
      remainingUrls.push(buildSearchUrl(name, location, page));
    }
    
    onProgress?.(`并发获取剩余 ${remainingUrls.length} 页...`);
    
    // 并发获取所有剩余页
    const pagePromises = remainingUrls.map(url => 
      fetchWithScrapedo(url, token).catch(() => null)
    );
    
    const pageResults = await Promise.all(pagePromises);
    searchPageRequests += remainingUrls.length;
    
    for (const html of pageResults) {
      if (html) {
        const results = parseSearchPage(html);
        const filtered = preFilterByAge(results, filters);
        filteredOut += results.length - filtered.length;
        allResults.push(...filtered);
      }
    }
  }
  
  // 去重
  const uniqueResults = deduplicateByDetailLink(allResults);
  
  onProgress?.(`搜索完成: ${uniqueResults.length} 条唯一结果`);
  
  return {
    success: true,
    searchResults: uniqueResults,
    stats: { searchPageRequests, filteredOut },
  };
}
```

### 4.2 新增函数: 解析总记录数

```typescript
function parseSearchPageWithTotal(html: string): {
  results: TpsSearchResult[];
  totalRecords: number;
  hasNextPage: boolean;
} {
  const $ = cheerio.load(html);
  
  // 解析总记录数
  let totalRecords = 0;
  const recordText = $('.record-count .col-7, .record-count .col').first().text();
  const totalMatch = recordText.match(/(\d+)\s*records?\s*found/i);
  if (totalMatch) {
    totalRecords = parseInt(totalMatch[1]);
  }
  
  // 解析结果列表
  const results = parseSearchPage(html);
  
  // 检查是否有下一页
  const hasNextPage = $('#btnNextPage').length > 0;
  
  return { results, totalRecords, hasNextPage };
}
```

### 4.3 预期性能提升

| 场景 | 优化前 | 优化后 | 提升倍数 |
|------|--------|--------|----------|
| 单任务 25 页搜索 | 50秒 | 4秒 | **12.5x** |
| 4 任务各 25 页 | 200秒 | 16秒 | **12.5x** |
| 10 任务各 10 页 | 200秒 | 8秒 | **25x** |

---

## 五、实施优先级

1. **P0 (立即实施)**: 搜索页并发获取
2. **P1 (本周实施)**: 总记录数解析 + 精确页数计算
3. **P2 (下周实施)**: 429 限流重试机制
4. **P3 (可选)**: 异步日志写入

---

## 六、风险评估

1. **Scrape.do 并发限制**: 40 并发是账户限制，过度并发可能触发限流
2. **内存占用**: 并发请求会增加内存使用
3. **错误处理**: 并发请求需要更完善的错误处理

**缓解措施:**
- 保留批次间延迟 (200ms)
- 实现指数退避重试
- 添加内存监控

