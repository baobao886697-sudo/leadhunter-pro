import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  User, Coins, Search, RefreshCw, Key, Ban, UserCheck,
  Clock, Mail, Calendar, Activity, CreditCard, History,
  AlertTriangle, CheckCircle, XCircle, Send, Eye
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UserDetailDialogProps {
  userId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function UserDetailDialog({ userId, open, onOpenChange, onRefresh }: UserDetailDialogProps) {
  console.log("UserDetailDialog render: userId=", userId, "open=", open);
  const [activeTab, setActiveTab] = useState("info");
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");

  // 获取用户详情
  const { data: userDetail, isLoading, refetch } = trpc.admin.getUserDetail.useQuery(
    { userId: userId! },
    { enabled: !!userId && open }
  );

  // 获取用户搜索历史
  const { data: searchHistory, isLoading: searchLoading } = trpc.admin.getUserSearchHistory.useQuery(
    { userId: userId!, limit: 10 },
    { enabled: !!userId && open && activeTab === "searches" }
  );

  // 获取用户积分记录
  const { data: creditHistory, isLoading: creditLoading } = trpc.admin.getUserCreditHistory.useQuery(
    { userId: userId!, limit: 20 },
    { enabled: !!userId && open && activeTab === "credits" }
  );

  // 获取用户登录记录
  const { data: loginHistory, isLoading: loginLoading } = trpc.admin.getUserLoginHistory.useQuery(
    { userId: userId!, limit: 20 },
    { enabled: !!userId && open && activeTab === "logins" }
  );

  // 获取用户活动日志
  const { data: activityLogs, isLoading: activityLoading } = trpc.admin.getUserActivityLogs.useQuery(
    { userId: userId!, limit: 30 },
    { enabled: !!userId && open && activeTab === "activity" }
  );

  // Mutations
  const adjustCreditsMutation = trpc.admin.adjustCredits.useMutation({
    onSuccess: () => {
      toast.success("积分调整成功");
      setCreditAmount(0);
      setCreditReason("");
      refetch();
      onRefresh?.();
    },
    onError: (error) => {
      toast.error(error.message || "积分调整失败");
    },
  });

  const resetPasswordMutation = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => {
      toast.success("密码重置成功");
      setNewPassword("");
    },
    onError: (error) => {
      toast.error(error.message || "密码重置失败");
    },
  });

  const updateStatusMutation = trpc.admin.updateUserStatus.useMutation({
    onSuccess: () => {
      toast.success("状态更新成功");
      refetch();
      onRefresh?.();
    },
    onError: (error) => {
      toast.error(error.message || "状态更新失败");
    },
  });

  const forceLogoutMutation = trpc.admin.forceLogout.useMutation({
    onSuccess: () => {
      toast.success("已强制用户下线");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "操作失败");
    },
  });

  const sendMessageMutation = trpc.admin.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("消息发送成功");
      setMessageTitle("");
      setMessageContent("");
    },
    onError: (error) => {
      toast.error(error.message || "发送失败");
    },
  });

  const handleAdjustCredits = () => {
    if (!userId || creditAmount === 0) return;
    adjustCreditsMutation.mutate({
      userId,
      amount: creditAmount,
      reason: creditReason || (creditAmount > 0 ? "管理员增加积分" : "管理员扣除积分"),
    });
  };

  const handleResetPassword = () => {
    if (!userId || !newPassword || newPassword.length < 6) {
      toast.error("密码至少6位");
      return;
    }
    resetPasswordMutation.mutate({ userId, newPassword });
  };

  const handleSendMessage = () => {
    if (!userId || !messageTitle || !messageContent) {
      toast.error("请填写标题和内容");
      return;
    }
    sendMessageMutation.mutate({
      userId,
      title: messageTitle,
      content: messageContent,
      type: "support",
    });
  };

  const user = userDetail?.user;
  const stats = userDetail?.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <User className="h-5 w-5 text-orange-400" />
            用户详情
          </DialogTitle>
          <DialogDescription>
            查看和管理用户信息
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : user ? (
          <div className="space-y-4">
            {/* 用户基本信息卡片 */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-white">{user.email}</span>
                      <Badge className={user.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                        {user.status === "active" ? "正常" : "已禁用"}
                      </Badge>
                      {user.role === "admin" && (
                        <Badge className="bg-purple-500/20 text-purple-400">管理员</Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 space-y-1">
                      <p>ID: {user.id} | OpenID: {user.openId?.slice(0, 8)}...</p>
                      <p>注册时间: {new Date(user.createdAt).toLocaleString()}</p>
                      <p>最后登录: {new Date(user.lastSignedIn).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-orange-400">{user.credits}</div>
                    <div className="text-sm text-slate-400">当前积分</div>
                  </div>
                </div>

                {/* 统计信息 */}
                {stats && (
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700">
                    <div className="text-center">
                      <div className="text-xl font-semibold text-white">{stats.totalOrders}</div>
                      <div className="text-xs text-slate-400">充值次数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold text-green-400">${stats.totalSpent}</div>
                      <div className="text-xs text-slate-400">累计充值</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold text-blue-400">{stats.totalSearches}</div>
                      <div className="text-xs text-slate-400">搜索次数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold text-purple-400">{stats.loginCount}</div>
                      <div className="text-xs text-slate-400">登录次数</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 操作Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-800 border-slate-700">
                <TabsTrigger value="info">操作</TabsTrigger>
                <TabsTrigger value="credits">积分记录</TabsTrigger>
                <TabsTrigger value="searches">搜索历史</TabsTrigger>
                <TabsTrigger value="logins">登录记录</TabsTrigger>
                <TabsTrigger value="activity">活动日志</TabsTrigger>
              </TabsList>

              {/* 操作Tab */}
              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 积分调整 */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Coins className="h-4 w-4 text-orange-400" />
                        积分调整
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-slate-400">调整数量</Label>
                        <Input
                          type="number"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                          placeholder="正数增加，负数扣除"
                          className="bg-slate-900 border-slate-600"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400">调整原因</Label>
                        <Input
                          value={creditReason}
                          onChange={(e) => setCreditReason(e.target.value)}
                          placeholder="请填写原因"
                          className="bg-slate-900 border-slate-600"
                        />
                      </div>
                      <Button
                        onClick={handleAdjustCredits}
                        disabled={creditAmount === 0 || adjustCreditsMutation.isPending}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                      >
                        {adjustCreditsMutation.isPending ? "处理中..." : "确认调整"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 密码重置 */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Key className="h-4 w-4 text-blue-400" />
                        密码重置
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-slate-400">新密码</Label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="至少6位"
                          className="bg-slate-900 border-slate-600"
                        />
                      </div>
                      <Button
                        onClick={handleResetPassword}
                        disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}
                        className="w-full bg-blue-500 hover:bg-blue-600"
                      >
                        {resetPasswordMutation.isPending ? "处理中..." : "重置密码"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 发送消息 */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Send className="h-4 w-4 text-green-400" />
                        发送消息
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-slate-400">标题</Label>
                        <Input
                          value={messageTitle}
                          onChange={(e) => setMessageTitle(e.target.value)}
                          placeholder="消息标题"
                          className="bg-slate-900 border-slate-600"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400">内容</Label>
                        <Textarea
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="消息内容"
                          className="bg-slate-900 border-slate-600"
                          rows={2}
                        />
                      </div>
                      <Button
                        onClick={handleSendMessage}
                        disabled={!messageTitle || !messageContent || sendMessageMutation.isPending}
                        className="w-full bg-green-500 hover:bg-green-600"
                      >
                        {sendMessageMutation.isPending ? "发送中..." : "发送消息"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 账户操作 */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4 text-purple-400" />
                        账户操作
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        onClick={() => updateStatusMutation.mutate({
                          userId: user.id,
                          status: user.status === "active" ? "disabled" : "active"
                        })}
                        disabled={updateStatusMutation.isPending}
                        variant="outline"
                        className={`w-full ${user.status === "active" ? "border-red-500 text-red-400 hover:bg-red-500/10" : "border-green-500 text-green-400 hover:bg-green-500/10"}`}
                      >
                        {user.status === "active" ? (
                          <><Ban className="h-4 w-4 mr-2" />禁用账户</>
                        ) : (
                          <><UserCheck className="h-4 w-4 mr-2" />启用账户</>
                        )}
                      </Button>
                      <Button
                        onClick={() => forceLogoutMutation.mutate({ userId: user.id })}
                        disabled={forceLogoutMutation.isPending}
                        variant="outline"
                        className="w-full border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        强制下线
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* 积分记录Tab */}
              <TabsContent value="credits">
                {creditLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 bg-slate-800/50">
                          <TableHead className="text-slate-400">时间</TableHead>
                          <TableHead className="text-slate-400">类型</TableHead>
                          <TableHead className="text-slate-400">变动</TableHead>
                          <TableHead className="text-slate-400">余额</TableHead>
                          <TableHead className="text-slate-400">说明</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditHistory?.logs.map((log: any) => (
                          <TableRow key={log.id} className="border-slate-700">
                            <TableCell className="text-slate-300 text-sm">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.type}
                              </Badge>
                            </TableCell>
                            <TableCell className={log.amount > 0 ? "text-green-400" : "text-red-400"}>
                              {log.amount > 0 ? "+" : ""}{log.amount}
                            </TableCell>
                            <TableCell className="text-slate-300">{log.balanceAfter}</TableCell>
                            <TableCell className="text-slate-400 text-sm max-w-[200px] truncate">
                              {log.description}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!creditHistory?.logs || creditHistory.logs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                              暂无积分记录
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* 搜索历史Tab */}
              <TabsContent value="searches">
                {searchLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 bg-slate-800/50">
                          <TableHead className="text-slate-400">时间</TableHead>
                          <TableHead className="text-slate-400">任务ID</TableHead>
                          <TableHead className="text-slate-400">请求数量</TableHead>
                          <TableHead className="text-slate-400">实际数量</TableHead>
                          <TableHead className="text-slate-400">消耗积分</TableHead>
                          <TableHead className="text-slate-400">状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchHistory?.searches.map((search: any) => (
                          <TableRow key={search.id} className="border-slate-700">
                            <TableCell className="text-slate-300 text-sm">
                              {new Date(search.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-slate-400 font-mono text-xs">
                              {search.taskId?.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="text-slate-300">{search.requestedCount}</TableCell>
                            <TableCell className="text-slate-300">{search.actualCount}</TableCell>
                            <TableCell className="text-orange-400">{search.creditsUsed}</TableCell>
                            <TableCell>
                              <Badge className={
                                search.status === "completed" ? "bg-green-500/20 text-green-400" :
                                search.status === "failed" ? "bg-red-500/20 text-red-400" :
                                "bg-yellow-500/20 text-yellow-400"
                              }>
                                {search.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!searchHistory?.searches || searchHistory.searches.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                              暂无搜索记录
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* 登录记录Tab */}
              <TabsContent value="logins">
                {loginLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 bg-slate-800/50">
                          <TableHead className="text-slate-400">时间</TableHead>
                          <TableHead className="text-slate-400">IP地址</TableHead>
                          <TableHead className="text-slate-400">设备ID</TableHead>
                          <TableHead className="text-slate-400">状态</TableHead>
                          <TableHead className="text-slate-400">失败原因</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loginHistory?.logs.map((log: any) => (
                          <TableRow key={log.id} className="border-slate-700">
                            <TableCell className="text-slate-300 text-sm">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-slate-400 font-mono text-xs">
                              {log.ipAddress || "-"}
                            </TableCell>
                            <TableCell className="text-slate-400 font-mono text-xs">
                              {log.deviceId?.slice(0, 8) || "-"}...
                            </TableCell>
                            <TableCell>
                              {log.success ? (
                                <Badge className="bg-green-500/20 text-green-400">成功</Badge>
                              ) : (
                                <Badge className="bg-red-500/20 text-red-400">失败</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {log.failReason || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!loginHistory?.logs || loginHistory.logs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                              暂无登录记录
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* 活动日志Tab */}
              <TabsContent value="activity">
                {activityLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 bg-slate-800/50">
                          <TableHead className="text-slate-400">时间</TableHead>
                          <TableHead className="text-slate-400">操作</TableHead>
                          <TableHead className="text-slate-400">IP地址</TableHead>
                          <TableHead className="text-slate-400">详情</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityLogs?.logs.map((log: any) => (
                          <TableRow key={log.id} className="border-slate-700">
                            <TableCell className="text-slate-300 text-sm">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.action}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 font-mono text-xs">
                              {log.ipAddress || "-"}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm max-w-[200px] truncate">
                              {log.details ? JSON.stringify(log.details) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!activityLogs?.logs || activityLogs.logs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                              暂无活动日志
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-8">
            用户不存在
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
