/**
 * 智能缓存系统
 * 
 * 功能特点：
 * 1. 80% 覆盖率阈值 - 缓存数据量必须达到 Apollo 总量的 80% 才使用缓存
 * 2. 已分配记录排除 - 使用缓存时，排除已分配给其他用户的记录（30天过期）
 * 3. 混合获取策略 - 缓存不足时，先用缓存再用 API 补充
 */

import {
  getCacheByKey,
  setCache,
  getAssignedApolloIds,
  recordAssignedRecords,
  getCacheCoverageThreshold,
  getAssignedRecordExpireDays
} from '../db';
import { searchPeople, ApolloPerson } from './apollo';

export interface SmartCacheResult {
  success: boolean;
  source: 'cache' | 'api' | 'mixed';
  data: ApolloPerson[];
  totalAvailable: number;
  cacheCount: number;
  apiCount: number;
  coverageRate: number;
  usedCache: boolean;
  message: string;
}

/**
 * 智能获取搜索数据
 * 
 * @param searchHash 搜索条件的哈希值
 * @param cacheKey 缓存键
 * @param searchName 搜索姓名
 * @param searchTitle 搜索职位
 * @param searchState 搜索州
 * @param requestedCount 请求数量
 * @param userId 用户ID
 * @returns 智能缓存结果
 */
export async function getDataWithSmartCache(
  searchHash: string,
  cacheKey: string,
  searchName: string,
  searchTitle: string,
  searchState: string,
  requestedCount: number,
  userId: number
): Promise<SmartCacheResult> {
  
  // 获取配置
  const coverageThreshold = await getCacheCoverageThreshold();
  const expireDays = await getAssignedRecordExpireDays();
  
  // 检查缓存
  const cached = await getCacheByKey(cacheKey);
  
  // 如果没有缓存，直接调用 API
  if (!cached) {
    return await fetchFromApi(searchName, searchTitle, searchState, requestedCount, userId, cacheKey);
  }
  
  const cachedData = cached.data as ApolloPerson[];
  const cacheCount = cachedData.length;
  
  // 调用 Apollo API 获取总数（不获取详细数据，只获取计数）
  let totalAvailable = 0;
  try {
    const countResult = await searchPeople(searchName, searchTitle, searchState, 1, userId);
    if (countResult.success) {
      totalAvailable = countResult.totalCount;
    }
  } catch (error) {
    console.error('Failed to get total count from Apollo:', error);
    // 如果获取总数失败，使用缓存数量作为总数
    totalAvailable = cacheCount;
  }
  
  // 计算覆盖率
  const coverageRate = totalAvailable > 0 ? (cacheCount / totalAvailable) * 100 : 0;
  
  // 检查覆盖率是否达到阈值
  if (coverageRate < coverageThreshold) {
    // 覆盖率不足，直接调用 API
    console.log(`Cache coverage ${coverageRate.toFixed(1)}% < threshold ${coverageThreshold}%, fetching from API`);
    return await fetchFromApi(searchName, searchTitle, searchState, requestedCount, userId, cacheKey);
  }
  
  // 覆盖率达标，使用缓存
  console.log(`Cache coverage ${coverageRate.toFixed(1)}% >= threshold ${coverageThreshold}%, using cache`);
  
  // 获取已分配的 Apollo ID 列表（排除 30 天内已分配的）
  const assignedIds = await getAssignedApolloIds(searchHash, expireDays);
  const assignedIdSet = new Set(assignedIds);
  
  // 过滤掉已分配的记录
  const availableRecords = cachedData.filter(person => !assignedIdSet.has(person.id));
  const availableCount = availableRecords.length;
  
  console.log(`Available records after excluding assigned: ${availableCount} (assigned: ${assignedIds.length})`);
  
  // 检查可用记录是否足够
  if (availableCount >= requestedCount) {
    // 可用记录足够，直接使用缓存
    const selectedRecords = shuffleAndSelect(availableRecords, requestedCount);
    
    // 记录已分配的记录
    await recordAssignedRecords(
      searchHash,
      selectedRecords.map(p => p.id),
      userId
    );
    
    return {
      success: true,
      source: 'cache',
      data: selectedRecords,
      totalAvailable,
      cacheCount,
      apiCount: 0,
      coverageRate,
      usedCache: true,
      message: `✨ 从缓存获取 ${selectedRecords.length} 条记录`
    };
  }
  
  // 可用记录不足，使用混合策略
  console.log(`Available records ${availableCount} < requested ${requestedCount}, using mixed strategy`);
  
  // 先取所有可用的缓存记录
  const cacheRecords = shuffleAndSelect(availableRecords, availableCount);
  const neededFromApi = requestedCount - cacheRecords.length;
  
  // 从 API 获取补充数据
  const apiResult = await searchPeople(searchName, searchTitle, searchState, neededFromApi * 2, userId);
  
  if (!apiResult.success || !apiResult.people) {
    // API 调用失败，只返回缓存数据
    if (cacheRecords.length > 0) {
      await recordAssignedRecords(
        searchHash,
        cacheRecords.map(p => p.id),
        userId
      );
    }
    
    return {
      success: true,
      source: 'cache',
      data: cacheRecords,
      totalAvailable,
      cacheCount,
      apiCount: 0,
      coverageRate,
      usedCache: true,
      message: `⚠️ API 调用失败，仅从缓存获取 ${cacheRecords.length} 条记录`
    };
  }
  
  // 从 API 结果中排除已分配的和缓存中已选的记录
  const cacheIdSet = new Set(cacheRecords.map(p => p.id));
  const apiRecords = apiResult.people.filter(
    person => !assignedIdSet.has(person.id) && !cacheIdSet.has(person.id)
  );
  
  // 选择需要的数量
  const selectedApiRecords = shuffleAndSelect(apiRecords, neededFromApi);
  
  // 合并结果
  const combinedRecords = [...cacheRecords, ...selectedApiRecords];
  
  // 记录所有已分配的记录
  await recordAssignedRecords(
    searchHash,
    combinedRecords.map(p => p.id),
    userId
  );
  
  // 更新缓存（合并新数据）
  const allCachedIds = new Set(cachedData.map(p => p.id));
  const newRecords = apiResult.people.filter(p => !allCachedIds.has(p.id));
  if (newRecords.length > 0) {
    const updatedCache = [...cachedData, ...newRecords];
    await setCache(cacheKey, 'search', updatedCache, 180);
    console.log(`Updated cache with ${newRecords.length} new records`);
  }
  
  return {
    success: true,
    source: 'mixed',
    data: combinedRecords,
    totalAvailable,
    cacheCount: cacheRecords.length,
    apiCount: selectedApiRecords.length,
    coverageRate,
    usedCache: true,
    message: `🔄 混合获取: 缓存 ${cacheRecords.length} 条 + API ${selectedApiRecords.length} 条`
  };
}

/**
 * 直接从 API 获取数据
 */
async function fetchFromApi(
  searchName: string,
  searchTitle: string,
  searchState: string,
  requestedCount: number,
  userId: number,
  cacheKey: string
): Promise<SmartCacheResult> {
  const apiResult = await searchPeople(searchName, searchTitle, searchState, requestedCount * 2, userId);
  
  if (!apiResult.success || !apiResult.people) {
    return {
      success: false,
      source: 'api',
      data: [],
      totalAvailable: 0,
      cacheCount: 0,
      apiCount: 0,
      coverageRate: 0,
      usedCache: false,
      message: apiResult.errorMessage || 'Apollo API 调用失败'
    };
  }
  
  // 缓存结果
  await setCache(cacheKey, 'search', apiResult.people, 180);
  
  return {
    success: true,
    source: 'api',
    data: apiResult.people,
    totalAvailable: apiResult.totalCount,
    cacheCount: 0,
    apiCount: apiResult.people.length,
    coverageRate: 0,
    usedCache: false,
    message: `🔍 从 Apollo API 获取 ${apiResult.people.length} 条记录`
  };
}

/**
 * 打乱数组并选择指定数量
 */
function shuffleAndSelect<T>(array: T[], count: number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
