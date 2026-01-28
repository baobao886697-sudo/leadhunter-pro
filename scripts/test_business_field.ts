/**
 * 测试脚本：分析 SearchPeopleFree 详情页面的企业关联字段
 */

import * as cheerio from 'cheerio';

const SCRAPE_DO_TOKEN = process.env.SPF_SCRAPE_DO_TOKEN || '';

async function fetchWithScrapedo(url: string): Promise<string> {
  const encodedUrl = encodeURIComponent(url);
  const apiUrl = `https://api.scrape.do/?token=${SCRAPE_DO_TOKEN}&url=${encodedUrl}&super=true&geoCode=us`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Scrape.do API 请求失败: ${response.status} ${response.statusText}`);
  }
  
  return await response.text();
}

async function analyzeDetailPage(url: string) {
  console.log('正在获取详情页面:', url);
  
  const html = await fetchWithScrapedo(url);
  const $ = cheerio.load(html);
  
  console.log('\n========== 企业关联分析 ==========\n');
  
  // 1. 查找 business-bg 元素
  const businessBg = $('article.business-bg');
  console.log('business-bg 元素数量:', businessBg.length);
  
  if (businessBg.length) {
    console.log('business-bg HTML:', businessBg.html()?.slice(0, 500));
    
    const businesses: string[] = [];
    businessBg.find('ol.inline li').each((_, liEl) => {
      const business = $(liEl).text().trim();
      if (business) {
        businesses.push(business);
      }
    });
    console.log('解析到的企业:', businesses);
  }
  
  // 2. 查找所有可能包含企业信息的元素
  console.log('\n========== 搜索其他可能的企业相关元素 ==========\n');
  
  // 查找包含 "business" 或 "company" 的元素
  const allText = $('body').text();
  if (allText.toLowerCase().includes('business')) {
    console.log('页面包含 "business" 关键词');
  }
  if (allText.toLowerCase().includes('company')) {
    console.log('页面包含 "company" 关键词');
  }
  if (allText.toLowerCase().includes('employer')) {
    console.log('页面包含 "employer" 关键词');
  }
  if (allText.toLowerCase().includes('work')) {
    console.log('页面包含 "work" 关键词');
  }
  
  // 3. 查找所有 article 元素
  console.log('\n========== 所有 article 元素的 class ==========\n');
  $('article').each((i, el) => {
    const className = $(el).attr('class');
    console.log(`article[${i}]: class="${className}"`);
  });
  
  // 4. 查找所有 section 元素
  console.log('\n========== 所有 section 元素的 class ==========\n');
  $('section').each((i, el) => {
    const className = $(el).attr('class');
    const id = $(el).attr('id');
    console.log(`section[${i}]: class="${className}", id="${id}"`);
  });
  
  // 5. 查找就业信息
  console.log('\n========== 就业信息 ==========\n');
  const employmentBg = $('article.employment-bg');
  if (employmentBg.length) {
    console.log('employment-bg HTML:', employmentBg.html()?.slice(0, 500));
  } else {
    console.log('未找到 employment-bg 元素');
  }
  
  // 6. 保存 HTML 到文件以便分析
  const fs = await import('fs');
  fs.writeFileSync('/tmp/spf_detail_page.html', html);
  console.log('\n完整 HTML 已保存到 /tmp/spf_detail_page.html');
}

// 使用一个已知的详情页 URL 进行测试
const testUrl = 'https://www.searchpeoplefree.com/find/john-thomas-smith/21tVsC2oOwQr';

analyzeDetailPage(testUrl).catch(console.error);
