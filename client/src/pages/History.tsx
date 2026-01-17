import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Search, Clock, CheckCircle, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function History() {
  const { user } = useAuth();
  
  const { data: tasks, isLoading } = trpc.search.tasks.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">已完成</Badge>;
      case "failed":
        return <Badge variant="destructive">失败</Badge>;
      case "processing":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">处理中</Badge>;
      default:
        return <Badge variant="secondary">等待中</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "processing":
        return <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">搜索历史</h1>
            <p className="text-muted-foreground mt-1">
              查看您的搜索任务记录，结果保留7天
            </p>
          </div>
          <Link href="/search">
            <Button className="gap-2">
              <Search className="h-4 w-4" />
              新搜索
            </Button>
          </Link>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">任务列表</CardTitle>
            <CardDescription>
              共 {tasks?.length || 0} 个任务
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : tasks && tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <Link key={task.id} href={`/results/${task.id}`}>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          task.status === "completed" ? "bg-green-500/20" :
                          task.status === "failed" ? "bg-destructive/20" :
                          task.status === "searching" || task.status === "fetching_phones" || task.status === "verifying" ? "bg-yellow-500/20" :
                          "bg-secondary"
                        }`}>
                          {getStatusIcon(task.status)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {task.searchName}
                            </h3>
                            {getStatusBadge(task.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {task.searchTitle} · {task.searchState}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>结果：{task.totalResults || 0} 条</span>
                            <span>验证通过：{task.phonesVerified || 0} 条</span>
                            <span>消耗：{task.creditsUsed || 0} 积分</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {new Date(task.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(task.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">暂无搜索记录</h3>
                <p className="text-muted-foreground mt-2">
                  开始您的第一次搜索
                </p>
                <Link href="/search">
                  <Button className="mt-4">开始搜索</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
