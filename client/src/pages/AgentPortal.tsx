import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { 
  Crown, 
  LayoutDashboard, 
  Users, 
  Wallet, 
  TrendingUp, 
  Copy, 
  LogOut,
  DollarSign,
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Link as LinkIcon,
  QrCode,
  Download
} from "lucide-react";

interface AgentInfo {
  id: number;
  name: string;
  email: string;
  level: "normal" | "silver" | "gold" | "founder";
  inviteCode: string;
  balance: string;
  frozenBalance: string;
  totalEarned: string;
  walletAddress?: string;
}

const levelNames: Record<string, string> = {
  founder: "创始代理",
  gold: "金牌代理",
  silver: "银牌代理",
  normal: "普通代理",
};

const levelColors: Record<string, string> = {
  founder: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  gold: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  silver: "bg-slate-300/20 text-slate-300 border-slate-300/30",
  normal: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function AgentPortal() {
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);

  // 检查登录状态
  useEffect(() => {
    const token = localStorage.getItem("agent_token");
    const info = localStorage.getItem("agent_info");
    if (!token || !info) {
      setLocation("/agent-portal/login");
      return;
    }
    try {
      setAgentInfo(JSON.parse(info));
    } catch {
      setLocation("/agent-portal/login");
    }
  }, [setLocation]);

  // 获取代理数据
  const { data: dashboardData, refetch: refetchDashboard } = trpc.agent.getDashboard.useQuery(
    undefined,
    { enabled: !!agentInfo }
  );

  const { data: teamData, refetch: refetchTeam } = trpc.agent.getTeam.useQuery(
    undefined,
    { enabled: !!agentInfo && activeTab === "team" }
  );

  const { data: commissionsData, refetch: refetchCommissions } = trpc.agent.getCommissions.useQuery(
    undefined,
    { enabled: !!agentInfo && activeTab === "commissions" }
  );

  const { data: withdrawalsData, refetch: refetchWithdrawals } = trpc.agent.getWithdrawals.useQuery(
    undefined,
    { enabled: !!agentInfo && activeTab === "withdraw" }
  );

  const handleLogout = () => {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_info");
    setLocation("/agent-portal/login");
  };

  const copyInviteLink = () => {
    if (!agentInfo) return;
    const link = `${window.location.origin}/?ref=${agentInfo.inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success("邀请链接已复制到剪贴板");
  };

  if (!agentInfo) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-500" />
            <div>
              <h1 className="text-lg font-bold text-white">代理商后台</h1>
              <p className="text-xs text-slate-400">DataReach Agent Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-white">{agentInfo.name}</p>
              <Badge className={levelColors[agentInfo.level]}>
                {levelNames[agentInfo.level]}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700 mb-6">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-yellow-500/20">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              仪表盘
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-yellow-500/20">
              <Users className="w-4 h-4 mr-2" />
              团队
            </TabsTrigger>
            <TabsTrigger value="commissions" className="data-[state=active]:bg-yellow-500/20">
              <TrendingUp className="w-4 h-4 mr-2" />
              佣金
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="data-[state=active]:bg-yellow-500/20">
              <Wallet className="w-4 h-4 mr-2" />
              提现
            </TabsTrigger>
            <TabsTrigger value="promote" className="data-[state=active]:bg-yellow-500/20">
              <LinkIcon className="w-4 h-4 mr-2" />
              推广
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-yellow-500/20">
              <Crown className="w-4 h-4 mr-2" />
              设置
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">可提现余额</p>
                      <p className="text-2xl font-bold text-green-500">
                        ${parseFloat(dashboardData?.balance || agentInfo.balance || '0').toFixed(2)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">冻结中佣金</p>
                      <p className="text-2xl font-bold text-yellow-500">
                        ${parseFloat(dashboardData?.frozenBalance || agentInfo.frozenBalance || '0').toFixed(2)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-yellow-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">累计收益</p>
                      <p className="text-2xl font-bold text-blue-500">
                        ${parseFloat(dashboardData?.totalEarned || agentInfo.totalEarned || '0').toFixed(2)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">团队人数</p>
                      <p className="text-2xl font-bold text-purple-500">
                        {dashboardData?.teamCount || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">今日数据</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">新增用户</span>
                    <span className="text-white font-semibold flex items-center gap-1">
                      <UserPlus className="w-4 h-4 text-green-500" />
                      {dashboardData?.todayNewUsers || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">团队充值</span>
                    <span className="text-white font-semibold">
                      ${parseFloat(dashboardData?.todayRecharge || "0").toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400">今日佣金</span>
                    <span className="text-green-500 font-semibold">
                      +${parseFloat(dashboardData?.todayCommission || "0").toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">本月数据</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">新增用户</span>
                    <span className="text-white font-semibold flex items-center gap-1">
                      <UserPlus className="w-4 h-4 text-green-500" />
                      {dashboardData?.monthNewUsers || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">团队充值</span>
                    <span className="text-white font-semibold">
                      ${parseFloat(dashboardData?.monthRecharge || "0").toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400">本月佣金</span>
                    <span className="text-green-500 font-semibold">
                      +${parseFloat(dashboardData?.monthCommission || "0").toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg">最近佣金</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetchDashboard()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {dashboardData?.recentCommissions && dashboardData.recentCommissions.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.recentCommissions.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            item.level === 1 ? "bg-green-500/20" : "bg-blue-500/20"
                          }`}>
                            {item.level === 1 ? (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-white">
                              {item.level === 1 ? "一级佣金" : "二级佣金"}
                            </p>
                            <p className="text-xs text-slate-400">
                              来自 {item.fromUser} 的充值
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-500 font-semibold">+${item.amount}</p>
                          <p className="text-xs text-slate-400">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">暂无佣金记录</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Level 1 Users */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs text-green-500">1</span>
                    </div>
                    直推用户
                  </CardTitle>
                  <CardDescription>
                    您直接邀请的用户 ({teamData?.level1Users?.length || 0} 人)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamData?.level1Users && teamData.level1Users.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {teamData.level1Users.map((user: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg">
                          <div>
                            <p className="text-sm text-white">{user.displayName || user.email}</p>
                            <p className="text-xs text-slate-400">注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-green-500">充值 ${parseFloat(user.totalRecharge || '0').toFixed(2)}</p>
                            <p className="text-xs text-slate-400">佣金 ${parseFloat(user.commission || '0').toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-400 py-8">暂无直推用户</p>
                  )}
                </CardContent>
              </Card>

              {/* Level 2 Users */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-xs text-blue-500">2</span>
                    </div>
                    间推用户
                  </CardTitle>
                  <CardDescription>
                    您的直推用户邀请的用户 ({teamData?.level2Users?.length || 0} 人)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamData?.level2Users && teamData.level2Users.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {teamData.level2Users.map((user: any, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg">
                          <div>
                            <p className="text-sm text-white">{user.displayName || user.email}</p>
                            <p className="text-xs text-slate-400">
                              来自 {user.inviterEmail}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-blue-500">充值 ${parseFloat(user.totalRecharge || '0').toFixed(2)}</p>
                            <p className="text-xs text-slate-400">佣金 ${parseFloat(user.commission || '0').toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-400 py-8">暂无间推用户</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">佣金明细</CardTitle>
                  <CardDescription>查看所有佣金记录</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => refetchCommissions()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {commissionsData?.commissions && commissionsData.commissions.length > 0 ? (
                  <div className="space-y-3">
                    {commissionsData.commissions.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            item.level === 1 ? "bg-green-500/20" : "bg-blue-500/20"
                          }`}>
                            <span className={`text-sm font-bold ${
                              item.level === 1 ? "text-green-500" : "text-blue-500"
                            }`}>
                              L{item.level}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-white">
                              {item.level === 1 ? "一级佣金" : "二级佣金"} - {item.fromUser}
                            </p>
                            <p className="text-xs text-slate-400">
                              订单金额 ${parseFloat(item.orderAmount).toFixed(2)} × {item.rate}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-500 font-semibold">+${parseFloat(item.amount).toFixed(2)}</p>
                          <Badge className={
                            item.status === "available" 
                              ? "bg-green-500/20 text-green-500" 
                              : item.status === "frozen"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-slate-500/20 text-slate-400"
                          }>
                            {item.status === "available" ? "已结算" : item.status === "frozen" ? "冻结中" : "已提现"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">暂无佣金记录</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw" className="space-y-6">
            <WithdrawSection 
              agentInfo={agentInfo} 
              withdrawalsData={withdrawalsData}
              refetchWithdrawals={refetchWithdrawals}
              dashboardData={dashboardData}
              refetchDashboard={refetchDashboard}
            />
          </TabsContent>

          {/* Promote Tab */}
          <TabsContent value="promote" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">您的邀请链接</CardTitle>
                  <CardDescription>分享此链接邀请新用户注册</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/?ref=${agentInfo.inviteCode}`}
                      readOnly
                      className="bg-slate-900/50 border-slate-600 font-mono text-sm"
                    />
                    <Button onClick={copyInviteLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-lg">
                    <p className="text-sm text-slate-400 mb-2">您的邀请码</p>
                    <p className="text-2xl font-bold text-yellow-500 font-mono">
                      {agentInfo.inviteCode}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">佣金规则</CardTitle>
                  <CardDescription>您当前的佣金比例</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                          <span className="text-xs text-green-500">1</span>
                        </div>
                        <span className="text-white">一级佣金</span>
                      </div>
                      <span className="text-green-500 font-bold text-lg">
                        {agentInfo.level === "founder" ? "15%" : 
                         agentInfo.level === "gold" ? "12%" :
                         agentInfo.level === "silver" ? "10%" : "8%"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <span className="text-xs text-blue-500">2</span>
                        </div>
                        <span className="text-white">二级佣金</span>
                      </div>
                      <span className="text-blue-500 font-bold text-lg">
                        {agentInfo.level === "founder" ? "5%" : 
                         agentInfo.level === "gold" ? "4%" :
                         agentInfo.level === "silver" ? "3%" : "2%"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <p className="text-sm text-yellow-500">
                      佣金将在用户充值后 7 天自动解冻，届时可申请提现
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* 账户信息 */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">账户信息</CardTitle>
                  <CardDescription>您的代理账户基本信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">代理ID</span>
                    <span className="text-white font-mono">{agentInfo.id}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">邮箱</span>
                    <span className="text-white">{agentInfo.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">代理等级</span>
                    <Badge className={levelColors[agentInfo.level]}>
                      {levelNames[agentInfo.level]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">邀请码</span>
                    <code className="text-yellow-500 bg-slate-900 px-2 py-1 rounded font-mono">
                      {agentInfo.inviteCode}
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-400">收款地址</span>
                    <span className="text-white text-sm font-mono truncate max-w-[200px]">
                      {dashboardData?.walletAddress || agentInfo.walletAddress || '未设置'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* 修改钱包地址 */}
              <WalletAddressCard 
                agentInfo={agentInfo} 
                dashboardData={dashboardData}
                refetchDashboard={refetchDashboard}
              />

              {/* 佣金比例说明 */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">佣金比例说明</CardTitle>
                  <CardDescription>各等级代理的佣金比例</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 text-slate-400">等级</th>
                          <th className="text-center py-2 text-slate-400">一级佣金</th>
                          <th className="text-center py-2 text-slate-400">二级佣金</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className={`border-b border-slate-700 ${agentInfo.level === 'founder' ? 'bg-yellow-500/10' : ''}`}>
                          <td className="py-2 text-amber-400">👑 创始代理</td>
                          <td className="py-2 text-center text-green-500 font-bold">15%</td>
                          <td className="py-2 text-center text-blue-500 font-bold">5%</td>
                        </tr>
                        <tr className={`border-b border-slate-700 ${agentInfo.level === 'gold' ? 'bg-yellow-500/10' : ''}`}>
                          <td className="py-2 text-yellow-400">🥇 金牌代理</td>
                          <td className="py-2 text-center text-green-500">12%</td>
                          <td className="py-2 text-center text-blue-500">4%</td>
                        </tr>
                        <tr className={`border-b border-slate-700 ${agentInfo.level === 'silver' ? 'bg-yellow-500/10' : ''}`}>
                          <td className="py-2 text-slate-400">🥈 银牌代理</td>
                          <td className="py-2 text-center text-green-500">10%</td>
                          <td className="py-2 text-center text-blue-500">3%</td>
                        </tr>
                        <tr className={`${agentInfo.level === 'normal' ? 'bg-yellow-500/10' : ''}`}>
                          <td className="py-2 text-cyan-400">⭐ 普通代理</td>
                          <td className="py-2 text-center text-green-500">8%</td>
                          <td className="py-2 text-center text-blue-500">2%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                    <p className="text-xs text-slate-400">
                      您当前等级：<span className="text-yellow-500 font-bold">{levelNames[agentInfo.level]}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 提现规则 */}
              <Card className="bg-slate-800/50 border-slate-700 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white">提现规则</CardTitle>
                  <CardDescription>佣金结算和提现说明</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        <span className="text-white font-medium">结算周期</span>
                      </div>
                      <p className="text-slate-400 text-sm">佣金在用户充值后 <span className="text-yellow-500 font-bold">7天</span> 自动解冻</p>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-5 h-5 text-green-500" />
                        <span className="text-white font-medium">最低提现</span>
                      </div>
                      <p className="text-slate-400 text-sm">单笔最低提现金额 <span className="text-green-500 font-bold">50 USDT</span></p>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-cyan-500" />
                        <span className="text-white font-medium">结算方式</span>
                      </div>
                      <p className="text-slate-400 text-sm">支持 <span className="text-cyan-500 font-bold">USDT TRC20</span> 网络提现</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Withdraw Section Component
function WithdrawSection({ 
  agentInfo, 
  withdrawalsData,
  refetchWithdrawals,
  dashboardData,
  refetchDashboard
}: { 
  agentInfo: AgentInfo;
  withdrawalsData: any;
  refetchWithdrawals: () => void;
  dashboardData: any;
  refetchDashboard: () => void;
}) {

  const [withdrawAmount, setWithdrawAmount] = useState("");
  // 使用dashboardData中的钱包地址作为默认值
  const [walletAddress, setWalletAddress] = useState(dashboardData?.walletAddress || agentInfo.walletAddress || "");
  
  // 当dashboardData或agentInfo更新时，同步钱包地址
  useEffect(() => {
    if (dashboardData?.walletAddress) {
      setWalletAddress(dashboardData.walletAddress);
    } else if (agentInfo.walletAddress) {
      setWalletAddress(agentInfo.walletAddress);
    }
  }, [dashboardData?.walletAddress, agentInfo.walletAddress]);

  const submitWithdraw = trpc.agent.submitWithdrawal.useMutation({
    onSuccess: () => {
      toast.success("提现申请已提交，请等待管理员审核");
      setWithdrawAmount("");
      refetchWithdrawals();
      refetchDashboard(); // 刷新仪表盘数据以更新余额
    },
    onError: (error) => {
      toast.error(error.message || "提现失败");
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 50) {
      toast.error("最低提现金额为 50 USDT");
      return;
    }
    if (!walletAddress) {
      toast.error("请输入您的 USDT TRC20 钱包地址");
      return;
    }
    submitWithdraw.mutate({ amount, walletAddress });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">申请提现</CardTitle>
          <CardDescription>
            可提现余额: <span className="text-green-500 font-bold">${parseFloat(dashboardData?.balance || agentInfo.balance || '0').toFixed(2)} USDT</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">提现金额 (USDT)</Label>
            <Input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="最低 50 USDT"
              className="bg-slate-900/50 border-slate-600"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white">收款地址 (TRC20)</Label>
            <Input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="T..."
              className="bg-slate-900/50 border-slate-600 font-mono"
            />
          </div>
          <Button 
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
            onClick={handleWithdraw}
            disabled={submitWithdraw.isPending}
          >
            {submitWithdraw.isPending ? "提交中..." : "申请提现"}
          </Button>
          <p className="text-xs text-slate-400 text-center">
            提现将在 1-3 个工作日内处理
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">提现记录</CardTitle>
            <CardDescription>您的历史提现申请</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={refetchWithdrawals}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {withdrawalsData?.withdrawals && withdrawalsData.withdrawals.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {withdrawalsData.withdrawals.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="text-sm text-white">${parseFloat(item.amount).toFixed(2)} USDT</p>
                    <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <Badge className={
                    item.status === "paid" 
                      ? "bg-green-500/20 text-green-500" 
                      : item.status === "pending"
                      ? "bg-yellow-500/20 text-yellow-500"
                      : item.status === "approved"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-red-500/20 text-red-500"
                  }>
                    {item.status === "paid" ? "已打款" : 
                     item.status === "pending" ? "待审核" :
                     item.status === "approved" ? "已批准" : "已拒绝"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">暂无提现记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// Wallet Address Card Component
function WalletAddressCard({ 
  agentInfo, 
  dashboardData, 
  refetchDashboard 
}: { 
  agentInfo: AgentInfo; 
  dashboardData: any; 
  refetchDashboard: () => void; 
}) {
  // 优先使用dashboardData中的实时地址
  const currentAddress = dashboardData?.walletAddress || agentInfo.walletAddress || "";
  const [newAddress, setNewAddress] = useState(currentAddress);
  const [isEditing, setIsEditing] = useState(false);
  
  // 当dashboardData或agentInfo更新时，同步地址
  useEffect(() => {
    if (dashboardData?.walletAddress) {
      setNewAddress(dashboardData.walletAddress);
    } else if (agentInfo.walletAddress) {
      setNewAddress(agentInfo.walletAddress);
    }
  }, [dashboardData?.walletAddress, agentInfo.walletAddress]);

  const updateWallet = trpc.agent.updateWalletAddress.useMutation({
    onSuccess: () => {
      toast.success("钱包地址已更新");
      setIsEditing(false);
      refetchDashboard(); // 刷新仪表盘数据以更新地址显示
    },
    onError: (error) => {
      toast.error(error.message || "更新失败");
    }
  });

  const handleSave = () => {
    if (!newAddress || !newAddress.startsWith('T')) {
      toast.error("请输入有效的 TRC20 地址");
      return;
    }
    updateWallet.mutate({ walletAddress: newAddress });
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          修改收款地址
        </CardTitle>
        <CardDescription>更新您的 USDT TRC20 收款地址</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label className="text-white">新钱包地址</Label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="T..."
                className="bg-slate-900/50 border-slate-600 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
                onClick={handleSave}
                disabled={updateWallet.isPending}
              >
                {updateWallet.isPending ? "保存中..." : "保存"}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setIsEditing(false);
                  setNewAddress(currentAddress);
                }}
              >
                取消
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">当前地址</p>
              <p className="text-white font-mono text-sm break-all">
                {currentAddress || '未设置'}
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setIsEditing(true)}
            >
              修改地址
            </Button>
          </>
        )}
        <p className="text-xs text-slate-400">
          注意：请确保地址正确，错误的地址可能导致资产丢失
        </p>
      </CardContent>
    </Card>
  );
}
