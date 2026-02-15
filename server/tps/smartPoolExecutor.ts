/**
 * TPS 智能并发池执行器 v7.0 (全局弹性并发版)
 * 
 * 核心特性:
 * - 集成 TpsSmartConcurrencyPool 实现智能动态并发
 * - v7.0: 所有HTTP请求统一通过全局弹性信号量控制
 * - v7.0: 新增 onDetailProgress 回调，实时推送详情获取进度
 * - 实时积分扣除，积分不足时优雅停止
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
import {
  TpsDetailResult,
  TpsSearchResult,
  TpsFilters,
  DetailTaskWithIndex,
  parseDetailPage,
  shouldIncludeResult,
  fetchWithScrapedo,  // v7.0: 使用scraper.ts中统一的全局信号量版本
} from './scraper';
import { TpsRealtimeCreditTracker } from './realtimeCredits';

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

/**
 * v7.0: 详情进度回调类型
 * 
 * 用于在每条详情获取完成后，实时向外部（router.ts）报告进度，
 * 使得 router.ts 可以更新数据库和推送 WebSocket 消息。
 */
export interface DetailProgressInfo {
  completedDetails: number;
  totalDetails: number;
  percent: number;
  phase: 'fetching' | 'retrying';
}

// ============================================================================
// 智能并发池详情获取
// ============================================================================

/**
 * 使用智能并发池获取详情
 * 
 * v7.0 升级:
 * 1. 所有HTTP请求通过 scraper.ts 的 fetchWithScrapedo (带全局弹性信号量)
 * 2. 新增 onDetailProgress 回调，每完成一条详情就通知外部
 * 3. userId 参数传递给全局信号量
 */
export async function fetchDetailsWithSmartPool(
  tasks: DetailTaskWithIndex[],
  token: string,
  filters: TpsFilters,
  onProgress: (message: string) => void,
  setCachedDetails: (items: Array<{ link: string; data: TpsDetailResult }>) => Promise<void>,
  creditTracker: TpsRealtimeCreditTracker,
  userId: number,
  onDetailProgress?: (info: DetailProgressInfo) => void
): Promise<SmartPoolFetchResult> {
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
  
  // v7.0: 追踪详情完成数，用于进度回调
  let completedDetailCount = 0;
  const totalDetailCount = linksToFetch.length;
  
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
        // v7.0: 使用全局弹性信号量版本的 fetchWithScrapedo
        const html = await fetchWithScrapedo(detailUrl, token, userId);
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
    
    // v7.0: 触发详情进度回调
    completedDetailCount++;
    if (onDetailProgress) {
      const percent = Math.round((completedDetailCount / totalDetailCount) * 100);
      onDetailProgress({
        completedDetails: completedDetailCount,
        totalDetails: totalDetailCount,
        percent,
        phase: 'fetching',
      });
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
