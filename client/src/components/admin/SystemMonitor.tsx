import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Activity, Server, Zap, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, TrendingUp, Clock, Database, Cpu, HardDrive,
  BarChart3, PieChart, LineChart
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function SystemMonitor() {
  const [activeTab, setActiveTab] = useState("api");

  // 获取API统计
  const { data: apiStats, isLoading: apiLoading, refetch: refetchApi } = trpc.admin.getApiStatistics.useQuery(
    { days: 30 },
    { enabled: activeTab === "api" }
  );

  // 获取错误日志
  const { data: errorLogs, isLoading: errorLoading, refetch: refetchErrors } = trpc.admin.getErrorLogs.useQuery(
    { limit: 50 },
    { enabled: activeTab === "errors" }
  );

  // 获取缓存统计
  const { data: cacheStats, isLoading: cacheLoading, refetch: refetchCache } = trpc.admin.cacheStats.useQuery(
    undefined,
    { enabled: activeTab === "cache" }
  );

  // 解决错误
  const resolveErrorMutation = trpc.admin.resolveError.useMutation({
    onSuccess: () => {
      toast.success("已标记为已解决");
      refetchErrors();
    },
    onError: (error) => {
      toast.error(error.message || "操作失败");
    },
  });

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      error: "bg-red-500/20 text-red-400 border-red-500/30",
      warn: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    return <Badge className={styles[level] || styles.info}>{level}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-400" />
            系统监控
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            监控系统运行状态和性能指标
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="api">API统计</TabsTrigger>
          <TabsTrigger value="errors">错误日志</TabsTrigger>
          <TabsTrigger value="cache">缓存状态</TabsTrigger>
        </TabsList>

        {/* API统计 */}
        <TabsContent value="api" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchApi()}
              className="border-slate-600"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>

          {apiLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : apiStats ? (
            <div className="space-y-4">
              {/* 概览卡片 */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">总调用次数</p>
                        <p className="text-2xl font-bold text-white">{apiStats.totalCalls || 0}</p>
                      </div>
                      <Zap className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">成功率</p>
                        <p className="text-2xl font-bold text-green-400">{apiStats.successRate || 0}%</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">平均响应时间</p>
                        <p className="text-2xl font-bold text-orange-400">{apiStats.avgResponseTime || 0}ms</p>
                      </div>
                      <Clock className="h-8 w-8 text-orange-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">错误次数</p>
                        <p className="text-2xl font-bold text-red-400">{apiStats.errorCount || 0}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* API调用详情 */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">API调用统计（最近30天）</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">API端点</TableHead>
                        <TableHead className="text-slate-400">调用次数</TableHead>
                        <TableHead className="text-slate-400">成功次数</TableHead>
                        <TableHead className="text-slate-400">失败次数</TableHead>
                        <TableHead className="text-slate-400">平均耗时</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiStats.byEndpoint?.map((stat: any, index: number) => (
                        <TableRow key={index} className="border-slate-700">
                          <TableCell className="text-white font-mono text-sm">{stat.endpoint}</TableCell>
                          <TableCell className="text-slate-300">{stat.calls}</TableCell>
                          <TableCell className="text-green-400">{stat.success}</TableCell>
                          <TableCell className="text-red-400">{stat.errors}</TableCell>
                          <TableCell className="text-slate-300">{stat.avgTime}ms</TableCell>
                        </TableRow>
                      ))}
                      {(!apiStats.byEndpoint || apiStats.byEndpoint.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                            暂无API调用记录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              暂无数据
            </div>
          )}
        </TabsContent>

        {/* 错误日志 */}
        <TabsContent value="errors" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchErrors()}
              className="border-slate-600"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>

          {errorLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/50">
                      <TableHead className="text-slate-400">时间</TableHead>
                      <TableHead className="text-slate-400">级别</TableHead>
                      <TableHead className="text-slate-400">来源</TableHead>
                      <TableHead className="text-slate-400">错误信息</TableHead>
                      <TableHead className="text-slate-400">状态</TableHead>
                      <TableHead className="text-slate-400 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorLogs?.logs.map((log: any) => (
                      <TableRow key={log.id} className="border-slate-700">
                        <TableCell className="text-slate-300 text-sm">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{getLevelBadge(log.level)}</TableCell>
                        <TableCell className="text-slate-400 font-mono text-xs">
                          {log.source}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm max-w-[300px] truncate">
                          {log.message}
                        </TableCell>
                        <TableCell>
                          {log.resolved ? (
                            <Badge className="bg-green-500/20 text-green-400">已解决</Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400">未解决</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!log.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resolveErrorMutation.mutate({ errorId: log.id })}
                              className="text-green-400 hover:text-green-300"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!errorLogs?.logs || errorLogs.logs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                          暂无错误日志
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 缓存状态 */}
        <TabsContent value="cache" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchCache()}
              className="border-slate-600"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>

          {cacheLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : cacheStats ? (
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">缓存条目</p>
                      <p className="text-2xl font-bold text-white">{cacheStats.entries || 0}</p>
                    </div>
                    <Database className="h-8 w-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">命中率</p>
                      <p className="text-2xl font-bold text-green-400">{cacheStats.hitRate || 0}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">内存使用</p>
                      <p className="text-2xl font-bold text-orange-400">{cacheStats.memoryUsage || "N/A"}</p>
                    </div>
                    <HardDrive className="h-8 w-8 text-orange-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              暂无缓存数据
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
