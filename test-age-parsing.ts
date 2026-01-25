/**
 * 测试脚本：验证 parseDetailPage 函数的年龄解析逻辑
 */

import * as cheerio from 'cheerio';

interface TpsSearchResult {
  name: string;
  age?: number;
  location: string;
  detailLink: string;
}

interface TpsDetailResult {
  name: string;
  age?: number;
  city?: string;
  state?: string;
  location?: string;
  phone?: string;
  phoneType?: string;
  carrier?: string;
  reportYear?: number;
  isPrimary?: boolean;
  propertyValue?: number;
  yearBuilt?: number;
  detailLink?: string;
}

// 从 scraper.ts 复制的 parseDetailPage 函数（修复后版本）
function parseDetailPage(html: string, searchResult: TpsSearchResult): TpsDetailResult[] {
  const $ = cheerio.load(html);
  const results: TpsDetailResult[] = [];
  const name = searchResult.name;
  
  // 优先使用搜索结果中的年龄，如果没有则尝试从详情页解析
  let age = searchResult.age;
  if (age === undefined) {
    // 尝试从详情页标题解析年龄，格式通常是 "Name, Age XX"
    const title = $('title').text();
    const titleAgeMatch = title.match(/,\s*Age\s*(\d+)/i);
    if (titleAgeMatch) {
      age = parseInt(titleAgeMatch[1], 10);
    }
    
    // 如果标题中没有，尝试从页面内容解析
    if (age === undefined) {
      const pageText = $('body').text();
      // 匹配 "Age: XX" 或 "XX years old" 格式
      const agePatterns = [
        /\bAge[:\s]*(\d{1,3})\b/i,
        /\b(\d{1,3})\s*years?\s*old\b/i,
        /\bborn\s+(?:in\s+)?\d{4}.*?\((\d{1,3})\)/i,
      ];
      for (const pattern of agePatterns) {
        const match = pageText.match(pattern);
        if (match) {
          const parsedAge = parseInt(match[1], 10);
          // 合理年龄范围检查 (18-120)
          if (parsedAge >= 18 && parsedAge <= 120) {
            age = parsedAge;
            break;
          }
        }
      }
    }
  }
  
  let city = '';
  let state = '';
  const title = $('title').text();
  const titleMatch = title.match(/in\s+([^,]+),\s*([A-Z]{2})/);
  if (titleMatch) {
    city = titleMatch[1].trim();
    state = titleMatch[2].trim();
  }
  
  // 简化版本：只返回基本信息用于测试
  results.push({
    name,
    age,
    city,
    state,
    location: city && state ? `${city}, ${state}` : (city || state || ''),
    detailLink: searchResult.detailLink,
  });
  
  return results;
}

// 测试用例
const testCases = [
  {
    name: '测试1: 搜索结果有年龄',
    html: '<html><head><title>John Smith in New York, NY</title></head><body></body></html>',
    searchResult: { name: 'John Smith', age: 55, location: 'New York, NY', detailLink: '/find/person/123' },
    expectedAge: 55,
  },
  {
    name: '测试2: 搜索结果无年龄，标题有年龄',
    html: '<html><head><title>John Smith, Age 62 in Los Angeles, CA</title></head><body></body></html>',
    searchResult: { name: 'John Smith', location: 'Los Angeles, CA', detailLink: '/find/person/456' },
    expectedAge: 62,
  },
  {
    name: '测试3: 搜索结果无年龄，页面内容有年龄',
    html: '<html><head><title>Jane Doe in Chicago, IL</title></head><body><div>Jane Doe is 48 years old</div></body></html>',
    searchResult: { name: 'Jane Doe', location: 'Chicago, IL', detailLink: '/find/person/789' },
    expectedAge: 48,
  },
  {
    name: '测试4: 搜索结果无年龄，页面有 Age: XX 格式',
    html: '<html><head><title>Bob Johnson in Miami, FL</title></head><body><div>Age: 71</div></body></html>',
    searchResult: { name: 'Bob Johnson', location: 'Miami, FL', detailLink: '/find/person/101' },
    expectedAge: 71,
  },
  {
    name: '测试5: 搜索结果无年龄，页面也无年龄',
    html: '<html><head><title>Unknown Person in Seattle, WA</title></head><body><div>No age information</div></body></html>',
    searchResult: { name: 'Unknown Person', location: 'Seattle, WA', detailLink: '/find/person/102' },
    expectedAge: undefined,
  },
];

console.log('=== 年龄解析测试 ===\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const results = parseDetailPage(testCase.html, testCase.searchResult);
  const actualAge = results[0]?.age;
  const success = actualAge === testCase.expectedAge;
  
  if (success) {
    console.log(`✅ ${testCase.name}`);
    console.log(`   预期: ${testCase.expectedAge}, 实际: ${actualAge}`);
    passed++;
  } else {
    console.log(`❌ ${testCase.name}`);
    console.log(`   预期: ${testCase.expectedAge}, 实际: ${actualAge}`);
    failed++;
  }
  console.log();
}

console.log('=== 测试结果 ===');
console.log(`通过: ${passed}, 失败: ${failed}`);
console.log(`总计: ${testCases.length}`);
