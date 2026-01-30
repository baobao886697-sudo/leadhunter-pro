/**
 * SPF 智能并发池执行器 v5.0
 * 
 * 核心特性:
 * - 集成 SpfSmartConcurrencyPool 实现智能动态并发
 * - 3 线程 × 10 并发 = 最大 30 并发
 * - 任务规模评估，动态调整并发配置
 * - 实时积分扣除，积分不足时优雅停止
 * 
 * 独立模块: 仅用于 SPF 搜索功能
 */

import {
  SpfSmartConcurrencyPool,
  SPF_POOL_CONFIG,
  getTaskScaleDescription,
  PoolTask,
  PoolResult,
  PoolStats,
} from './smartConcurrencyPool';
import {
  SpfDetailResult,
  SpfFilters,
  parseDetailPage,
} from './scraper';
import { RealtimeCreditTracker } from './realtimeCredits';

// ============================================================================
// 过滤函数
// ============================================================================

/**
 * 应用过滤条件
 */
function applyFilters(result: SpfDetailResult, filters: SpfFilters): boolean {
  // 年龄过滤
  if (result.age !== undefined) {
    if (filters.minAge !== undefined && result.age < filters.minAge) {
      return false;
    }
    if (filters.maxAge !== undefined && result.age > filters.maxAge) {
      return false;
    }
  }
  
  // 电话类型过滤
  if (result.phoneType) {
    if (filters.excludeLandline && result.phoneType === 'Landline') {
      return false;
    }
    if (filters.excludeWireless && result.phoneType === 'Wireless') {
      return false;
    }
  }
  
  return true;
}

// ============================================================================
// 类型定义
// ============================================================================

export interface DetailFetchTask {
  link: string;
  searchName: string;
  searchLocation: string;
  subTaskIndex: number;
}

export interface DetailFetchResult {
  link: string;
  details: SpfDetailResult[];
  subTaskIndex: number;
}

export interface SmartPoolFetchResult {
  results: Array<{ subTaskIndex: number; details: SpfDetailResult[] }>;
  stats: {
    detailPageRequests: number;
    filteredOut: number;
    stoppedDueToCredits: boolean;
  };
}

// ============================================================================
// Scrape.do API 请求函数
// ============================================================================

const SCRAPE_TIMEOUT_MS = 10000;
const SCRAPE_MAX_RETRIES = 2;

async function fetchWithScrapedo(url: string, token: string): Promise<string> {
  const encodedUrl = encodeURIComponent(url);
  const apiUrl = `https://api.scrape.do/?token=${token}&url=${encodedUrl}&super=true&geoCode=us&timeout=${SCRAPE_TIMEOUT_MS}`;
  
  for (let attempt = 0; attempt <= SCRAPE_MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS + 2000);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error: any) {
      if (attempt === SCRAPE_MAX_RETRIES) {
        throw error;
      }
      // 重试前等待
      await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
    }
  }
  
  throw new Error('请求失败');
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
export async function fetchDetailsWithSpfSmartPool(
  detailLinks: string[],
  token: string,
  filters: SpfFilters,
  onProgress: (message: string) => void,
  setCachedDetails: (items: Array<{ link: string; data: SpfDetailResult }>) => Promise<void>,
  creditTracker: RealtimeCreditTracker
): Promise<SmartPoolFetchResult> {
  const results: Array<{ subTaskIndex: number; details: SpfDetailResult[] }> = [];
  let detailPageRequests = 0;
  let filteredOut = 0;
  let stoppedDueToCredits = false;
  
  const baseUrl = 'https://www.searchpeoplefree.com';
  
  // 去重详情链接
  const uniqueLinks = Array.from(new Set(detailLinks));
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
  
  // 显示任务规模和并发配置
  const scaleDesc = getTaskScaleDescription(linksToFetch.length);
  onProgress(`🧵 ${scaleDesc}`);
  
  // 构建并发池任务
  const poolTasks: PoolTask<DetailFetchTask, DetailFetchResult>[] = [];
  const cacheToSave: Array<{ link: string; data: SpfDetailResult }> = [];
  
  for (let i = 0; i < linksToFetch.length; i++) {
    const link = linksToFetch[i];
    poolTasks.push({
      id: link,
      data: {
        link,
        searchName: '',
        searchLocation: '',
        subTaskIndex: i,
      },
      execute: async (data: DetailFetchTask): Promise<DetailFetchResult> => {
        const detailUrl = data.link.startsWith('http') ? data.link : `${baseUrl}${data.link}`;
        const html = await fetchWithScrapedo(detailUrl, token);
        const detail = parseDetailPage(html, data.link);
        return {
          link: data.link,
          details: detail ? [detail] : [],
          subTaskIndex: data.subTaskIndex,
        };
      },
    });
  }
  
  // 创建智能并发池
  const pool = new SpfSmartConcurrencyPool<DetailFetchTask, DetailFetchResult>(
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
    const filtered = detailsWithFlag.filter(r => applyFilters(r, filters));
    filteredOut += details.length - filtered.length;
    
    if (filtered.length > 0) {
      results.push({ subTaskIndex, details: filtered });
    }
  }
  
  // 保存缓存
  if (cacheToSave.length > 0) {
    // 静默保存缓存，不输出日志
    await setCachedDetails(cacheToSave);
  }
  
  // 统计信息
  const poolStats = pool.getStats();
  onProgress(`════════ 详情获取完成 ════════`);
  onProgress(`📊 详情页请求: ${detailPageRequests} 页`);
  onProgress(`📊 有效结果: ${results.reduce((sum, r) => sum + r.details.length, 0)} 条`);
  onProgress(`📊 过滤排除: ${filteredOut} 条`);
  onProgress(`📊 错误率: ${(poolStats.errorRate * 100).toFixed(1)}%`);
  onProgress(`📊 平均响应: ${poolStats.avgResponseTime.toFixed(0)}ms`);
  
  return {
    results,
    stats: {
      detailPageRequests,
      filteredOut,
      stoppedDueToCredits,
    },
  };
}
