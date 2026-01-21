# LeadHunter Pro 积分与任务控制系统深度分析

**作者**: Manus AI
**日期**: 2026年1月21日

## 1. 概述

本报告旨在深入分析 LeadHunter Pro 项目的积分系统和任务控制机制。分析内容涵盖了积分的**扣除**、**退还**（节省）以及搜索任务的**停止**（手动与自动）三大核心部分。通过对相关代码的详细剖析，本报告将清晰地展示其内部工作流、关键函数和业务逻辑，为后续的功能调整和优化提供坚实的技术依据。

## 2. 积分扣除系统 (Credit Deduction)

LeadHunter Pro 的积分扣除采用**分阶段预扣+按量结算**的模式，确保了费用的合理性和透明度。整个扣除流程分为两个主要阶段。

### 2.1. 阶段一：搜索基础费 (Search Fee)

在搜索任务正式开始、调用任何外部 API 之前，系统会首先扣除一笔固定的**搜索基础费**。这笔费用用于覆盖启动搜索任务的基础成本。

- **扣除时机**: 任务初始化后，调用 Apify API 之前。
- **费用常量**: `SEARCH_CREDITS = 1` 积分。
- **实现代码** (`server/services/searchProcessorV3.ts`):

  ```typescript
  // 阶段 2: 扣除搜索积分
  addLog(`💳 正在扣除搜索基础费用...`, 'info', 'init', '');
  const searchDeducted = await deductCredits(userId, SEARCH_CREDITS, 'search', `搜索: ${searchName} | ${searchTitle} | ${searchState}`, task.taskId);
  if (!searchDeducted) throw new Error('扣除搜索积分失败');
  stats.creditsUsed += SEARCH_CREDITS;
  addLog(`✅ 已扣除搜索费用: ${SEARCH_CREDITS} 积分`, 'success', 'init', '✅');
  ```

### 2.2. 阶段二：数据处理费 (Data Fee)

在从 Apify 获取数据后，系统会根据**实际可处理的数据量**（用户请求数和 Apify 返回数的较小值）来计算并**一次性扣除**所有的数据处理费用。

- **扣除时机**: Apify 返回数据后，开始逐条处理数据之前。
- **费用常量**: `PHONE_CREDITS_PER_PERSON = 2` 积分/条。
- **实现代码** (`server/services/searchProcessorV3.ts`):

  ```typescript
  // 阶段 4: 计算实际数量并一次性扣除数据费用
  const actualCount = Math.min(apifyResults.length, requestedCount);
  const dataCreditsNeeded = actualCount * PHONE_CREDITS_PER_PERSON;

  // 检查用户积分是否足够
  // ...

  // 一次性扣除数据费用
  const dataDeducted = await deductCredits(
    userId, 
    dataCreditsNeeded, 
    'search', 
    `数据费用: ${actualCount} 条 × ${PHONE_CREDITS_PER_PERSON} 积分`, 
    task.taskId
  );
  stats.creditsUsed += dataCreditsNeeded;
  ```

### 2.3. 核心扣费函数

所有的扣费操作都由 `deductCredits` 函数统一处理，该函数负责更新用户余额并记录消费日志。

- **函数位置**: `server/db.ts`
- **核心逻辑**:
  1. 检查用户余额是否充足。
  2. 更新 `users` 表中的 `credits` 字段。
  3. 在 `creditLogs` 表中插入一条消费记录。

### 积分扣除总结

| 扣费阶段 | 费用类型 | 金额 | 触发时机 |
| :--- | :--- | :--- | :--- |
| **阶段一** | 搜索基础费 | `1` 积分 | 任务初始化后 |
| **阶段二** | 数据处理费 | `实际处理数量 × 2` 积分 | 获取数据后，处理数据前 |

## 3. 积分退还系统 (Credit Refund)

系统中的“退还”分为两种情况：一种是因实际数据量少于请求量而产生的**积分节省**，另一种是因任务异常中断而产生的**真实积分退还**。

### 3.1. 积分节省 (Saved Credits)

这并非真正的“退还”，而是**按量计费**带来的好处。系统预估时按用户请求数量计算，但最终只按实际处理的数量扣费，差额部分即为“节省”的积分。

- **触发条件**: `实际处理数量 (actualCount) < 用户请求数量 (requestedCount)`。
- **实现代码** (`server/services/searchProcessorV3.ts`):

  ```typescript
  if (actualCount < requestedCount) {
    const savedCredits = (requestedCount - actualCount) * PHONE_CREDITS_PER_PERSON;
    stats.creditsRefunded = savedCredits;  // 注意：这里只是记录到统计数据中
    addLog(`💰 积分节省通知:`, 'success', 'process', '💰');
    addLog(`   您节省了 ${savedCredits} 积分！`, 'success', 'process', '');
  }
  ```

> **关键点**: 此处并未调用 `addCredits` 函数，仅仅是在 `stats` 对象中记录了 `creditsRefunded` 的值，用于前端展示和最终统计，用户的余额没有发生“先多扣再退还”的变动。

### 3.2. 真实积分退还 (Actual Refund)

当搜索任务在处理过程中因特定原因（目前仅限于**外部 API 积分耗尽**）而提前终止时，系统会将被扣除但未处理的数据费用**真实地退还**给用户。

- **触发条件**: 在数据处理的批次循环中，检测到 `apiCreditsExhausted` 标志为 `true`。
- **实现代码** (`server/services/searchProcessorV3.ts`):

  ```typescript
  if (apiCreditsExhausted) {
    // ... 记录日志 ...

    // 计算退还积分
    const unprocessedCount = actualCount - processedCount;
    const refundCredits = unprocessedCount * PHONE_CREDITS_PER_PERSON;

    if (refundCredits > 0) {
      // 直接通过 SQL 更新用户余额
      await db.update(users)
        .set({ credits: sql`credits + ${refundCredits}` })
        .where(eq(users.id, userId));
      
      stats.creditsRefunded += refundCredits;
      addLog(`💰 已退还 ${refundCredits} 积分...`, 'success', 'process', '');
    }
    
    progress.status = 'stopped';
    break; // 跳出批次循环
  }
  ```

> **关键点**: 此处通过 `sql`credits + ${refundCredits}`` 直接更新数据库，将未处理部分的积分返还给用户。这里没有调用 `addCredits` 函数，可能是为了避免循环依赖或简化逻辑。

## 4. 任务停止机制 (Task Stop)

搜索任务可以通过两种方式停止：用户**手动停止**或系统**自动停止**。

### 4.1. 手动停止

用户可以在前端界面上主动停止一个正在运行的搜索任务。

- **前端触发**: 用户点击停止按钮，调用 `search.stop` tRPC 接口。
- **后端接口** (`server/routers.ts`):
  ```typescript
  stop: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... 权限检查 ...
      await updateSearchTaskStatus(input.taskId, 'stopped');
      return { success: true, message: "搜索任务已停止" };
    }),
  ```
- **后端轮询检查**: 在 `searchProcessorV3.ts` 的核心处理循环中，每个批次开始前都会检查任务状态。如果状态变为 `stopped`，则中断循环。
  ```typescript
  // 在批次循环开始前检查
  const currentTask = await getSearchTask(task.taskId);
  if (currentTask?.status === 'stopped') {
    addLog(`⏹️ 任务已被用户停止`, 'warning', 'complete', '⏹️');
    progress.status = 'stopped';
    break; // 跳出循环
  }
  ```

### 4.2. 自动停止

当系统遇到无法恢复的严重问题时，会自动停止任务以防止资源浪费和无效的积分消耗。

- **当前触发条件**: 电话验证 API (Scrape.do) 的积分为空。
- **实现逻辑**: 在 `verifyPhoneNumber` 函数返回 `apiError: 'INSUFFICIENT_CREDITS'` 时，`apiCreditsExhausted` 标志被设为 `true`。批次处理结束后，系统检测到此标志，触发上文提到的**真实积分退还**逻辑，并中断任务。

## 5. 核心函数与代码位置

| 函数/常量 | 位置 | 用途 |
| :--- | :--- | :--- |
| `deductCredits` | `server/db.ts` | **核心扣费函数**。更新用户余额，记录消费日志。 |
| `addCredits` | `server/db.ts` | **核心加分函数**。用于充值、管理员赠送等，**未在退款逻辑中直接使用**。 |
| `updateSearchTaskStatus` | `server/db.ts` | 更新搜索任务的状态（如 `running`, `stopped`）。 |
| `SEARCH_CREDITS` | `server/services/searchProcessorV3.ts` | `1` - 搜索基础费常量。 |
| `PHONE_CREDITS_PER_PERSON` | `server/services/searchProcessorV3.ts` | `2` - 每条数据的处理费用常量。 |

## 6. 总结与建议

LeadHunter Pro 的积分与任务控制系统设计得相当精巧和健壮，实现了分阶段扣费、按量计费、异常退款和任务控制等关键功能。

**优点**:
- **费用公平**: 按量计费模式对用户非常友好，避免了为未获得的数据付费。
- **流程清晰**: 任务日志详细记录了每一步操作，包括积分的扣除、节省和退还，透明度高。
- **控制灵活**: 支持用户手动和系统自动两种任务停止方式，并能正确处理善后（如退款）。

**可优化建议**:
1.  **统一退款入口**: “真实积分退还”逻辑目前是直接执行 SQL 更新。可以考虑统一调用 `addCredits` 函数（并传入 `refund` 类型），使积分操作更加集中和规范，便于审计和维护。
2.  **明确“节省”与“退还”**: 在前端日志和UI展示上，可以更明确地区分“积分节省”（少扣了）和“积分退还”（退回来了），避免用户混淆。
3.  **增加停止原因**: `searchTasks` 表可以增加一个 `stopReason` 字段，用于记录任务是“用户手动停止”还是“API积分耗尽”等，便于后台分析和问题排查。

---

### 参考文件

- `server/services/searchProcessorV3.ts`
- `server/db.ts`
- `server/routers.ts`
