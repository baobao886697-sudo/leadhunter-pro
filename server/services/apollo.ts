import axios from 'axios';
import { getConfig, logApi } from '../db';
import { getWebhookUrl, registerPendingPhoneRequest } from './apolloWebhook';
import crypto from 'crypto';

const APOLLO_API_BASE = 'https://api.apollo.io/api/v1';

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  organization_name?: string;
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
  organization?: {
    phone?: string;
    sanitized_phone?: string;
  };
}

export interface ApolloSearchResult {
  success: boolean;
  people: ApolloPerson[];
  totalCount: number;
  errorMessage?: string;
}

async function getApolloApiKey(): Promise<string> {
  const key = await getConfig('APOLLO_API_KEY');
  if (!key) throw new Error('Apollo API key not configured');
  return key;
}

export async function searchPeople(
  name: string,
  title: string,
  state: string,
  limit: number = 100,
  userId?: number
): Promise<ApolloSearchResult> {
  const apiKey = await getApolloApiKey();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${APOLLO_API_BASE}/mixed_people/api_search`,
      {
        q_keywords: name,
        person_titles: [title],
        person_locations: [state],
        page: 1,
        per_page: Math.min(limit, 100),
      },
      { 
        headers: { 
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        }, 
        timeout: 30000 
      }
    );

    const responseTime = Date.now() - startTime;
    await logApi('apollo_search', '/mixed_people/api_search', { name, title, state }, response.status, responseTime, true, undefined, 0, userId);

    return {
      success: true,
      people: response.data.people || [],
      totalCount: response.data.pagination?.total_entries || 0,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error.response?.data?.error || error.message;
    await logApi('apollo_search', '/mixed_people/api_search', { name, title, state }, error.response?.status || 0, responseTime, false, errorMessage, 0, userId);
    return { success: false, people: [], totalCount: 0, errorMessage };
  }
}

// 同步获取人员详情（不包含电话号码）
export async function enrichPerson(personId: string, userId?: number): Promise<ApolloPerson | null> {
  const apiKey = await getApolloApiKey();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${APOLLO_API_BASE}/people/match`,
      {
        id: personId,
        reveal_personal_emails: true
      },
      { 
        headers: { 
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        }, 
        timeout: 30000 
      }
    );

    const responseTime = Date.now() - startTime;
    await logApi('apollo_enrich', '/people/match', { id: personId }, response.status, responseTime, true, undefined, 0, userId);

    return response.data.person || null;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error.response?.data?.error || error.message;
    await logApi('apollo_enrich', '/people/match', { id: personId }, error.response?.status || 0, responseTime, false, errorMessage, 0, userId);
    return null;
  }
}

// 异步请求电话号码（通过 Webhook 返回）
export async function requestPhoneNumberAsync(
  personId: string,
  taskId: string,
  personData: any,
  userId?: number
): Promise<boolean> {
  const apiKey = await getApolloApiKey();
  const startTime = Date.now();
  const webhookUrl = getWebhookUrl();
  const requestId = crypto.randomUUID();

  try {
    // 注册待处理请求
    registerPendingPhoneRequest(requestId, taskId, personId, personData);

    const response = await axios.post(
      `${APOLLO_API_BASE}/people/bulk_match`,
      {
        details: [{ id: personId }],
        reveal_phone_number: true,
        webhook_url: webhookUrl
      },
      { 
        headers: { 
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        }, 
        timeout: 30000 
      }
    );

    const responseTime = Date.now() - startTime;
    await logApi('apollo_phone_request', '/people/bulk_match', { id: personId, webhook: webhookUrl }, response.status, responseTime, true, undefined, 0, userId);

    return true;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error.response?.data?.error || error.message;
    await logApi('apollo_phone_request', '/people/bulk_match', { id: personId }, error.response?.status || 0, responseTime, false, errorMessage, 0, userId);
    return false;
  }
}

// 批量获取人员详情（同步，不包含电话号码）
export async function enrichPeopleBatch(peopleIds: string[], userId?: number): Promise<ApolloPerson[]> {
  const apiKey = await getApolloApiKey();
  const results: ApolloPerson[] = [];

  const shuffledIds = shuffleArray([...peopleIds]);
  const batchSize = 10;
  const batches = chunkArray(shuffledIds, batchSize);

  for (const batch of batches) {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${APOLLO_API_BASE}/people/bulk_match`,
        {
          details: batch.map(id => ({ id })),
          reveal_personal_emails: true,
          // 不使用 reveal_phone_number，因为需要 webhook
        },
        { 
          headers: { 
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey
          }, 
          timeout: 60000 
        }
      );

      const responseTime = Date.now() - startTime;
      await logApi('apollo_enrich', '/people/bulk_match', { ids: batch }, response.status, responseTime, true, undefined, 0, userId);

      if (response.data.matches) {
        results.push(...response.data.matches);
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error.response?.data?.error || error.message;
      await logApi('apollo_enrich', '/people/bulk_match', { ids: batch }, error.response?.status || 0, responseTime, false, errorMessage, 0, userId);
    }
  }

  return results;
}

// 使用公司电话作为备选方案
export function getOrganizationPhone(person: ApolloPerson): string | null {
  if (person.organization?.sanitized_phone) {
    return person.organization.sanitized_phone;
  }
  if (person.organization?.phone) {
    // 清理电话号码格式
    return person.organization.phone.replace(/[^\d+]/g, '');
  }
  return null;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
