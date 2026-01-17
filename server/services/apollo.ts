import axios from 'axios';
import { getConfig, logApiCall, saveToCacheAndUpdateHit } from '../db';

const APOLLO_API_BASE = 'https://api.apollo.io/v1';

export interface ApolloSearchParams {
  name?: string;
  titles?: string[];
  states?: string[];
  page?: number;
  perPage?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  organization_name: string;
  city: string;
  state: string;
  country: string;
  linkedin_url: string;
  email: string;
  phone_numbers?: Array<{
    raw_number: string;
    sanitized_number: string;
    type: string;
    position: number;
    status: string;
  }>;
}

export interface ApolloSearchResponse {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface ApolloEnrichResponse {
  person: ApolloPerson;
}

async function getApolloApiKey(): Promise<string> {
  const key = await getConfig('APOLLO_API_KEY');
  if (!key) {
    throw new Error('Apollo API key not configured');
  }
  return key;
}

/**
 * 搜索Apollo.io获取人员列表（免费，不消耗积分）
 */
export async function searchPeople(
  params: ApolloSearchParams,
  userId?: number,
  taskId?: number
): Promise<ApolloSearchResponse> {
  const apiKey = await getApolloApiKey();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${APOLLO_API_BASE}/mixed_people/search`,
      {
        api_key: apiKey,
        q_keywords: params.name,
        person_titles: params.titles,
        person_locations: params.states?.map(s => `United States, ${s}`),
        page: params.page || 1,
        per_page: params.perPage || 100,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const responseTime = Date.now() - startTime;

    // 记录API调用日志
    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'apollo_search',
      endpoint: '/mixed_people/search',
      requestData: params,
      responseData: { pagination: response.data.pagination, count: response.data.people?.length },
      responseTimeMs: responseTime,
      statusCode: response.status,
      success: true,
      errorMessage: null,
      creditsUsed: 0, // 搜索免费
      cacheHit: false,
    });

    return response.data;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'apollo_search',
      endpoint: '/mixed_people/search',
      requestData: params,
      responseData: null,
      responseTimeMs: responseTime,
      statusCode: error.response?.status || 0,
      success: false,
      errorMessage: error.message,
      creditsUsed: 0,
      cacheHit: false,
    });

    throw error;
  }
}

/**
 * 批量获取电话号码（收费，每人2积分）
 * 使用跳动提取策略，而非顺序提取
 */
export async function enrichPeopleBatch(
  peopleIds: string[],
  userId?: number,
  taskId?: number
): Promise<ApolloPerson[]> {
  const apiKey = await getApolloApiKey();
  const results: ApolloPerson[] = [];

  // 跳动提取策略：打乱顺序
  const shuffledIds = shuffleArray([...peopleIds]);

  // Apollo API 每次最多处理10人
  const batchSize = 10;
  const batches = chunkArray(shuffledIds, batchSize);

  for (const batch of batches) {
    const startTime = Date.now();

    try {
      // 使用 bulk enrichment API
      const response = await axios.post(
        `${APOLLO_API_BASE}/people/bulk_match`,
        {
          api_key: apiKey,
          details: batch.map(id => ({ id })),
          reveal_personal_emails: true,
          reveal_phone_number: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const responseTime = Date.now() - startTime;

      await logApiCall({
        userId: userId || null,
        taskId: taskId || null,
        apiType: 'apollo_enrich',
        endpoint: '/people/bulk_match',
        requestData: { ids: batch },
        responseData: { count: response.data.matches?.length },
        responseTimeMs: responseTime,
        statusCode: response.status,
        success: true,
        errorMessage: null,
        creditsUsed: batch.length * 2, // 每人2积分
        cacheHit: false,
      });

      if (response.data.matches) {
        results.push(...response.data.matches);
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      await logApiCall({
        userId: userId || null,
        taskId: taskId || null,
        apiType: 'apollo_enrich',
        endpoint: '/people/bulk_match',
        requestData: { ids: batch },
        responseData: null,
        responseTimeMs: responseTime,
        statusCode: error.response?.status || 0,
        success: false,
        errorMessage: error.message,
        creditsUsed: batch.length * 2, // 即使失败也扣费
        cacheHit: false,
      });

      // 继续处理下一批，不中断整个流程
      console.error(`Apollo enrichment batch failed:`, error.message);
    }
  }

  return results;
}

/**
 * 单人获取详细信息
 */
export async function enrichPerson(
  apolloId: string,
  userId?: number,
  taskId?: number
): Promise<ApolloPerson | null> {
  const apiKey = await getApolloApiKey();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${APOLLO_API_BASE}/people/match`,
      {
        api_key: apiKey,
        id: apolloId,
        reveal_personal_emails: true,
        reveal_phone_number: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const responseTime = Date.now() - startTime;

    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'apollo_enrich',
      endpoint: '/people/match',
      requestData: { id: apolloId },
      responseData: response.data.person ? { id: response.data.person.id } : null,
      responseTimeMs: responseTime,
      statusCode: response.status,
      success: true,
      errorMessage: null,
      creditsUsed: 2,
      cacheHit: false,
    });

    return response.data.person || null;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    await logApiCall({
      userId: userId || null,
      taskId: taskId || null,
      apiType: 'apollo_enrich',
      endpoint: '/people/match',
      requestData: { id: apolloId },
      responseData: null,
      responseTimeMs: responseTime,
      statusCode: error.response?.status || 0,
      success: false,
      errorMessage: error.message,
      creditsUsed: 2,
      cacheHit: false,
    });

    return null;
  }
}

// 工具函数：打乱数组（跳动提取）
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 工具函数：分批
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
