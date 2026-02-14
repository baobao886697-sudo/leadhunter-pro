# WebSocket 注入点分析

## 后端注入点（3个模块 + 积分 + 通知）

### 1. TPS Router (server/tps/router.ts)
- userId: ctx.user!.id (line 150)
- taskId: task.taskId (string)
- 函数: executeTpsSearchRealtimeDeduction(taskDbId, taskId, config, input, userId)
- 进度更新: updateTpsSearchTaskProgress(taskDbId, {...}) - 3处
- 完成: completeTpsSearchTask(taskDbId, {...}) - 1处
- 失败: failTpsSearchTask(taskDbId, error.message, logs) - 1处

### 2. SPF Router (server/spf/router.ts)
- userId: userId (from ctx.user!.id)
- taskId: task.taskId (string)
- 函数: executeSpfSearchRealtimeDeduction(taskDbId, taskId, config, input, userId)
- 进度更新: updateSpfSearchTaskProgress(taskDbId, {...}) - 4处
- 完成: completeSpfSearchTask(taskDbId, {...}) - 1处
- 失败: failSpfSearchTask(taskDbId, error.message, logs) - 1处

### 3. Anywho Router (server/anywho/router.ts)
- userId: userId (from ctx.user!.id)
- taskId: task.taskId (string) - 注意Anywho用taskId而不是taskDbId
- 函数: executeAnywhoSearchRealtime(taskId, taskDbId, userId, subTasks, filters, config)
- 进度更新: updateAnywhoSearchTaskProgress(taskId, {...}) - 5处
- 完成: completeAnywhoSearchTask(taskId, {...}) - 1处
- 失败: failAnywhoSearchTask(taskId, error.message) - 1处

### 4. 积分变化
- 在 realtimeCredits.ts 的 deduct() 方法中，每次扣除后推送
- 每个模块有自己的 realtimeCredits

### 5. 通知
- NotificationCenter 当前每30秒轮询一次未读数
- 需要在后端发送消息时推送

## 前端注入点

### 1. TpsTask.tsx - refetchInterval: 2000
### 2. SpfTask.tsx - refetchInterval: 2000
### 3. AnywhoTask.tsx - refetchInterval: 2000
### 4. Dashboard.tsx - 无自动刷新
### 5. NotificationCenter.tsx - refetchInterval: 30000
### 6. History.tsx - 无自动刷新
