import axios from 'axios';
import { getConfig, logApiCall } from '../db';

const SCRAPE_DO_BASE = 'https://api.scrape.do';

export interface VerificationResult {
  verified: boolean;
  source: 'truepeoplesearch' | 'fastpeoplesearch' | 'none';
  matchScore: number;
  phoneNumber?: string;
  phoneType?: 'mobile' | 'landline' | 'voip' | 'unknown';
  carrier?: string;
  age?: number;
  city?: string;
  state?: string;
  rawData?: any;
}

export interface PersonToVerify {
  firstName: string;
  lastName: string;
  city?: string;
  state: string;
  phoneNumber: string;
}

async function getScrapeDoToken(): Promise<string> {
  const token = await getConfig('SCRAPE_DO_TOKEN');
  if (!token) {
    throw new Error('Scrape.do API token not configured');
  }
  return token;
}

/**
 * 通过TruePeopleSearch验证电话号码
 */
export async function verifyWithTruePeopleSearch(
  person: PersonToVerify,
  userId?: number,
  taskId?: number
): Promise<VerificationResult> {
  const token = await getScrapeDoToken();
  const startTime = Date.now();

  // 构建TruePeopleSearch搜索URL
  const searchName = `${person.firstName} ${person.lastName}`.replace(/\s+/g, '-');
  const location = person.city 
    ? `${person.city}-${person.state}`.replace(/\s+/g, '-')
    : person.state;
  const targetUrl = `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(searchName)}&citystatezip=${encodeURIComponent(location)}`;

  try {
    const response = await axios.get(SCRAPE_DO_BASE, {
      params: {
        token,
        url: targetUrl,
        super: true, // 使用住宅代理
        geoCode: 'us', // 美国IP
        render: true, // 渲染JavaScript
      },
      timeout: 60000,
    });

    const responseTime = Date.now() - startTime;
    const html = response.data;

    // 解析HTML提取信息
    const result = parseTruePeopleSearchResult(html, person);

    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'scrape_tps',
      endpoint: targetUrl,
      requestData: { name: searchName, location },
      responseData: { verified: result.verified, matchScore: result.matchScore },
      responseTimeMs: responseTime,
      statusCode: response.status,
      success: true,
      errorMessage: null,
      creditsUsed: 0, // 验证不额外扣费
      cacheHit: false,
    });

    return result;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'scrape_tps',
      endpoint: targetUrl,
      requestData: { name: searchName, location },
      responseData: null,
      responseTimeMs: responseTime,
      statusCode: error.response?.status || 0,
      success: false,
      errorMessage: error.message,
      creditsUsed: 0,
      cacheHit: false,
    });

    return {
      verified: false,
      source: 'none',
      matchScore: 0,
    };
  }
}

/**
 * 通过FastPeopleSearch验证电话号码（二次验证）
 */
export async function verifyWithFastPeopleSearch(
  person: PersonToVerify,
  userId?: number,
  taskId?: number
): Promise<VerificationResult> {
  const token = await getScrapeDoToken();
  const startTime = Date.now();

  // 构建FastPeopleSearch搜索URL
  const searchName = `${person.firstName}-${person.lastName}`;
  const location = person.city 
    ? `${person.city}-${person.state}`
    : person.state;
  const targetUrl = `https://www.fastpeoplesearch.com/name/${encodeURIComponent(searchName)}_${encodeURIComponent(location)}`;

  try {
    const response = await axios.get(SCRAPE_DO_BASE, {
      params: {
        token,
        url: targetUrl,
        super: true,
        geoCode: 'us',
        render: true,
      },
      timeout: 60000,
    });

    const responseTime = Date.now() - startTime;
    const html = response.data;

    // 解析HTML提取信息
    const result = parseFastPeopleSearchResult(html, person);

    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'scrape_fps',
      endpoint: targetUrl,
      requestData: { name: searchName, location },
      responseData: { verified: result.verified, matchScore: result.matchScore },
      responseTimeMs: responseTime,
      statusCode: response.status,
      success: true,
      errorMessage: null,
      creditsUsed: 0,
      cacheHit: false,
    });

    return result;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'scrape_fps',
      endpoint: targetUrl,
      requestData: { name: searchName, location },
      responseData: null,
      responseTimeMs: responseTime,
      statusCode: error.response?.status || 0,
      success: false,
      errorMessage: error.message,
      creditsUsed: 0,
      cacheHit: false,
    });

    return {
      verified: false,
      source: 'none',
      matchScore: 0,
    };
  }
}

/**
 * 完整验证流程：先TruePeopleSearch，失败则FastPeopleSearch
 */
export async function verifyPhoneNumber(
  person: PersonToVerify,
  userId?: number,
  taskId?: number
): Promise<VerificationResult> {
  // 第一步：TruePeopleSearch验证
  const tpsResult = await verifyWithTruePeopleSearch(person, userId, taskId);
  
  if (tpsResult.verified && tpsResult.matchScore >= 70) {
    return {
      ...tpsResult,
      source: 'truepeoplesearch',
    };
  }

  // 第二步：FastPeopleSearch二次验证
  const fpsResult = await verifyWithFastPeopleSearch(person, userId, taskId);
  
  if (fpsResult.verified && fpsResult.matchScore >= 70) {
    return {
      ...fpsResult,
      source: 'fastpeoplesearch',
    };
  }

  // 如果两个都有部分匹配，取分数高的
  if (tpsResult.matchScore > fpsResult.matchScore) {
    return tpsResult;
  }
  
  return fpsResult;
}

/**
 * 解析TruePeopleSearch结果
 */
function parseTruePeopleSearchResult(html: string, person: PersonToVerify): VerificationResult {
  const result: VerificationResult = {
    verified: false,
    source: 'truepeoplesearch',
    matchScore: 0,
  };

  try {
    // 检查是否找到匹配的人
    const namePattern = new RegExp(
      `${escapeRegex(person.firstName)}[\\s\\S]*?${escapeRegex(person.lastName)}`,
      'i'
    );
    const nameMatch = html.match(namePattern);

    if (!nameMatch) {
      return result;
    }

    let score = 30; // 名字匹配基础分

    // 检查州匹配
    const statePattern = new RegExp(`\\b${escapeRegex(person.state)}\\b`, 'i');
    if (statePattern.test(html)) {
      score += 20;
    }

    // 检查城市匹配
    if (person.city) {
      const cityPattern = new RegExp(`\\b${escapeRegex(person.city)}\\b`, 'i');
      if (cityPattern.test(html)) {
        score += 20;
      }
    }

    // 检查电话号码匹配
    const cleanPhone = person.phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      const phonePattern = new RegExp(cleanPhone.slice(-10));
      if (phonePattern.test(html.replace(/\D/g, ''))) {
        score += 30;
        result.verified = true;
      }
    }

    // 尝试提取年龄
    const ageMatch = html.match(/Age[:\s]*(\d{2,3})/i);
    if (ageMatch) {
      result.age = parseInt(ageMatch[1], 10);
    }

    // 尝试提取运营商信息
    const carrierMatch = html.match(/(?:Carrier|Provider)[:\s]*([A-Za-z\s]+?)(?:<|,|\n)/i);
    if (carrierMatch) {
      result.carrier = carrierMatch[1].trim();
    }

    // 尝试判断电话类型
    if (/mobile|cell|wireless/i.test(html)) {
      result.phoneType = 'mobile';
    } else if (/landline|home/i.test(html)) {
      result.phoneType = 'landline';
    } else if (/voip/i.test(html)) {
      result.phoneType = 'voip';
    }

    result.matchScore = Math.min(score, 100);
    result.rawData = { htmlLength: html.length };
  } catch (error) {
    console.error('Error parsing TruePeopleSearch result:', error);
  }

  return result;
}

/**
 * 解析FastPeopleSearch结果
 */
function parseFastPeopleSearchResult(html: string, person: PersonToVerify): VerificationResult {
  const result: VerificationResult = {
    verified: false,
    source: 'fastpeoplesearch',
    matchScore: 0,
  };

  try {
    // 检查是否找到匹配的人
    const namePattern = new RegExp(
      `${escapeRegex(person.firstName)}[\\s\\S]*?${escapeRegex(person.lastName)}`,
      'i'
    );
    const nameMatch = html.match(namePattern);

    if (!nameMatch) {
      return result;
    }

    let score = 30;

    // 检查州匹配
    const statePattern = new RegExp(`\\b${escapeRegex(person.state)}\\b`, 'i');
    if (statePattern.test(html)) {
      score += 20;
    }

    // 检查城市匹配
    if (person.city) {
      const cityPattern = new RegExp(`\\b${escapeRegex(person.city)}\\b`, 'i');
      if (cityPattern.test(html)) {
        score += 20;
      }
    }

    // 检查电话号码匹配
    const cleanPhone = person.phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      const phonePattern = new RegExp(cleanPhone.slice(-10));
      if (phonePattern.test(html.replace(/\D/g, ''))) {
        score += 30;
        result.verified = true;
      }
    }

    // 尝试提取年龄
    const ageMatch = html.match(/(\d{2,3})\s*(?:years?\s*old|yo)/i);
    if (ageMatch) {
      result.age = parseInt(ageMatch[1], 10);
    }

    result.matchScore = Math.min(score, 100);
    result.rawData = { htmlLength: html.length };
  } catch (error) {
    console.error('Error parsing FastPeopleSearch result:', error);
  }

  return result;
}

// 工具函数：转义正则表达式特殊字符
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
