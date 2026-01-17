import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Search, Coins, History, TrendingUp, Users, Phone, Clock, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.user.profile.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: tasks, isLoading: tasksLoading } = trpc.search.tasks.useQuery(
    { limit: 5 },
    { enabled: !!user }
  );

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 欢迎区域 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              欢迎回来，{profile?.name || profile?.email?.split("@")[0] || "用户"}
            </h1>
            <p className="text-muted-foreground mt-1">
              开始搜索LinkedIn专业人士的联系方式
            </p>
          </div>
          <Link href="/search">
            <Button size="lg" className="gap-2">
              <Search className="h-5 w-5" />
              开始搜索
            </Button>
          </Link>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 积分余额 */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                积分余额
              </CardTitle>
              <Coins className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">
                    {profile?.credits?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    1 USDT = 100 积分
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 今日搜索 */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                搜索任务
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">
                    {tasks?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    最近7天的任务
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 获取的号码 */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                验证通过
              </CardTitle>
              <Phone className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">
                    {tasks?.reduce((sum, t) => sum + (t.phonesVerified || 0), 0) || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    已验证的电话号码
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 快速充值 */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg text-card-foreground">快速充值</CardTitle>
              <CardDescription>使用USDT充值积分</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[100, 500, 1000].map((amount) => (
                  <Link key={amount} href={`/recharge?amount=${amount}`}>
                    <Button variant="outline" className="w-full">
                      {amount} 积分
                    </Button>
                  </Link>
                ))}
              </div>
              <Link href="/recharge">
                <Button variant="ghost" className="w-full gap-2">
                  自定义金额
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 最近任务 */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-card-foreground">最近任务</CardTitle>
                <CardDescription>您最近的搜索任务</CardDescription>
              </div>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="gap-1">
                  查看全部
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : tasks && tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.slice(0, 3).map((task) => (
                    <Link key={task.id} href={`/results/${task.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            task.status === "completed" ? "bg-green-500" :
                            task.status === "failed" ? "bg-red-500" :
                            "bg-yellow-500 animate-pulse"
                          }`} />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {task.searchName} - {task.searchTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {task.searchState} · {task.phonesVerified || 0} 个结果
                            </p>
                          </div>
                        </div>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>暂无搜索任务</p>
                  <Link href="/search">
                    <Button variant="link" className="mt-2">
                      开始第一次搜索
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
