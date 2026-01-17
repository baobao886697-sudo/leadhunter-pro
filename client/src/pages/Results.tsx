import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  ArrowLeft, Download, RefreshCw, CheckCircle, XCircle, 
  Clock, Phone, User, MapPin, Briefcase, Building
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Results() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);

  const { data: task, isLoading, refetch } = trpc.search.taskStatus.useQuery(
    { taskId: Number(taskId) },
    { 
      enabled: !!user && !!taskId,
      refetchInterval: 3000
    }
  );

  const { data: results } = trpc.search.results.useQuery(
    { taskId: Number(taskId) },
    { enabled: !!user && !!taskId && task?.status === "completed" }
  );

  const exportMutation = trpc.search.exportCsv.useMutation({
    onSuccess: (data) => {
      // 创建下载链接
      const blob = new Blob([data.content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    },
    onError: (error) => {
      toast.error(error.message || "导出失败");
    },
  });

  // 模拟日志更新
  useEffect(() => {
    if (task?.processLog) {
      try {
        const logData = JSON.parse(task.processLog as string);
        if (Array.isArray(logData)) {
          setLogs(logData);
        }
      } catch {
        setLogs([task.processLog as string]);
      }
    }
  }, [task?.processLog]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">已完成</Badge>;
      case "failed":
        return <Badge variant="destructive">失败</Badge>;
      case "searching":
      case "fetching_phones":
      case "verifying":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">处理中</Badge>;
      default:
        return <Badge variant="secondary">等待中</Badge>;
    }
  };

  const progress = task ? Math.round((task.phonesVerified / Math.max(task.totalResults, 1)) * 100) : 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold text-foreground">任务不存在</h2>
            <p className="text-muted-foreground mt-2">该搜索任务可能已过期或不存在</p>
            <Link href="/history">
              <Button className="mt-4">返回历史记录</Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/history">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">搜索结果</h1>
              <p className="text-muted-foreground">
                {task.searchName} · {task.searchTitle} · {task.searchState}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(task.status)}
            {task.status === "completed" && results && results.length > 0 && (
              <Button
                onClick={() => exportMutation.mutate({ taskId: Number(taskId) })}
                disabled={exportMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                导出CSV
              </Button>
            )}
          </div>
        </div>

        {/* 进度卡片 */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">任务进度</CardTitle>
            <CardDescription>
              消耗积分：{task.creditsUsed} · 创建时间：{new Date(task.createdAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">验证进度</span>
              <span className="text-foreground font-medium">
                {task.phonesVerified} / {task.totalResults} 条
              </span>
            </div>
            <Progress value={progress} className="h-2" />

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center p-4 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold text-foreground">{task.totalResults}</div>
                <div className="text-xs text-muted-foreground">搜索结果</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-400">{task.phonesVerified}</div>
                <div className="text-xs text-muted-foreground">验证通过</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/10">
                <div className="text-2xl font-bold text-primary">{task.creditsUsed}</div>
                <div className="text-xs text-muted-foreground">消耗积分</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 处理日志 */}
        {(task.status === "searching" || task.status === "fetching_phones" || task.status === "verifying") && (
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-card-foreground">处理日志</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 rounded-lg bg-secondary/30 p-4">
                <div className="space-y-2 font-mono text-sm">
                  {logs.length > 0 ? (
                    logs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{log}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">等待处理...</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* 结果表格 */}
        {task.status === "completed" && results && results.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">验证通过的结果</CardTitle>
              <CardDescription>共 {results.length} 条记录，结果将保留7天</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-foreground">姓名</TableHead>
                      <TableHead className="text-foreground">职位</TableHead>
                      <TableHead className="text-foreground">公司</TableHead>
                      <TableHead className="text-foreground">位置</TableHead>
                      <TableHead className="text-foreground">电话</TableHead>
                      <TableHead className="text-foreground">验证状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id} className="hover:bg-secondary/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">{result.fullName || result.firstName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{result.title || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{result.company || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {result.city ? `${result.city}, ` : ""}{result.state || "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-400" />
                            <span className="font-mono text-foreground">{result.phoneNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                            <span className="text-green-400 text-sm">已验证</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 无结果提示 */}
        {task.status === "completed" && (!results || results.length === 0) && (
          <Card className="border-border bg-card">
            <CardContent className="py-12">
              <div className="text-center">
                <XCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground">未找到验证通过的结果</h3>
                <p className="text-muted-foreground mt-2">
                  搜索已完成，但没有找到通过验证的电话号码
                </p>
                <Link href="/search">
                  <Button className="mt-4">尝试新的搜索</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 错误提示 */}
        {task.status === "failed" && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-8">
              <div className="text-center">
                <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
                <h3 className="text-lg font-semibold text-foreground">搜索失败</h3>
                <p className="text-muted-foreground mt-2">
                  {task.errorMessage || "搜索过程中发生错误"}
                </p>
                <Link href="/search">
                  <Button className="mt-4">重新搜索</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
