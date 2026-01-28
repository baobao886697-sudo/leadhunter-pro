/**
 * LinkedIn 搜索模块 - 模块入口
 * 
 * 统一导出所有LinkedIn搜索相关的功能
 */

// 导出路由
export { linkedinRouter } from './router';
export type { LinkedinRouter } from './router';

// 导出数据库操作
export {
  freezeCredits,
  settleCredits,
  getUserCredits,
  createSearchTask,
  getSearchTask,
  updateSearchTask,
  updateSearchTaskStatus,
  getUserSearchTasks,
  saveSearchResult,
  updateSearchResult,
  getSearchResults,
  getSearchResultsByTaskId,
  getCacheByKey,
  setCache,
} from './db';

// 导出配置
export {
  getSearchCreditsConfig,
  CONFIG_KEYS,
} from './config';

// 导出类型
export type {
  LeadPerson,
  PhoneNumber,
  ApifyLeadRaw,
  ApifySearchParams,
} from './apify';

export type {
  BrightDataProfile,
} from './brightdata';

// 导出搜索处理器
export {
  previewSearch,
  executeSearchV3,
} from './processor';

export type {
  SearchPreviewResult,
  SearchProgress,
  SearchStats,
} from './processor';
