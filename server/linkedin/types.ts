/**
 * LinkedIn 搜索模块 - 类型定义
 * 
 * 统一管理所有LinkedIn搜索相关的类型定义
 */

// ============ 搜索预览结果 ============

export interface SearchPreviewResult {
  success: boolean;
  totalAvailable: number;
  estimatedCredits: number;
  searchCredits: number;
  phoneCreditsPerPerson: number;
  canAfford: boolean;
  userCredits: number;
  maxAffordable: number;
  searchParams: {
    name: string;
    title: string;
    state: string;
    limit: number;
    ageMin?: number;
    ageMax?: number;
    mode?: 'fuzzy' | 'exact';
  };
  cacheHit: boolean;
  message: string;
}

// ============ 搜索日志 ============

export interface SearchLogEntry {
  timestamp: string;
  time: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  phase: 'init' | 'search' | 'process' | 'verify' | 'complete';
  step?: number;
  total?: number;
  message: string;
  icon?: string;
  details?: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    matchScore?: number;
    reason?: string;
    duration?: number;
    creditsUsed?: number;
  };
}

// ============ 搜索统计 ============

export interface SearchStats {
  apifyApiCalls: number;
  verifyApiCalls: number;
  apifyReturned: number;
  recordsProcessed: number;
  totalResults: number;
  resultsWithPhone: number;
  resultsWithEmail: number;
  resultsVerified: number;
  excludedNoPhone: number;
  excludedNoContact: number;
  excludedAgeFilter: number;
  excludedError: number;
  excludedApiError: number;
  creditsUsed: number;
  creditsRefunded: number;
  creditsFinal: number;
  totalDuration: number;
  avgProcessTime: number;
  verifySuccessRate: number;
  apiCreditsExhausted: boolean;
  unprocessedCount: number;
}

// ============ 搜索进度 ============

export interface SearchProgress {
  taskId: string;
  status: 'initializing' | 'searching' | 'processing' | 'verifying' | 'completed' | 'stopped' | 'failed' | 'insufficient_credits';
  phase: 'init' | 'search' | 'process' | 'verify' | 'complete';
  phaseProgress: number;
  overallProgress: number;
  step: number;
  totalSteps: number;
  currentAction: string;
  currentPerson?: string;
  stats: SearchStats;
  logs: SearchLogEntry[];
  estimatedTimeRemaining?: number;
  startTime: number;
  lastUpdateTime: number;
}

// ============ 搜索缓存 ============

export interface SearchCacheData {
  data: LeadPerson[];
  totalAvailable: number;
  requestedCount: number;
  searchParams: {
    name: string;
    title: string;
    state: string;
    limit: number;
  };
  createdAt: string;
}

// ============ 搜索模式 ============

export type SearchMode = 'fuzzy' | 'exact';

// ============ 搜索参数 ============

export interface SearchParams {
  userId: number;
  taskId: string;
  name: string;
  title: string;
  state: string;
  limit: number;
  ageMin?: number;
  ageMax?: number;
  mode: SearchMode;
  frozenAmount?: number;
}

// ============ LeadPerson 类型 ============

export interface LeadPerson {
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  companyLinkedIn?: string;
  location?: string;
  state?: string;
  linkedInUrl?: string;
  email?: string;
  phone?: string;
  age?: number;
  matchScore?: number;
  source?: string;
  rawData?: any;
}

// ============ 验证结果 ============

export interface VerificationResult {
  success: boolean;
  phone?: string;
  phoneType?: string;
  carrier?: string;
  lineType?: string;
  valid?: boolean;
  error?: string;
}

// ============ 积分冻结结果 ============

export interface FreezeCreditsResult {
  success: boolean;
  frozenAmount: number;
  balanceAfter: number;
  message: string;
}

// ============ 积分结算结果 ============

export interface SettleCreditsResult {
  success: boolean;
  refundAmount: number;
  actualCost: number;
  newBalance: number;
  message: string;
}
