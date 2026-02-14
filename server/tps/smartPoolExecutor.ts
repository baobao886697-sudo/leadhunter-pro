/**
 * TPS 智能并发池执行器 v6.0 (容错升级版)
 * 
 * 核心特性:
 * - 集成 TpsSmartConcurrencyPool 实现智能动态并发
 * - 4 线程 × 10 并发 = 最大 40 并发
 * - 任务规模评估，动态调整并发配置
 * - 实时积分扣除，积分不足时优雅停止
 * 
 * v6.0 容错升级:
 * - 502 指数退避重试 (2s → 4s → 6s)
 * - 429/502 延后重试队列 (借鉴 EXE 版 2+2 机制)
 * 
 * 独立模块: 仅用于 TPS 搜索功能
 */

import {
  TpsSmartConcurrencyPool,
  TPS_POOL_CONFIG,
  getTpsTaskScaleDescription,
  PoolTask,
  PoolResult,
  PoolStats,
} from './smartConcurrencyPool';
import { getTpsRuntimeConfig } from './runtimeConfig';
import {
  TpsDetailResult,
  TpsSearchResult,
  TpsFilters,
  DetailTaskWithIndex,
  parseDetailPage,
  shouldIncludeResult,
} from './scraper';
import { TpsRealtimeCreditTracker } from './realtimeCredits';
import { fetchWithScrapeClient } from './scrapeClient';

// ============================================================================
// 类型定义
// ============================================================================

export interface DetailFetchTask {
  link: string;
  searchResult: TpsSearchResult;
  subTaskIndex: number;
  name: string;
  location: string;
}

export interface DetailFetchResult {
  link: string;
  details: TpsDetailResult[];
  subTaskIndex: number;
}

export interface SmartPoolFetchResult {
  results: Array<{ task: DetailTaskWithIndex; details: TpsDetailResult[] }>;
  stats: {
    detailPageRequests: number;
    filteredOut: number;
    stoppedDueToCredits: boolean;
  };
}

// ============================================================================
// Scrape.do API 请求配置
// ============================================================================

// 默认配置（会被运行时配置覆盖）
let SCRAPE_TIMEOUT_MS = 5000;
let SCRAPE_MAX_RETRIES = 1;

/**
 * 使用共享的 scrapeClient 获取页面
 * 
 * 详情获取阶段使用此函数，并发由智能并发池控制
 * 
 * v6.0 容错升级:
 * - 502 指数退避重试 (2s → 4s → 6s)，最多 3 次
 * - 429 即时重试 2 次（间隔 1s），仍失败则抛出 ScrapeRateLimitError
 */
async function fetchWithScrapedo(url: string, token: string): Promise<string> {
  return await fetchWithScrapeClient(url, token, {
    timeoutMs: SCRAPE_TIMEOUT_MS,
    maxRetries: SCRAPE_MAX_RETRIES,
    retryDelayMs: 1000,  // 超时/网络错误重试前等待 1 秒
    enableLogging: false,  // 详情阶段不输出日志（避免日志过多）
    // 502 容错升级: 指数退避 2s → 4s → 6s
    maxRetries502: 3,
    retryBaseDelay502Ms: 2000,
    // 429 即时重试: 2 次，间隔 1s
    maxRetries429: 2,
    retryDelay429Ms: 1000,
  });
}

// ============================================================================
// 智能并发池详情获取
// ============================================================================

/**
 * 使用智能并发池获取详情
 * 
 * 特点:
 * 1. 根据任务数量动态调整并发配置
 * 2. 实时积分扣除，积分不足时优雅停止
 * 3. 负载均衡，任务均匀分配到各线程
 */
export async function fetchDetailsWithSmartPool(
  tasks: DetailTaskWithIndex[],
  token: string,
  filters: TpsFilters,
  onProgress: (message: string) => void,
  setCachedDetails: (items: Array<{ link: string; data: TpsDetailResult }>) => Promise<void>,
  creditTracker: TpsRealtimeCreditTracker
): Promise<SmartPoolFetchResult> {
  // 从数据库加载运行时配置
  const runtimeConfig = await getTpsRuntimeConfig();
  SCRAPE_TIMEOUT_MS = runtimeConfig.timeoutMs;
  SCRAPE_MAX_RETRIES = runtimeConfig.maxRetries;
  
  const results: Array<{ task: DetailTaskWithIndex; details: TpsDetailResult[] }> = [];
  let detailPageRequests = 0;
  let filteredOut = 0;
  let stoppedDueToCredits = false;
  
  const baseUrl = 'https://www.truepeoplesearch.com';
  
  // 去重详情链接
  const uniqueLinks = Array.from(new Set(tasks.map(t => t.searchResult.detailLink)));
  const tasksByLink = new Map<string, DetailTaskWithIndex[]>();
  
  for (const task of tasks) {
    const link = task.searchResult.detailLink;
    if (!tasksByLink.has(link)) {
      tasksByLink.set(link, []);
    }
    tasksByLink.get(link)!.push(task);
  }
  
  onProgress(`🔗 去重后 ${uniqueLinks.length} 个唯一详情链接`);
  
  // 检查可以负担多少条详情
  const affordCheck = await creditTracker.canAffordDetailBatch(uniqueLinks.length);
  let linksToFetch = uniqueLinks;
  
  if (!affordCheck.canAfford) {
    onProgress(`⚠️ 积分不足，无法获取详情`);
    stoppedDueToCredits = true;
    return { results, stats: { detailPageRequests, filteredOut, stoppedDueToCredits } };
  }
  
  if (affordCheck.affordableCount < uniqueLinks.length) {
    onProgress(`⚠️ 积分仅够获取 ${affordCheck.affordableCount}/${uniqueLinks.length} 条详情`);
    linksToFetch = uniqueLinks.slice(0, affordCheck.affordableCount);
    stoppedDueToCredits = true;
  }
  
  // 不再显示技术性的线程并发配置信息
  
  // 构建并发池任务
  const poolTasks: PoolTask<DetailFetchTask, DetailFetchResult>[] = [];
  const cacheToSave: Array<{ link: string; data: TpsDetailResult }> = [];
  
  for (const link of linksToFetch) {
    const linkTasks = tasksByLink.get(link);
    if (!linkTasks || linkTasks.length === 0) continue;
    
    const firstTask = linkTasks[0];
    poolTasks.push({
      id: link,
      data: {
        link,
        searchResult: firstTask.searchResult,
        subTaskIndex: firstTask.subTaskIndex,
        name: firstTask.name,
        location: firstTask.location,
      },
      execute: async (data: DetailFetchTask): Promise<DetailFetchResult> => {
        const detailUrl = data.link.startsWith('http') ? data.link : `${baseUrl}${data.link}`;
        const html = await fetchWithScrapedo(detailUrl, token);
        const details = parseDetailPage(html, data.searchResult);
        return {
          link: data.link,
          details,
          subTaskIndex: data.subTaskIndex,
        };
      },
    });
  }
  
  // 创建智能并发池
  const pool = new TpsSmartConcurrencyPool<DetailFetchTask, DetailFetchResult>(
    poolTasks.length,
    (stats: PoolStats) => {
      const percent = Math.round((stats.completedTasks / stats.totalTasks) * 100);
      if (stats.completedTasks % 10 === 0 || stats.completedTasks === stats.totalTasks) {
        onProgress(`📥 详情进度: ${stats.completedTasks}/${stats.totalTasks} (${percent}%)`);
      }
    }
  );
  
  // 执行任务
  onProgress(`📤 开始获取 ${poolTasks.length} 条详情...`);
  const poolResults = await pool.execute(poolTasks);
  
  // 处理结果
  for (const poolResult of poolResults) {
    if (!poolResult.success || !poolResult.result) {
      continue;
    }
    
    const { link, details, subTaskIndex } = poolResult.result;
    detailPageRequests++;
    
    // 实时扣除详情页费用
    const deductResult = await creditTracker.deductDetailPage();
    if (!deductResult.success) {
      stoppedDueToCredits = true;
      pool.stop();
      onProgress(`⚠️ 积分不足，停止获取详情`);
      break;
    }
    
    // 保存到缓存
    for (const detail of details) {
      if (detail.phone && detail.phone.length >= 10) {
        cacheToSave.push({ link, data: detail });
      }
    }
    
    // 过滤结果
    const detailsWithFlag = details.map(d => ({ ...d, fromCache: false }));
    const filtered = detailsWithFlag.filter(r => shouldIncludeResult(r, filters));
    filteredOut += details.length - filtered.length;
    
    // 关联到所有相同链接的任务
    const linkTasks = tasksByLink.get(link) || [];
    for (const task of linkTasks) {
      results.push({ task, details: filtered });
    }
  }
  
  // 保存缓存
  if (cacheToSave.length > 0) {
    onProgress(`💾 保存缓存: ${cacheToSave.length} 条...`);
    await setCachedDetails(cacheToSave);
  }
  
  // 统计信息
  const poolStats = pool.getStats();
  onProgress(`════════ 详情获取完成 ════════`);
  onProgress(`📊 详情页请求: ${detailPageRequests} 页`);
  onProgress(`📊 有效结果: ${results.length} 条`);
  onProgress(`📊 过滤排除: ${filteredOut} 条`);
  // v6.0: 显示延后重试统计
  if (poolStats.delayedRetryCount && poolStats.delayedRetryCount > 0) {
    onProgress(`🔄 延后重试: ${poolStats.delayedRetrySuccess}/${poolStats.delayedRetryCount} 成功`);
  }

  
  return {
    results,
    stats: {
      detailPageRequests,
      filteredOut,
      stoppedDueToCredits,
    },
  };
}
