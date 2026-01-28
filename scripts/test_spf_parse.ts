/**
 * 测试 SPF 解析逻辑
 */
import { parseSearchPageFull, parseDetailPage, SpfDetailResult } from "../server/spf/scraper";
import * as fs from "fs";

// 读取测试 HTML 文件
const searchHtml = fs.readFileSync("/tmp/search.html", "utf-8");
const detailHtml = fs.readFileSync("/tmp/detail.html", "utf-8");

console.log("=== 测试搜索页面解析 ===");
const searchResults = parseSearchPageFull(searchHtml);
console.log(`解析到 ${searchResults.length} 个结果`);

if (searchResults.length > 0) {
  console.log("\n第一个结果:");
  const first = searchResults[0];
  console.log(`  姓名: ${first.name}`);
  console.log(`  年龄: ${first.age}`);
  console.log(`  城市: ${first.city}`);
  console.log(`  州: ${first.state}`);
  console.log(`  电话: ${first.phone}`);
  console.log(`  电话类型: ${first.phoneType}`);
  console.log(`  详情链接: ${first.detailLink}`);
}

console.log("\n=== 测试详情页面解析 ===");
const detailResult = parseDetailPage(detailHtml, "/find/john-smith/test");
if (detailResult) {
  console.log(`  姓名: ${detailResult.name}`);
  console.log(`  年龄: ${detailResult.age}`);
  console.log(`  邮箱: ${detailResult.email}`);
  console.log(`  所有邮箱: ${JSON.stringify(detailResult.allEmails)}`);
  console.log(`  婚姻状态: ${detailResult.maritalStatus}`);
  console.log(`  配偶: ${detailResult.spouseName}`);
  console.log(`  就业: ${detailResult.employment}`);
  console.log(`  电话: ${detailResult.phone}`);
  console.log(`  电话类型: ${detailResult.phoneType}`);
} else {
  console.log("详情页面解析失败!");
}

console.log("\n=== 模拟保存到数据库的数据 ===");
if (searchResults.length > 0 && detailResult) {
  const merged: SpfDetailResult = {
    ...searchResults[0],
    ...detailResult,
    name: detailResult.name || searchResults[0].name,
    age: detailResult.age || searchResults[0].age,
    phone: detailResult.phone || searchResults[0].phone,
    phoneType: detailResult.phoneType || searchResults[0].phoneType,
  };
  
  console.log("合并后的数据:");
  console.log(JSON.stringify(merged, null, 2));
}

process.exit(0);
