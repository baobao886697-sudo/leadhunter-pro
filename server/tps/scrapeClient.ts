/**
 * Scrape.do API 客户端
 * 
 * 共享的核心请求模块，提供统一的 API 调用接口
 * 
 * 使用场景:
 * - scraper.ts: 搜索阶段（配合全局信号量使用）
 * - smartPoolExecutor.ts: 详情获取阶段（配合智能并发池使用）
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface ScrapeOptions {
  /** 请求超时时间（毫秒），默认 5000 */
  timeoutMs?: number;
  /** 最大重试次数，默认 1 */
  maxRetries?: number;
  /** 重试前等待时间（毫秒），默认 0 */
  retryDelayMs?: number;
  /** 是否输出日志，默认 false */
  enableLogging?: boolean;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_OPTIONS: Required<ScrapeOptions> = {
  timeoutMs: 5000,
  maxRetries: 1,
  retryDelayMs: 0,
  enableLogging: false,
};

// ============================================================================
// 核心请求函数
// ============================================================================

/**
 * 使用 Scrape.do API 获取页面内容
 * 
 * 特性:
 * - 可配置超时和重试
 * - 超时或网络错误时自动重试
 * - 不包含并发控制（由调用方管理）
 * 
 * @param url 目标 URL
 * @param token Scrape.do API token
 * @param options 可选配置
 * @returns 页面 HTML 内容
 */
export async function fetchWithScrapeClient(
  url: string,
  token: string,
  options?: ScrapeOptions
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { timeoutMs, maxRetries, retryDelayMs, enableLogging } = opts;
  
  const encodedUrl = encodeURIComponent(url);
  const apiUrl = `https://api.scrape.do/?token=${token}&url=${encodedUrl}&super=true&geoCode=us&timeout=${timeoutMs}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      // 客户端超时比 API 超时多 2 秒，确保能收到 API 的超时响应
      const clientTimeoutMs = timeoutMs + 2000;
      const timeoutId = setTimeout(() => controller.abort(), clientTimeoutMs);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Scrape.do API 请求失败: ${response.status} ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error: any) {
      lastError = error;
      
      // 如果是最后一次尝试，不再重试
      if (attempt >= maxRetries) {
        break;
      }
      
      // 超时或网络错误时重试
      const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
      const isNetworkError = error.message?.includes('fetch') || error.message?.includes('network');
      
      if (isTimeout || isNetworkError) {
        if (enableLogging) {
          console.log(`[ScrapeClient] 请求超时/失败，正在重试 (${attempt + 1}/${maxRetries})...`);
        }
        
        // 重试前等待
        if (retryDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
        
        continue;
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }
  
  throw lastError || new Error('请求失败');
}
