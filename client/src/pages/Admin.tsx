import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Users, Coins, Search, Settings, Plus, Minus, 
  RefreshCw, Shield, TrendingUp, Phone, DollarSign
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 检查是否是管理员
  const { data: profile } = trpc.user.profile.useQuery(undefined, { enabled: !!user });
  
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery(
    undefined,
    { enabled: !!user && profile?.role === "admin" }
  );

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.users.useQuery(
    undefined,
    { enabled: !!user && profile?.role === "admin" }
  );

  const adjustCreditsMutation = trpc.admin.adjustCredits.useMutation({
    onSuccess: () => {
      toast.success("积分调整成功");
      refetchUsers();
      setDialogOpen(false);
      setCreditAmount(0);
    },
    onError: (error) => {
      toast.error(error.message || "调整失败");
    },
  });

  // 非管理员重定向
  if (profile && profile.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <Shield className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold text-foreground">无权访问</h2>
            <p className="text-muted-foreground mt-2">您没有管理员权限</p>
            <Button className="mt-4" onClick={() => setLocation("/dashboard")}>
              返回仪表盘
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleAdjustCredits = (add: boolean) => {
    if (!selectedUser || creditAmount <= 0) return;
    adjustCreditsMutation.mutate({
      userId: selectedUser,
      amount: add ? creditAmount : -creditAmount,
      reason: add ? "管理员手动增加" : "管理员手动扣除",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              管理员后台
            </h1>
            <p className="text-muted-foreground mt-1">
              管理用户、查看统计数据
            </p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总搜索次数
              </CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-foreground">
                  {stats?.totalSearches || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总搜索次数
              </CardTitle>
              <Search className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-foreground">
                  {stats?.totalSearches || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                验证通过
              </CardTitle>
              <Phone className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-foreground">
                  {stats?.totalPhonesFetched || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总积分消耗
              </CardTitle>
              <DollarSign className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-foreground">
                  {stats?.totalCreditsUsed || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 用户管理 */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">用户管理</CardTitle>
              <CardDescription>管理所有注册用户</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchUsers()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : users && users.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-foreground">ID</TableHead>
                      <TableHead className="text-foreground">邮箱</TableHead>
                      <TableHead className="text-foreground">姓名</TableHead>
                      <TableHead className="text-foreground">积分</TableHead>
                      <TableHead className="text-foreground">角色</TableHead>
                      <TableHead className="text-foreground">注册时间</TableHead>
                      <TableHead className="text-foreground">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-secondary/30">
                        <TableCell className="font-mono text-muted-foreground">
                          {u.id}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.name || "-"}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">
                            {u.credits?.toLocaleString() || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          {u.role === "admin" ? (
                            <Badge className="bg-primary/20 text-primary">管理员</Badge>
                          ) : (
                            <Badge variant="secondary">用户</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Dialog open={dialogOpen && selectedUser === u.id} onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (open) setSelectedUser(u.id);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Coins className="h-4 w-4 mr-1" />
                                调整积分
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card border-border">
                              <DialogHeader>
                                <DialogTitle className="text-card-foreground">
                                  调整积分
                                </DialogTitle>
                                <DialogDescription>
                                  为用户 {u.email} 调整积分
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>当前积分</Label>
                                  <p className="text-2xl font-bold text-primary">
                                    {u.credits?.toLocaleString() || 0}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label>调整数量</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                                    className="bg-input border-border"
                                  />
                                </div>
                              </div>
                              <DialogFooter className="gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => handleAdjustCredits(false)}
                                  disabled={adjustCreditsMutation.isPending || creditAmount <= 0}
                                >
                                  <Minus className="h-4 w-4 mr-1" />
                                  扣除
                                </Button>
                                <Button
                                  onClick={() => handleAdjustCredits(true)}
                                  disabled={adjustCreditsMutation.isPending || creditAmount <= 0}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  增加
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                暂无用户数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
