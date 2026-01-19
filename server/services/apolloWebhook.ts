import { getSearchTask, updateSearchTask, saveSearchResult, getSearchResults } from '../db';
import { verifyPhoneNumber, PersonToVerify } from './scraper';

// 存储待处理的电话号码请求
const pendingPhoneRequests = new Map<string, {
  taskId: string;
  personId: string;
  personData: any;
  timestamp: number;
}>();

// 清理过期的请求（超过30分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingPhoneRequests.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) {
      pendingPhoneRequests.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function registerPendingPhoneRequest(
  requestId: string,
  taskId: string,
  personId: string,
  personData: any
) {
  pendingPhoneRequests.set(requestId, {
    taskId,
    personId,
    personData,
    timestamp: Date.now()
  });
}

export async function handleApolloWebhook(payload: any): Promise<void> {
  console.log('[Apollo Webhook] Received payload:', JSON.stringify(payload).slice(0, 500));
  
  // Apollo webhook 返回的数据格式
  // { matches: [{ id, phone_numbers: [...] }] }
  
  if (!payload.matches || !Array.isArray(payload.matches)) {
    console.log('[Apollo Webhook] Invalid payload format');
    return;
  }

  for (const match of payload.matches) {
    const personId = match.id;
    const phoneNumbers = match.phone_numbers || [];
    
    // 查找对应的待处理请求
    let pendingRequest = null;
    let requestKey = null;
    
    for (const [key, value] of pendingPhoneRequests.entries()) {
      if (value.personId === personId) {
        pendingRequest = value;
        requestKey = key;
        break;
      }
    }
    
    if (!pendingRequest) {
      console.log(`[Apollo Webhook] No pending request found for person ${personId}`);
      continue;
    }
    
    // 移除待处理请求
    if (requestKey) {
      pendingPhoneRequests.delete(requestKey);
    }
    
    const { taskId, personData } = pendingRequest;
    
    if (phoneNumbers.length === 0) {
      console.log(`[Apollo Webhook] No phone numbers for person ${personId}`);
      continue;
    }
    
    // 获取第一个电话号码
    const phoneNumber = phoneNumbers[0].sanitized_number || phoneNumbers[0].raw_number;
    
    console.log(`[Apollo Webhook] Processing phone ${phoneNumber} for person ${personId}`);
    
    // 验证电话号码
    const personToVerify: PersonToVerify = {
      firstName: personData.first_name || '',
      lastName: personData.last_name || '',
      city: personData.city || '',
      state: personData.state || '',
      phone: phoneNumber
    };
    
    const verifyResult = await verifyPhoneNumber(personToVerify);
    
    // 保存结果
    const resultData = {
      apolloId: personId,
      firstName: personData.first_name,
      lastName: personData.last_name,
      fullName: `${personData.first_name} ${personData.last_name}`,
      title: personData.title,
      company: personData.organization_name,
      city: personData.city,
      state: personData.state,
      country: personData.country,
      email: personData.email,
      phone: phoneNumber,
      phoneType: phoneNumbers[0].type,
      linkedinUrl: personData.linkedin_url,
      age: verifyResult.details?.age,
      carrier: verifyResult.details?.carrier,
    };
    
    // 获取任务信息
    const task = await getSearchTask(taskId);
    if (task) {
      await saveSearchResult(task.id, personId, resultData, verifyResult.verified, verifyResult.matchScore, verifyResult.details);
      
      // 更新任务统计
      const results = await getSearchResults(taskId);
      const validCount = results.filter(r => r.verified).length;
      
      await updateSearchTask(taskId, {
        actualCount: validCount
      });
      
      console.log(`[Apollo Webhook] Saved result for ${personData.first_name} ${personData.last_name}, verified: ${verifyResult.verified}`);
    }
  }
}

export function getWebhookUrl(): string {
  // 使用环境变量或默认的 Railway URL
  const baseUrl = process.env.PUBLIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'https://leadhunter-pro-production.up.railway.app';
  
  return `${baseUrl}/api/apollo-webhook`;
}
