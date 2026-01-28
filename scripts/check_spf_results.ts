import { getDb } from "../server/db";
import { spfSearchTasks, spfSearchResults } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("数据库连接失败");
    return;
  }
  
  // 获取最近的任务
  const tasks = await db
    .select()
    .from(spfSearchTasks)
    .orderBy(desc(spfSearchTasks.id))
    .limit(3);
  
  console.log("最近的任务:");
  for (const task of tasks) {
    console.log(`  Task ID: ${task.taskId}, DB ID: ${task.id}, Status: ${task.status}`);
    
    // 获取该任务的结果数量
    const results = await db
      .select()
      .from(spfSearchResults)
      .where(eq(spfSearchResults.taskId, task.id));
    
    console.log(`  结果数量: ${results.length}`);
    if (results.length > 0) {
      console.log(`  第一条结果: ${JSON.stringify(results[0], null, 2)}`);
    }
    console.log("");
  }
  
  process.exit(0);
}

main().catch(console.error);
