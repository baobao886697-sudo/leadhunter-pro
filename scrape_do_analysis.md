# Scrape.do 官方文档分析

## 关键发现

### 1. 并发限制（API Concurrency Limit）

| Plan Type | API Concurrency Limit | (Separate) Async Concurrency Limit |
|-----------|----------------------|-----------------------------------|
| Free | 5 | 2 |
| Hobby | 5 | 2 |
| Pro | 15 | 5 |
| Business | 40 | 12 |
| Advanced | 200 | 60 |
| Custom/Enterprise | Custom | 30% of plan limit |

### 2. 异步 API 特性

> The **Async-API** runs in a **separate background thread pool** that's fully independent from your main API concurrency. It uses a capacity equivalent to **30% of your plan's concurrency limit**, but **this is an additional pool and not deducted** from your main concurrency.

**关键点：**
- Async-API 运行在**独立的后台线程池**中
- 与主 API 并发完全独立
- 额外提供 30% 的并发容量
- 可以同时使用 Default API 和 Async-API

### 3. 429 错误（并发超限）

> 429: You are sending requests too quickly (concurrency limit exceeded)

当并发超过限制时，会返回 429 错误。

### 4. 最佳实践建议（来自搜索结果）

- Limit the number of concurrent requests (10–100 is usually safe depending on the site)
- Sleep between requests (add jitter to mimic human behavior)
- Start with 5-10 concurrent requests, gradually increase to 20-30
- Most sites should handle 10-15 concurrent requests

### 5. 工作原理

1. **Routes through rotating proxies** — 110M+ IPs across 150 countries
2. **Mimics real browser behavior** — TLS fingerprints and HTTP headers
3. **Renders JavaScript if needed** — Headless browser (Chromium)
4. **Handles CAPTCHAs automatically**
5. **Retries intelligently** — Different IP on failure
6. **Returns clean data** — Credits only consumed on success (2xx)



## Scrape.do 官方 Best Practices

1. **Polling**: When checking job status, implement exponential backoff to avoid excessive API calls
2. **Webhooks**: For production use, configure `WebhookURL` to receive results automatically instead of polling
3. **Error Handling**: Always check the `Status` field in task responses and handle errors appropriately
4. **Concurrency**: Monitor your `FreeConcurrency` to ensure you don't exceed your account limits
5. **Task Expiration**: Retrieved task results before the `ExpiresAt` timestamp (results are stored temporarily)

## 关键技术点

### Async-API 的线程池模型

> The **Async-API** runs in a **separate background thread pool** that's fully independent from your main API concurrency.

Scrape.do 的 Async-API 使用了**线程池模型**，这说明在服务端，他们认为线程池是处理大规模爬虫任务的最佳方式。

