/**
 * TruePeopleSearch 爬虫服务
 * 
 * 基于 EXE 版本的 scraper.js 移植，适配 DataReach Pro Web 平台
 * 
 * 功能：
 * - 通过 Scrape.do 代理访问 TruePeopleSearch
 * - 解析搜索页和详情页
 * - 智能动态并发控制
 * - 过滤和去重
 * - 2+2 延后重试机制（与 EXE 客户端一致）
 * 
 * v3.0 更新:
 * - 实现三层动态并发模型（任务级、搜索页级、详情页级）
 * - 根据活跃任务数动态分配并发资源
 * - 根据数据量（页数、详情数）动态调整批次大小
 * - 任务完成后自动加速剩余任务
 */

import * as cheerio from 'cheerio';

// ==================== 配置 ====================
export const TPS_CONFIG = {
  SCRAPEDO_BASE: 'https://api.scrape.do',
  TPS_BASE: 'https://www.truepeoplesearch.com',
  RESULTS_PER_PAGE: 10,
  MAX_SAFE_PAGES: 25,
  MAX_RECORDS: 250,
  REQUEST_TIMEOUT: 30000,
  BATCH_DELAY: 100,  // 优化: 100ms 批次延迟（追求极致速度）
  BASE_CONCURRENCY: 40,  // Scrape.do 账户总并发限制
  // 重试配置（与 EXE 客户端一致）
  IMMEDIATE_RETRIES: 2,       // 即时重试次数
  IMMEDIATE_RETRY_DELAY: 1000, // 即时重试延迟 (1秒)
  DEFERRED_RETRIES: 2,        // 延后重试次数
  DEFERRED_RETRY_DELAY: 2000, // 延后重试延迟 (2秒)
};

// ==================== 动态并发管理器 ====================

/**
 * 任务并发管理器
 * 
 * 管理多任务并发时的 Scrape.do 并发资源分配
 * 核心原则：总并发数始终保持在 40，根据活跃任务数动态分配
 */
export class TaskConcurrencyManager {
  private activeTasks: number = 0;
  private baseConcurrency: number;
  private listeners: Set<() => void> = new Set();
  
  constructor(baseConcurrency: number = TPS_CONFIG.BASE_CONCURRENCY) {
    this.baseConcurrency = baseConcurrency;
  }
  
  /**
   * 获取一个任务槽位，返回该任务应使用的并发数
   */
  acquire(): number {
    this.activeTasks++;
    return this.calculateConcurrency();
  }
  
  /**
   * 释放一个任务槽位
   */
  release(): void {
    this.activeTasks = Math.max(0, this.activeTasks - 1);
    // 通知所有监听者并发数已更新
    this.notifyListeners();
  }
  
  /**
   * 获取当前活跃任务数
   */
  getActiveTasks(): number {
    return this.activeTasks;
  }
  
  /**
   * 计算每任务应分配的并发数
   * 
   * 分配策略（与 EXE 客户端一致）：
   * - 1 任务: 40 并发（独享全部资源）
   * - 2 任务: 各 20 并发
   * - 3-4 任务: 各 10 并发
   * - 5-8 任务: 各 5 并发
   * - 8+ 任务: 平均分配，最少 2 并发
   */
  calculateConcurrency(): number {
    if (this.activeTasks <= 0) return this.baseConcurrency;
    if (this.activeTasks === 1) return this.baseConcurrency;  // 40
    if (this.activeTasks === 2) return 20;
    if (this.activeTasks <= 4) return 10;
    if (this.activeTasks <= 8) return 5;
    return Math.max(2, Math.floor(this.baseConcurrency / this.activeTasks));
  }
  
  /**
   * 获取当前每任务并发数
   */
  getCurrentConcurrency(): number {
    return this.calculateConcurrency();
  }
  
  /**
   * 注册并发变化监听器
   */
  onConcurrencyChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Concurrency listener error:', e);
      }
    }
  }
}

// 全局并发管理器实例
export const globalConcurrencyManager = new TaskConcurrencyManager();

/**
 * 根据数据量计算搜索页并发数
 * 
 * 策略：页数少时降低并发，避免浪费资源
 */
export function calculateSearchPageConcurrency(
  totalPages: number,
  baseConcurrency: number
): number {
  if (totalPages <= 3) return Math.min(totalPages, baseConcurrency);
  if (totalPages <= 5) return Math.min(5, baseConcurrency);
  if (totalPages <= 10) return Math.min(10, baseConcurrency);
  return baseConcurrency;
}

/**
 * 根据数据量计算详情页并发数
 * 
 * 策略：详情少时降低并发，详情多时使用全部并发
 */
export function calculateDetailPageConcurrency(
  totalDetails: number,
  baseConcurrency: number
): number {
  if (totalDetails <= 5) return Math.min(totalDetails, baseConcurrency);
  if (totalDetails <= 20) return Math.min(10, baseConcurrency);
  if (totalDetails <= 50) return Math.min(15, baseConcurrency);
  if (totalDetails <= 100) return Math.min(20, baseConcurrency);
  return baseConcurrency;
}

// ==================== 类型定义 ====================
export interface TpsFilters {
  minAge?: number;
  maxAge?: number;
  minYear?: number;
  minPropertyValue?: number;
  excludeTMobile?: boolean;
  excludeComcast?: boolean;
  excludeLandline?: boolean;
}

export interface TpsSearchResult {
  name: string;
  detailLink: string;
  age?: number;
  location?: string;
}

export interface TpsDetailResult {
  name: string;
  firstName: string;
  lastName: string;
  age: number;
  city: string;
  state: string;
  location: string;
  phone: string;
  phoneType: string;
  carrier: string;
  reportYear: number | null;
  isPrimary: boolean;
  propertyValue: number;
  yearBuilt: number | null;
  isDeceased: boolean;
}

export interface TpsSearchPageResult {
  totalRecords: number;
  results: TpsSearchResult[];
  hasNextPage: boolean;
  stats: {
    skippedNoAge: number;
    skippedDeceased: number;
    skippedAgeRange: number;
  };
}

export interface TpsFetchResult {
  ok: boolean;
  html?: string;
  error?: string;
  statusCode?: number;
  needDeferredRetry?: boolean;
}

export interface TpsFullSearchStats {
  totalRecords: number;
  pagesSearched: number;
  detailsFetched: number;
  skippedNoAge: number;
  skippedDeceased: number;
  skippedAgeRange: number;
  skippedFilters: number;
  validResults: number;
  searchPageRequests: number;
  detailPageRequests: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  skippedDuplicateLinks?: number;
  skippedDuplicatePhones?: number;
  immediateRetries?: number;
  deferredRetries?: number;
  rateLimitedRequests?: number;
  // 新增：动态并发统计
  avgSearchConcurrency?: number;
  avgDetailConcurrency?: number;
}

export interface TpsFullSearchResult {
  success: boolean;
  error?: string;
  results: TpsDetailResult[];
  totalRecords: number;
  pagesSearched: number;
  finalCount: number;
  stats: TpsFullSearchStats;
  logs: string[];
}

// ==================== URL 构建 ====================

export function buildSearchUrl(name: string, location: string = '', page: number = 1): string {
  const encodedName = encodeURIComponent(name.trim());
  let url = `${TPS_CONFIG.TPS_BASE}/results?name=${encodedName}`;
  
  if (location && location.trim()) {
    url += `&citystatezip=${encodeURIComponent(location.trim())}`;
  }
  
  if (page > 1) {
    url += `&page=${page}`;
  }
  
  return url;
}

export function buildDetailUrl(detailLink: string): string {
  if (detailLink.startsWith('http')) {
    return detailLink;
  }
  return `${TPS_CONFIG.TPS_BASE}${detailLink}`;
}

// ==================== 代理请求 ====================

export async function fetchViaProxy(
  url: string, 
  token: string, 
  maxRetries: number = TPS_CONFIG.IMMEDIATE_RETRIES,
  retryDelay: number = TPS_CONFIG.IMMEDIATE_RETRY_DELAY
): Promise<TpsFetchResult> {
  let lastError: TpsFetchResult = { ok: false, error: '未知错误' };
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const encodedUrl = encodeURIComponent(url);
      const apiUrl = `${TPS_CONFIG.SCRAPEDO_BASE}/?token=${token}&url=${encodedUrl}&super=true&geoCode=us&timeout=30000`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TPS_CONFIG.REQUEST_TIMEOUT);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        lastError = {
          ok: false,
          error: `请求被限流 (429)，第 ${attempt + 1} 次尝试`,
          statusCode: 429
        };
        
        if (attempt < maxRetries) {
          await delay(retryDelay);
          continue;
        }
        
        return {
          ok: false,
          error: '请求被限流 (429)，需要延后重试',
          statusCode: 429,
          needDeferredRetry: true
        };
      }
      
      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status
        };
      }
      
      const html = await response.text();
      
      if (html.includes('Access Denied') || html.includes('blocked') || html.includes('captcha')) {
        return {
          ok: false,
          error: '访问被阻止，请稍后重试',
          statusCode: 403
        };
      }
      
      return { ok: true, html };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        lastError = { ok: false, error: '请求超时', statusCode: 408 };
      } else {
        lastError = { ok: false, error: error.message || '请求失败' };
      }
      
      if (attempt < maxRetries) {
        await delay(retryDelay);
        continue;
      }
    }
  }
  
  return lastError;
}

// ==================== 页面解析 ====================

export function parseSearchPage(html: string, filters: TpsFilters): TpsSearchPageResult {
  const $ = cheerio.load(html);
  
  // 提取总记录数 - 多种选择器
  let totalRecords = 0;
  const recordText = $('.search-results-header, .results-header, .record-count .col-7, .record-count .col').text();
  const totalMatch = recordText.match(/(\d+)\s*records?\s*found/i);
  if (totalMatch) {
    totalRecords = parseInt(totalMatch[1]);
  }
  
  if (totalRecords === 0) {
    const countEl = $('[data-total-count]');
    if (countEl.length) {
      totalRecords = parseInt(countEl.attr('data-total-count') || '0');
    }
  }
  
  const results: TpsSearchResult[] = [];
  const stats = {
    skippedNoAge: 0,
    skippedDeceased: 0,
    skippedAgeRange: 0
  };
  
  $('.card-summary').each((i, card) => {
    const $card = $(card);
    const cardText = $card.text();
    
    if (cardText.includes('Deceased')) {
      stats.skippedDeceased++;
      return;
    }
    
    const detailLink = $card.attr('data-detail-link');
    if (!detailLink) return;
    
    const name = $card.find('.content-header').first().text().trim();
    if (!name) return;
    
    // 年龄提取 - 方法1: DOM
    let age: number | undefined;
    $card.find('.content-label').each((j, label) => {
      if ($(label).text().trim() === 'Age') {
        const ageValue = $(label).next('.content-value').text().trim();
        const parsed = parseInt(ageValue);
        if (!isNaN(parsed)) {
          age = parsed;
        }
      }
    });
    
    // 年龄提取 - 方法2: 正则（备用）
    if (!age) {
      const ageMatch = cardText.match(/Age\s+(\d+)/i);
      if (ageMatch) {
        age = parseInt(ageMatch[1]);
      }
    }
    
    if (filters.minAge || filters.maxAge) {
      if (!age) {
        stats.skippedNoAge++;
        return;
      }
      const minAge = filters.minAge || 0;
      const maxAge = filters.maxAge || 120;
      if (age < minAge || age > maxAge) {
        stats.skippedAgeRange++;
        return;
      }
    }
    
    const locationEl = $card.find('.content-value').first();
    const location = locationEl.text().trim();
    
    results.push({
      name,
      detailLink,
      age,
      location
    });
  });
  
  const hasNextPage = $('#btnNextPage').length > 0;
  
  return {
    totalRecords,
    results,
    hasNextPage,
    stats
  };
}

export function parseDetailPage(html: string): TpsDetailResult | null {
  const $ = cheerio.load(html);
  
  const pageText = $('body').text();
  if (pageText.includes('Deceased')) {
    return { isDeceased: true } as any;
  }
  
  const personDetails = $('#personDetails');
  if (!personDetails.length) {
    return null;
  }
  
  const firstName = personDetails.attr('data-fn') || '';
  const lastName = personDetails.attr('data-ln') || '';
  const ageStr = personDetails.attr('data-age');
  const city = personDetails.attr('data-city') || '';
  const state = personDetails.attr('data-state') || '';
  
  const age = parseInt(ageStr || '0');
  if (!age || isNaN(age)) {
    return null;
  }
  
  // 房产信息
  let propertyValue = 0;
  let yearBuilt: number | null = null;
  
  $('.property-card, .property-info').each((i, el) => {
    const $el = $(el);
    const text = $el.text();
    
    const valueMatch = text.match(/\$[\d,]+/);
    if (valueMatch && propertyValue === 0) {
      propertyValue = parseInt(valueMatch[0].replace(/[$,]/g, ''));
    }
    
    const yearMatch = text.match(/Year Built[:\s]*(\d{4})/i);
    if (yearMatch && !yearBuilt) {
      yearBuilt = parseInt(yearMatch[1]);
    }
  });
  
  // 电话信息
  let phone = '';
  let phoneType = '';
  let carrier = '';
  let reportYear: number | null = null;
  let isPrimary = false;
  
  const phoneCards = $('.phone-card, .phone-info, [data-phone]');
  
  phoneCards.each((i, el) => {
    const $el = $(el);
    const phoneNum = $el.attr('data-phone') || $el.find('.phone-number').text().trim();
    
    if (phoneNum && !phone) {
      phone = phoneNum.replace(/\D/g, '');
      
      // 电话类型 - 方法1: DOM
      const typeEl = $el.find('.phone-type, [data-phone-type]');
      phoneType = typeEl.attr('data-phone-type') || typeEl.text().trim();
      
      // 电话类型 - 方法2: 文本判断（备用）
      if (!phoneType) {
        const elText = $el.text().toLowerCase();
        if (elText.includes('wireless') || elText.includes('mobile') || elText.includes('cell')) {
          phoneType = 'Wireless';
        } else if (elText.includes('landline') || elText.includes('land line')) {
          phoneType = 'Landline';
        } else if (elText.includes('voip')) {
          phoneType = 'VoIP';
        }
      }
      
      // 运营商 - 方法1: DOM
      const carrierEl = $el.find('.carrier, [data-carrier]');
      carrier = carrierEl.attr('data-carrier') || carrierEl.text().trim();
      
      // 运营商 - 方法2: 正则（备用）
      if (!carrier) {
        const carrierMatch = $el.text().match(/(?:Carrier|Provider)[:\s]*([A-Za-z\s-]+)/i);
        if (carrierMatch) {
          carrier = carrierMatch[1].trim();
        }
      }
      
      // 报告年份
      const yearEl = $el.find('.report-year, [data-year]');
      const yearText = yearEl.attr('data-year') || yearEl.text();
      if (yearText) {
        const yearMatch = yearText.match(/\d{4}/);
        if (yearMatch) {
          reportYear = parseInt(yearMatch[0]);
        }
      }
      
      isPrimary = $el.hasClass('primary') || $el.find('.primary').length > 0;
    }
  });
  
  return {
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    age,
    city,
    state,
    location: city && state ? `${city}, ${state}` : (city || state || ''),
    phone,
    phoneType,
    carrier,
    reportYear,
    isPrimary,
    propertyValue,
    yearBuilt,
    isDeceased: false
  };
}

// ==================== 过滤逻辑 ====================

export function shouldIncludeResult(result: TpsDetailResult, filters: TpsFilters): boolean {
  const minAge = filters.minAge || 0;
  const maxAge = filters.maxAge || 120;
  if (result.age < minAge || result.age > maxAge) return false;
  
  const minYear = filters.minYear || 2000;
  if (result.reportYear && result.reportYear < minYear) return false;
  
  const minPropertyValue = filters.minPropertyValue || 0;
  if (minPropertyValue > 0 && (!result.propertyValue || result.propertyValue < minPropertyValue)) return false;
  
  const carrierLower = (result.carrier || '').toLowerCase();
  if (filters.excludeTMobile && carrierLower.includes('t-mobile')) return false;
  if (filters.excludeComcast && (carrierLower.includes('comcast') || carrierLower.includes('spectrum'))) return false;
  
  if (filters.excludeLandline && result.phoneType?.toLowerCase() === 'landline') return false;
  
  return true;
}

// ==================== 工具函数 ====================

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BatchFetchResult {
  results: TpsFetchResult[];
  deferredUrls: string[];
}

/**
 * 动态并发批量获取页面
 * 
 * 支持：
 * - 动态并发数（通过 getConcurrency 回调获取最新并发数）
 * - 延后重试队列收集
 * - 自适应批次大小
 */
export async function fetchBatchDynamic(
  urls: string[], 
  token: string, 
  getConcurrency: () => number,
  batchDelay: number = TPS_CONFIG.BATCH_DELAY
): Promise<BatchFetchResult> {
  const results: TpsFetchResult[] = [];
  const deferredUrls: string[] = [];
  
  let i = 0;
  while (i < urls.length) {
    // 每批开始时获取最新并发数
    const concurrency = getConcurrency();
    const batch = urls.slice(i, i + concurrency);
    
    const batchPromises = batch.map(url => fetchViaProxy(url, token));
    const batchResults = await Promise.all(batchPromises);
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const url = batch[j];
      
      if (result.needDeferredRetry) {
        deferredUrls.push(url);
        results.push({ ok: false, error: 'DEFERRED', statusCode: 429, needDeferredRetry: true });
      } else {
        results.push(result);
      }
    }
    
    i += batch.length;
    
    if (i < urls.length) {
      await delay(batchDelay);
    }
  }
  
  return { results, deferredUrls };
}

/**
 * 执行延后重试
 */
async function executeDeferredRetry(
  urls: string[],
  token: string,
  getConcurrency: () => number,
  log: (msg: string) => void
): Promise<Map<string, TpsFetchResult>> {
  const results = new Map<string, TpsFetchResult>();
  
  if (urls.length === 0) {
    return results;
  }
  
  log(`⏳ 开始延后重试 ${urls.length} 个被限流的请求...`);
  
  for (let retryAttempt = 0; retryAttempt < TPS_CONFIG.DEFERRED_RETRIES; retryAttempt++) {
    if (urls.length === 0) break;
    
    log(`⏳ 延后重试第 ${retryAttempt + 1}/${TPS_CONFIG.DEFERRED_RETRIES} 轮，剩余 ${urls.length} 个请求...`);
    
    await delay(TPS_CONFIG.DEFERRED_RETRY_DELAY);
    
    const stillDeferred: string[] = [];
    // 延后重试使用更低的并发
    const deferredConcurrency = Math.max(3, Math.floor(getConcurrency() / 2));
    
    for (let i = 0; i < urls.length; i += deferredConcurrency) {
      const batch = urls.slice(i, i + deferredConcurrency);
      
      const batchPromises = batch.map(url => 
        fetchViaProxy(url, token, 1, TPS_CONFIG.DEFERRED_RETRY_DELAY)
      );
      const batchResults = await Promise.all(batchPromises);
      
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const url = batch[j];
        
        if (result.ok) {
          results.set(url, result);
        } else if (result.statusCode === 429) {
          stillDeferred.push(url);
        } else {
          results.set(url, result);
        }
      }
      
      if (i + deferredConcurrency < urls.length) {
        await delay(TPS_CONFIG.BATCH_DELAY * 2);
      }
    }
    
    urls = stillDeferred;
  }
  
  for (const url of urls) {
    results.set(url, {
      ok: false,
      error: '延后重试后仍然被限流 (429)',
      statusCode: 429
    });
  }
  
  if (urls.length > 0) {
    log(`⚠️ ${urls.length} 个请求在延后重试后仍然失败`);
  } else {
    log(`✅ 延后重试完成，所有请求已处理`);
  }
  
  return results;
}

// ==================== 完整搜索流程 ====================

export interface TpsFullSearchOptions {
  maxPages?: number;
  filters?: TpsFilters;
  getConcurrency?: () => number;  // 动态获取并发数
  onProgress?: (message: string) => void;
  getCachedDetails?: (links: string[]) => Promise<Map<string, TpsDetailResult>>;
  setCachedDetails?: (items: Array<{ link: string; data: TpsDetailResult }>) => Promise<void>;
}

/**
 * 完整搜索流程（支持动态并发）
 */
export async function fullSearch(
  name: string,
  location: string = '',
  token: string,
  options: TpsFullSearchOptions = {}
): Promise<TpsFullSearchResult> {
  const {
    maxPages = TPS_CONFIG.MAX_SAFE_PAGES,
    filters = {},
    getConcurrency = () => TPS_CONFIG.BASE_CONCURRENCY,
    onProgress = () => {},
    getCachedDetails,
    setCachedDetails
  } = options;
  
  const logs: string[] = [];
  const log = (msg: string) => {
    const logMsg = `[${new Date().toISOString()}] ${msg}`;
    logs.push(logMsg);
    onProgress(logMsg);
  };
  
  log(`🔍 开始搜索: ${name}${location ? ` @ ${location}` : ''}`);
  log(`⚡ 当前并发数: ${getConcurrency()}`);
  
  const stats: TpsFullSearchStats = {
    totalRecords: 0,
    pagesSearched: 0,
    detailsFetched: 0,
    skippedNoAge: 0,
    skippedDeceased: 0,
    skippedAgeRange: 0,
    skippedFilters: 0,
    validResults: 0,
    searchPageRequests: 0,
    detailPageRequests: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    immediateRetries: 0,
    deferredRetries: 0,
    rateLimitedRequests: 0,
    avgSearchConcurrency: 0,
    avgDetailConcurrency: 0
  };
  
  // ==================== 第一阶段：获取第一页 ====================
  const firstPageUrl = buildSearchUrl(name, location, 1);
  log(`📄 获取第一页...`);
  
  const firstPageResult = await fetchViaProxy(firstPageUrl, token);
  stats.searchPageRequests = 1;
  
  if (!firstPageResult.ok) {
    if (firstPageResult.needDeferredRetry) {
      log(`⚠️ 第一页被限流，尝试延后重试...`);
      const deferredResults = await executeDeferredRetry([firstPageUrl], token, getConcurrency, log);
      const retryResult = deferredResults.get(firstPageUrl);
      if (!retryResult?.ok) {
        log(`❌ 第一页获取失败: ${retryResult?.error || firstPageResult.error}`);
        return {
          success: false,
          error: retryResult?.error || firstPageResult.error,
          results: [],
          totalRecords: 0,
          pagesSearched: 0,
          finalCount: 0,
          stats,
          logs
        };
      }
      firstPageResult.ok = true;
      firstPageResult.html = retryResult.html;
    } else {
      log(`❌ 第一页获取失败: ${firstPageResult.error}`);
      return {
        success: false,
        error: firstPageResult.error,
        results: [],
        totalRecords: 0,
        pagesSearched: 0,
        finalCount: 0,
        stats,
        logs
      };
    }
  }
  
  const firstPageData = parseSearchPage(firstPageResult.html!, filters);
  stats.totalRecords = firstPageData.totalRecords;
  stats.pagesSearched = 1;
  stats.skippedNoAge += firstPageData.stats.skippedNoAge;
  stats.skippedDeceased += firstPageData.stats.skippedDeceased;
  stats.skippedAgeRange += firstPageData.stats.skippedAgeRange;
  
  log(`📊 找到 ${firstPageData.totalRecords} 条记录`);
  log(`✅ 第一页: ${firstPageData.results.length} 条通过初筛`);
  
  const allDetailLinks = [...firstPageData.results.map(r => r.detailLink)];
  const searchPageResults = [...firstPageData.results];
  
  // ==================== 第二阶段：并发获取剩余搜索页 ====================
  if (firstPageData.totalRecords > TPS_CONFIG.RESULTS_PER_PAGE && firstPageData.hasNextPage) {
    const totalPages = Math.min(
      Math.ceil(firstPageData.totalRecords / TPS_CONFIG.RESULTS_PER_PAGE),
      maxPages
    );
    
    if (totalPages > 1) {
      const remainingPages = totalPages - 1;
      // 根据页数动态计算搜索页并发
      const searchConcurrency = calculateSearchPageConcurrency(remainingPages, getConcurrency());
      stats.avgSearchConcurrency = searchConcurrency;
      
      log(`📄 并发获取剩余 ${remainingPages} 个搜索页 (动态并发: ${searchConcurrency})...`);
      
      const remainingPageUrls: string[] = [];
      for (let page = 2; page <= totalPages; page++) {
        remainingPageUrls.push(buildSearchUrl(name, location, page));
      }
      
      const { results: pageResults, deferredUrls } = await fetchBatchDynamic(
        remainingPageUrls, 
        token, 
        () => calculateSearchPageConcurrency(remainingPages, getConcurrency())
      );
      stats.searchPageRequests += remainingPageUrls.length;
      
      if (deferredUrls.length > 0) {
        stats.rateLimitedRequests = (stats.rateLimitedRequests || 0) + deferredUrls.length;
        log(`⚠️ ${deferredUrls.length} 个搜索页被限流，将在后续延后重试`);
      }
      
      for (let i = 0; i < pageResults.length; i++) {
        const pageResult = pageResults[i];
        const pageNum = i + 2;
        
        if (pageResult.ok && pageResult.html) {
          const pageData = parseSearchPage(pageResult.html, filters);
          stats.pagesSearched++;
          stats.skippedNoAge += pageData.stats.skippedNoAge;
          stats.skippedDeceased += pageData.stats.skippedDeceased;
          stats.skippedAgeRange += pageData.stats.skippedAgeRange;
          
          for (const result of pageData.results) {
            allDetailLinks.push(result.detailLink);
            searchPageResults.push(result);
          }
          
          log(`✅ 搜索页 ${pageNum}: ${pageData.results.length} 条通过初筛`);
        } else if (!pageResult.needDeferredRetry) {
          log(`❌ 搜索页 ${pageNum} 获取失败: ${pageResult.error}`);
        }
      }
      
      // 搜索页延后重试
      if (deferredUrls.length > 0) {
        const deferredResults = await executeDeferredRetry(deferredUrls, token, getConcurrency, log);
        stats.deferredRetries = (stats.deferredRetries || 0) + deferredUrls.length;
        
        for (const [url, result] of deferredResults) {
          if (result.ok && result.html) {
            const pageData = parseSearchPage(result.html, filters);
            stats.pagesSearched++;
            stats.skippedNoAge += pageData.stats.skippedNoAge;
            stats.skippedDeceased += pageData.stats.skippedDeceased;
            stats.skippedAgeRange += pageData.stats.skippedAgeRange;
            
            for (const r of pageData.results) {
              allDetailLinks.push(r.detailLink);
              searchPageResults.push(r);
            }
            
            log(`✅ 延后重试成功: ${pageData.results.length} 条通过初筛`);
          }
        }
      }
    }
  }
  
  // 详情链接去重
  const uniqueDetailLinks = Array.from(new Set(allDetailLinks));
  stats.skippedDuplicateLinks = allDetailLinks.length - uniqueDetailLinks.length;
  
  if (stats.skippedDuplicateLinks > 0) {
    log(`🔄 任务内去重: 发现 ${stats.skippedDuplicateLinks} 个重复的详情链接`);
  }
  
  log(`📋 搜索页完成: 共 ${uniqueDetailLinks.length} 条需要获取详情`);
  
  // ==================== 第三阶段：并发获取详情页 ====================
  if (uniqueDetailLinks.length === 0) {
    return {
      success: true,
      results: [],
      totalRecords: stats.totalRecords,
      pagesSearched: stats.pagesSearched,
      finalCount: 0,
      stats,
      logs
    };
  }
  
  // 查询缓存
  let cachedResults = new Map<string, TpsDetailResult>();
  let linksToFetch = uniqueDetailLinks;
  
  if (getCachedDetails) {
    try {
      cachedResults = await getCachedDetails(uniqueDetailLinks);
      linksToFetch = uniqueDetailLinks.filter(link => !cachedResults.has(link));
      
      stats.cacheHits = cachedResults.size;
      stats.cacheMisses = linksToFetch.length;
      
      if (cachedResults.size > 0) {
        log(`💾 缓存命中: ${cachedResults.size} 条记录从缓存读取`);
      }
    } catch (error) {
      console.error('缓存查询失败:', error);
      linksToFetch = uniqueDetailLinks;
    }
  }
  
  const fetchedResults: Array<{ link: string; data: TpsDetailResult | null }> = [];
  
  if (linksToFetch.length > 0) {
    // 根据详情数量动态计算详情页并发
    const detailConcurrency = calculateDetailPageConcurrency(linksToFetch.length, getConcurrency());
    stats.avgDetailConcurrency = detailConcurrency;
    
    log(`🔄 并发获取 ${linksToFetch.length} 个详情页 (动态并发: ${detailConcurrency})...`);
    
    const detailUrls = linksToFetch.map(link => buildDetailUrl(link));
    
    const { results: detailFetchResults, deferredUrls } = await fetchBatchDynamic(
      detailUrls, 
      token, 
      () => calculateDetailPageConcurrency(linksToFetch.length, getConcurrency()),
      TPS_CONFIG.BATCH_DELAY * 1.5  // 详情页使用稍长的延迟
    );
    
    if (deferredUrls.length > 0) {
      stats.rateLimitedRequests = (stats.rateLimitedRequests || 0) + deferredUrls.length;
      log(`⚠️ ${deferredUrls.length} 个详情页被限流，将在后续延后重试`);
    }
    
    const urlToLink = new Map<string, string>();
    for (let i = 0; i < linksToFetch.length; i++) {
      urlToLink.set(detailUrls[i], linksToFetch[i]);
    }
    
    const cacheItems: Array<{ link: string; data: TpsDetailResult }> = [];
    
    for (let i = 0; i < detailFetchResults.length; i++) {
      const result = detailFetchResults[i];
      const link = linksToFetch[i];
      
      if (result.ok && result.html) {
        const parsed = parseDetailPage(result.html);
        fetchedResults.push({ link, data: parsed });
        
        if (parsed && setCachedDetails) {
          cacheItems.push({ link, data: parsed });
        }
      } else if (!result.needDeferredRetry) {
        fetchedResults.push({ link, data: null });
      }
    }
    
    // 详情页延后重试
    if (deferredUrls.length > 0) {
      const deferredDetailResults = await executeDeferredRetry(deferredUrls, token, getConcurrency, log);
      stats.deferredRetries = (stats.deferredRetries || 0) + deferredUrls.length;
      
      for (const [url, result] of deferredDetailResults) {
        const link = urlToLink.get(url);
        if (!link) continue;
        
        if (result.ok && result.html) {
          const parsed = parseDetailPage(result.html);
          fetchedResults.push({ link, data: parsed });
          
          if (parsed && setCachedDetails) {
            cacheItems.push({ link, data: parsed });
          }
          
          log(`✅ 详情页延后重试成功`);
        } else {
          fetchedResults.push({ link, data: null });
        }
      }
    }
    
    if (cacheItems.length > 0 && setCachedDetails) {
      setCachedDetails(cacheItems).catch(err => {
        console.error('保存详情页缓存失败:', err);
      });
      log(`💾 缓存更新: ${cacheItems.length} 条新记录已加入缓存`);
    }
  }
  
  stats.detailPageRequests = linksToFetch.length;
  
  // 合并结果
  const detailResults = uniqueDetailLinks.map(link => {
    if (cachedResults.has(link)) {
      return cachedResults.get(link)!;
    }
    const fetched = fetchedResults.find(r => r.link === link);
    return fetched?.data || null;
  });
  
  stats.detailsFetched = detailResults.filter(r => r !== null).length;
  
  // ==================== 第四阶段：应用过滤条件 ====================
  const filteredResults: TpsDetailResult[] = [];
  
  for (const detail of detailResults) {
    if (!detail) {
      stats.skippedNoAge++;
      continue;
    }
    
    if (detail.isDeceased) {
      stats.skippedDeceased++;
      continue;
    }
    
    if (!shouldIncludeResult(detail, filters)) {
      stats.skippedFilters++;
      continue;
    }
    
    filteredResults.push(detail);
  }
  
  // 电话号码去重
  const seenPhones = new Set<string>();
  const finalResults: TpsDetailResult[] = [];
  stats.skippedDuplicatePhones = 0;
  
  for (const result of filteredResults) {
    if (result.phone && seenPhones.has(result.phone)) {
      stats.skippedDuplicatePhones++;
      continue;
    }
    if (result.phone) {
      seenPhones.add(result.phone);
    }
    finalResults.push(result);
  }
  
  if (stats.skippedDuplicatePhones > 0) {
    log(`📱 电话去重: 跳过 ${stats.skippedDuplicatePhones} 条重复电话号码的记录`);
  }
  
  stats.validResults = finalResults.length;
  stats.totalRequests = stats.searchPageRequests + stats.detailPageRequests;
  
  log(`✅ 搜索完成: ${finalResults.length} 条有效结果`);
  log(`📊 统计: 搜索页 ${stats.searchPageRequests} 次, 详情页 ${stats.detailPageRequests} 次, 缓存命中 ${stats.cacheHits} 次`);
  
  if (stats.rateLimitedRequests && stats.rateLimitedRequests > 0) {
    log(`⚠️ 限流统计: ${stats.rateLimitedRequests} 次 429 限流, ${stats.deferredRetries || 0} 次延后重试`);
  }
  
  return {
    success: true,
    results: finalResults,
    totalRecords: stats.totalRecords,
    pagesSearched: stats.pagesSearched,
    finalCount: finalResults.length,
    stats,
    logs
  };
}
