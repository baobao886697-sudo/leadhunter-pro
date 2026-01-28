/**
 * LinkedIn 搜索模块 - 配置常量
 * 
 * 统一管理所有LinkedIn搜索相关的配置
 */

import { getConfig } from '../db';

// ============ 默认积分配置 ============

// 模糊搜索（Apify）
export const DEFAULT_FUZZY_SEARCH_CREDITS = 1;
export const DEFAULT_FUZZY_PHONE_CREDITS_PER_PERSON = 2;

// 精准搜索（BrightData + PDL）
export const DEFAULT_EXACT_SEARCH_CREDITS = 5;
export const DEFAULT_EXACT_PHONE_CREDITS_PER_PERSON = 10;

// 验证费用
export const VERIFY_CREDITS_PER_PHONE = 0;

// ============ 并发和缓存配置 ============

export const CONCURRENT_VERIFY_LIMIT = 5;
export const CACHE_FULFILLMENT_THRESHOLD = 0.8;
export const CACHE_EXPIRY_DAYS = 180;

// ============ 配置键名常量 ============

export const CONFIG_KEYS = {
  FUZZY_SEARCH_CREDITS: 'FUZZY_SEARCH_CREDITS',
  FUZZY_CREDITS_PER_PERSON: 'FUZZY_CREDITS_PER_PERSON',
  EXACT_SEARCH_CREDITS: 'EXACT_SEARCH_CREDITS',
  EXACT_CREDITS_PER_PERSON: 'EXACT_CREDITS_PER_PERSON',
};

// ============ 获取积分配置 ============

/**
 * 从数据库获取积分配置，如果不存在则使用默认值
 */
export async function getSearchCreditsConfig() {
  const [fuzzySearch, fuzzyPerPerson, exactSearch, exactPerPerson] = await Promise.all([
    getConfig(CONFIG_KEYS.FUZZY_SEARCH_CREDITS),
    getConfig(CONFIG_KEYS.FUZZY_CREDITS_PER_PERSON),
    getConfig(CONFIG_KEYS.EXACT_SEARCH_CREDITS),
    getConfig(CONFIG_KEYS.EXACT_CREDITS_PER_PERSON),
  ]);
  
  return {
    fuzzySearchCredits: fuzzySearch ? parseInt(fuzzySearch, 10) : DEFAULT_FUZZY_SEARCH_CREDITS,
    fuzzyCreditsPerPerson: fuzzyPerPerson ? parseInt(fuzzyPerPerson, 10) : DEFAULT_FUZZY_PHONE_CREDITS_PER_PERSON,
    exactSearchCredits: exactSearch ? parseInt(exactSearch, 10) : DEFAULT_EXACT_SEARCH_CREDITS,
    exactCreditsPerPerson: exactPerPerson ? parseInt(exactPerPerson, 10) : DEFAULT_EXACT_PHONE_CREDITS_PER_PERSON,
  };
}

// ============ 搜索模式配置 ============

export const SEARCH_MODE_CONFIG = {
  fuzzy: {
    name: '模糊搜索',
    description: '使用 Apify Leads Finder 进行搜索',
    dataSource: 'Apify',
    supportCache: true,
    refundOnNoResult: false,
  },
  exact: {
    name: '精准搜索',
    description: '使用 BrightData + PDL 进行搜索',
    dataSource: 'BrightData + PDL',
    supportCache: false,
    refundOnNoResult: true,
  },
};
