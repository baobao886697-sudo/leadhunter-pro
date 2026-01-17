import { 
  getUserById, 
  deductCredits, 
  createSearchTask, 
  updateSearchTask, 
  getSearchTask,
  saveSearchResults,
  getCachedData,
  saveToCacheAndUpdateHit,
  incrementCacheHit
} from '../db';
import { searchPeople, enrichPeopleBatch, ApolloPerson } from './apollo';
import { verifyPhoneNumber, PersonToVerify } from './scraper';
import { SearchTask, SearchResult } from '../../drizzle/schema';

const BATCH_SIZE = 50; // 每批获取50个电话
const APOLLO_BATCH_SIZE = 10; // Apollo每次最多10人

export interface SearchProgress {
  taskId: number;
  status: string;
  totalResults: number;
  phonesRequested: number;
  phonesFetched: number;
  phonesVerified: number;
  creditsUsed: number;
  logs: string[];
}

/**
 * 执行完整的搜索流程
 */
export async function executeSearch(
  userId: number,
  searchName: string,
  searchTitle: string,
  searchState: string,
  onProgress?: (progress: SearchProgress) => void
): Promise<SearchTask | undefined> {
  const logs: string[] = [];
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
  };

  // 检查用户积分
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  if (user.credits < 1) {
    throw new Error('积分不足，请先充值');
  }

  // 创建搜索任务
  const task = await createSearchTask(userId, searchName, searchTitle, searchState);
  if (!task) {
    throw new Error('创建搜索任务失败');
  }

  addLog(`搜索任务已创建，任务ID: ${task.id}`);
  addLog(`搜索条件: 姓名="${searchName}", 职位="${searchTitle}", 州="${searchState}"`);

  try {
    // 扣除搜索费用（1积分）
    const searchDeduct = await deductCredits(userId, 1, 'search', `搜索: ${searchName} ${searchTitle} ${searchState}`, task.id);
    if (!searchDeduct.success) {
      await updateSearchTask(task.id, { status: 'failed', errorMessage: '积分不足' });
      throw new Error('积分不足，无法开始搜索');
    }

    addLog(`已扣除搜索费用: 1积分，剩余: ${searchDeduct.newBalance}积分`);

    // 更新任务状态
    await updateSearchTask(task.id, { 
      status: 'searching',
      creditsUsed: 1,
      processLog: logs 
    });

    // 第一步：检查储存库是否有缓存数据
    addLog('正在检查储存库缓存...');
    const cachedData = await getCachedData(searchName, searchTitle, searchState);
    
    let apolloPeople: ApolloPerson[] = [];
    let fromCache = false;

    if (cachedData.length > 0) {
      addLog(`储存库命中! 找到 ${cachedData.length} 条缓存数据`);
      fromCache = true;
      
      // 更新缓存命中计数
      for (const cache of cachedData) {
        await incrementCacheHit(cache.id);
      }

      // 将缓存数据转换为Apollo格式
      apolloPeople = cachedData.map(c => ({
        id: c.apolloId,
        first_name: c.firstName || '',
        last_name: c.lastName || '',
        name: c.fullName || '',
        title: c.title || '',
        organization_name: c.company || '',
        city: c.city || '',
        state: c.state || '',
        country: c.country || '',
        linkedin_url: c.linkedinUrl || '',
        email: c.email || '',
        phone_numbers: c.phoneNumber ? [{
          raw_number: c.phoneNumber,
          sanitized_number: c.phoneNumber.replace(/\D/g, ''),
          type: c.phoneType || 'unknown',
          position: 0,
          status: 'verified'
        }] : undefined,
      }));
    } else {
      // 第二步：调用Apollo.io搜索
      addLog('储存库未命中，调用Apollo.io搜索...');
      
      const searchResult = await searchPeople({
        name: searchName,
        titles: [searchTitle],
        states: [searchState],
        perPage: 100,
      }, userId, task.id);

      apolloPeople = searchResult.people || [];
      addLog(`Apollo搜索完成，找到 ${apolloPeople.length} 个结果`);

      await updateSearchTask(task.id, { 
        totalResults: apolloPeople.length,
        processLog: logs 
      });
    }

    if (apolloPeople.length === 0) {
      addLog('未找到匹配的结果');
      await updateSearchTask(task.id, { 
        status: 'completed',
        completedAt: new Date(),
        processLog: logs 
      });
      return getSearchTask(task.id) || undefined;
    }

    // 第三步：批量获取电话号码（如果不是从缓存获取）
    let peopleWithPhones: ApolloPerson[] = [];

    if (fromCache) {
      // 缓存数据已有电话号码
      peopleWithPhones = apolloPeople.filter(p => p.phone_numbers && p.phone_numbers.length > 0);
      addLog(`缓存数据中有 ${peopleWithPhones.length} 条包含电话号码`);
    } else {
      // 需要从Apollo获取电话号码
      await updateSearchTask(task.id, { status: 'fetching_phones', processLog: logs });

      // 检查积分是否足够获取一批（50个 * 2积分 = 100积分）
      const currentUser = await getUserById(userId);
      const requiredCredits = Math.min(apolloPeople.length, BATCH_SIZE) * 2;

      if (!currentUser || currentUser.credits < requiredCredits) {
        addLog(`积分不足，需要 ${requiredCredits} 积分，当前仅有 ${currentUser?.credits || 0} 积分`);
        await updateSearchTask(task.id, { 
          status: 'stopped',
          errorMessage: '积分不足，请充值后继续',
          processLog: logs 
        });
        return getSearchTask(task.id) || undefined;
      }

      // 跳动提取：打乱顺序后取前50个
      const shuffledPeople = shuffleArray([...apolloPeople]);
      const peopleToEnrich = shuffledPeople.slice(0, BATCH_SIZE);

      addLog(`开始获取电话号码，本批次: ${peopleToEnrich.length} 人`);

      // 扣除费用
      const phoneDeduct = await deductCredits(
        userId, 
        peopleToEnrich.length * 2, 
        'phone_fetch', 
        `获取电话号码: ${peopleToEnrich.length}条`,
        task.id
      );

      if (!phoneDeduct.success) {
        addLog('积分扣除失败');
        await updateSearchTask(task.id, { 
          status: 'stopped',
          errorMessage: '积分不足',
          processLog: logs 
        });
        return getSearchTask(task.id) || undefined;
      }

      addLog(`已扣除费用: ${peopleToEnrich.length * 2}积分，剩余: ${phoneDeduct.newBalance}积分`);

      // 批量获取电话
      const enrichedPeople = await enrichPeopleBatch(
        peopleToEnrich.map(p => p.id),
        userId,
        task.id
      );

      addLog(`Apollo返回 ${enrichedPeople.length} 条带电话的数据`);

      // 保存到储存库
      for (const person of enrichedPeople) {
        if (person.phone_numbers && person.phone_numbers.length > 0) {
          await saveToCacheAndUpdateHit({
            cacheKey: '', // 会在函数内生成
            searchName: searchName.toLowerCase().trim(),
            searchTitle: searchTitle.toLowerCase().trim(),
            searchState: searchState.toLowerCase().trim(),
            apolloId: person.id,
            firstName: person.first_name,
            lastName: person.last_name,
            fullName: person.name,
            title: person.title,
            company: person.organization_name,
            city: person.city,
            state: person.state,
            country: person.country,
            linkedinUrl: person.linkedin_url,
            email: person.email,
            phoneNumber: person.phone_numbers[0]?.raw_number,
            phoneType: (person.phone_numbers[0]?.type as any) || 'unknown',
            carrier: null,
            rawData: person,
          });
        }
      }

      peopleWithPhones = enrichedPeople.filter(p => p.phone_numbers && p.phone_numbers.length > 0);
      addLog(`${peopleWithPhones.length} 条数据包含有效电话号码`);

      await updateSearchTask(task.id, { 
        phonesRequested: peopleToEnrich.length,
        phonesFetched: peopleWithPhones.length,
        creditsUsed: 1 + peopleToEnrich.length * 2,
        processLog: logs 
      });
    }

    // 第四步：Scrape.do二次验证
    if (peopleWithPhones.length > 0) {
      await updateSearchTask(task.id, { status: 'verifying', processLog: logs });
      addLog('开始Scrape.do二次验证...');

      const verifiedResults: Partial<SearchResult>[] = [];
      let verifiedCount = 0;

      for (const person of peopleWithPhones) {
        const phoneNumber = person.phone_numbers?.[0]?.raw_number;
        if (!phoneNumber) continue;

        const personToVerify: PersonToVerify = {
          firstName: person.first_name,
          lastName: person.last_name,
          city: person.city,
          state: person.state,
          phoneNumber,
        };

        const verifyResult = await verifyPhoneNumber(personToVerify, userId, task.id);

        if (verifyResult.verified || verifyResult.matchScore >= 50) {
          verifiedCount++;
          
          verifiedResults.push({
            taskId: task.id,
            userId,
            apolloId: person.id,
            firstName: person.first_name,
            lastName: person.last_name,
            fullName: person.name,
            title: person.title,
            company: person.organization_name,
            city: person.city,
            state: person.state,
            country: person.country,
            linkedinUrl: person.linkedin_url,
            email: person.email,
            phoneNumber,
            phoneType: verifyResult.phoneType || (person.phone_numbers?.[0]?.type as any) || 'unknown',
            carrier: verifyResult.carrier,
            age: verifyResult.age,
            verificationStatus: verifyResult.verified ? 'verified' : 'pending',
            verificationSource: verifyResult.source === 'none' ? null : verifyResult.source,
            matchScore: verifyResult.matchScore,
            rawApolloData: person,
            rawVerificationData: verifyResult.rawData,
            fromCache,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
          });

          addLog(`验证通过: ${person.name} - ${phoneNumber} (匹配分数: ${verifyResult.matchScore})`);
        } else {
          addLog(`验证失败: ${person.name} - ${phoneNumber} (匹配分数: ${verifyResult.matchScore})`);
        }

        // 报告进度
        if (onProgress) {
          onProgress({
            taskId: task.id,
            status: 'verifying',
            totalResults: apolloPeople.length,
            phonesRequested: peopleWithPhones.length,
            phonesFetched: peopleWithPhones.length,
            phonesVerified: verifiedCount,
            creditsUsed: 1 + peopleWithPhones.length * 2,
            logs,
          });
        }
      }

      // 保存验证结果
      if (verifiedResults.length > 0) {
        await saveSearchResults(verifiedResults as any);
      }

      addLog(`验证完成，共 ${verifiedCount} 条通过验证`);

      await updateSearchTask(task.id, { 
        phonesVerified: verifiedCount,
        processLog: logs 
      });
    }

    // 完成任务
    addLog('搜索任务完成');
    await updateSearchTask(task.id, { 
      status: 'completed',
      completedAt: new Date(),
      processLog: logs 
    });

    return getSearchTask(task.id) || undefined;
  } catch (error: any) {
    addLog(`错误: ${error.message}`);
    await updateSearchTask(task.id, { 
      status: 'failed',
      errorMessage: error.message,
      processLog: logs 
    });
    throw error;
  }
}

// 工具函数：打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
