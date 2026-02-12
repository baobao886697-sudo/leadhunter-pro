import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Search, Coins, History, TrendingUp, Users, Phone, Clock, ArrowRight, Zap, Database, Shield, Sparkles, Linkedin, UserSearch, SearchCheck, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ParticleNetwork } from "@/components/ParticleNetwork";

// 搜索引擎来源配置
const SOURCE_CONFIG: Record<string, { label: string; color: string; path: string; icon: string }> = {
  linkedin: { label: "LinkedIn", color: "text-blue-400", path: "/results", icon: "🔗" },
  tps: { label: "TPS", color: "text-teal-400", path: "/tps/task", icon: "🔍" },
  spf: { label: "SPF", color: "text-purple-400", path: "/spf/task", icon: "👤" },
  anywho: { label: "Anywho", color: "text-amber-400", path: "/anywho/task", icon: "📞" },
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.user.profile.useQuery(undefined, {
    enabled: !!user,
  });
  
  // 获取充值配置（积分价格等）
  const { data: rechargeConfig } = trpc.recharge.config.useQuery();
  // 积分兑换比例（默认 1 USDT = 100 积分）
  const creditsPerUsdt = rechargeConfig?.creditsPerUsdt || 100;

  // 全平台聚合统计（TPS + SPF + Anywho + LinkedIn）
  const { data: dashboardStats, isLoading: statsLoading } = trpc.user.dashboardStats.useQuery(undefined, {
    enabled: !!user,
  });

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
      <div className="p-6 space-y-8 relative">
        {/* 动态粒子网络背景 */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <ParticleNetwork 
            particleCount={35}
            connectionDistance={120}
            speed={0.15}
            particleColor="rgba(6, 182, 212, 0.5)"
            lineColor="rgba(6, 182, 212, 0.08)"
          />
        </div>
        
        {/* 渐变光晕装饰 */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px]" />
        </div>

        {/* 欢迎区域 */}
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-cyan-400 font-medium">账户活跃</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                <Shield className="w-3 h-3 text-green-400" />
                <span className="text-xs text-slate-400">数据安全加密</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Welcome, {profile?.name || profile?.email?.split("@")[0] || "User"}!
            </h1>
            <p className="text-slate-400">
              全球人脉搜索平台 · 整合多源美国人口与商业数据
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/tps">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25 border-0 rounded-xl px-8">
                <Search className="h-5 w-5" />
                开始搜索
              </Button>
            </Link>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* 积分余额 */}
          <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">积分余额</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                <Coins className="h-5 w-5 text-yellow-400" />
              </div>
            </div>
            {profileLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <div className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {profile?.credits?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-slate-500">
                  1 USDT = {creditsPerUsdt} 积分
                </p>
              </>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500/50 via-orange-500/50 to-transparent rounded-b-2xl" />
          </div>

          {/* 搜索任务 - 全平台统计 */}
          <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">搜索任务</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            {statsLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <div className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {dashboardStats?.totalTasks?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-slate-500">
                  全平台搜索任务总数
                </p>
              </>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/50 via-indigo-500/50 to-transparent rounded-b-2xl" />
          </div>

          {/* 获取结果 - 全平台统计 */}
          <div className="group relative p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">获取结果</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <Phone className="h-5 w-5 text-green-400" />
              </div>
            </div>
            {statsLoading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <div className="text-4xl font-bold text-white mb-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {dashboardStats?.totalResults?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-slate-500">
                  已获取的联系人数量
                </p>
              </>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500/50 via-emerald-500/50 to-transparent rounded-b-2xl" />
          </div>
        </div>

        {/* 平台覆盖 & 快速入口 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* 平台覆盖 - 更新为实际可用数据源 */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-cyan-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">数据源覆盖</h3>
                <p className="text-xs text-slate-500">Data Sources</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/tps">
                <div className="p-3 rounded-xl bg-slate-800/50 border border-teal-500/20 hover:border-teal-500/40 cursor-pointer transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🔍</span>
                    <span className="text-xs font-medium text-teal-400">TruePeopleSearch</span>
                  </div>
                  <p className="text-xs text-slate-500">美国人口搜索</p>
                  <p className="text-xs text-teal-400/70 mt-1">3亿+ 记录</p>
                </div>
              </Link>
              <Link href="/spf/search">
                <div className="p-3 rounded-xl bg-slate-800/50 border border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">👤</span>
                    <span className="text-xs font-medium text-purple-400">SearchPeopleFree</span>
                  </div>
                  <p className="text-xs text-slate-500">深度人口数据</p>
                  <p className="text-xs text-purple-400/70 mt-1">2亿+ 记录</p>
                </div>
              </Link>
              <Link href="/anywho">
                <div className="p-3 rounded-xl bg-slate-800/50 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📞</span>
                    <span className="text-xs font-medium text-amber-400">Anywho</span>
                  </div>
                  <p className="text-xs text-slate-500">AT&T 官方数据</p>
                  <p className="text-xs text-amber-400/70 mt-1">1.5亿+ 记录</p>
                </div>
              </Link>
              <Link href="/search">
                <div className="p-3 rounded-xl bg-slate-800/50 border border-blue-500/20 hover:border-blue-500/40 cursor-pointer transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🔗</span>
                    <span className="text-xs font-medium text-blue-400">LinkedIn</span>
                  </div>
                  <p className="text-xs text-slate-500">商业精英数据</p>
                  <p className="text-xs text-blue-400/70 mt-1">维护中</p>
                </div>
              </Link>
            </div>
          </div>

          {/* 快速入口 */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-green-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">快速入口</h3>
                <p className="text-xs text-slate-500">Quick Actions</p>
              </div>
            </div>
            <div className="space-y-2">
              <Link href="/tps">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer group transition-colors">
                  <Search className="h-4 w-4 text-slate-500 group-hover:text-green-400" />
                  <span className="text-sm text-slate-400 group-hover:text-white">新建搜索任务</span>
                </div>
              </Link>
              <Link href="/history">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer group transition-colors">
                  <History className="h-4 w-4 text-slate-500 group-hover:text-green-400" />
                  <span className="text-sm text-slate-400 group-hover:text-white">查看历史记录</span>
                </div>
              </Link>
              <Link href="/recharge">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer group transition-colors">
                  <Coins className="h-4 w-4 text-slate-500 group-hover:text-green-400" />
                  <span className="text-sm text-slate-400 group-hover:text-white">充值积分</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
          {/* 快速充值 - 统一使用 USDT 金额 */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">快速充值</h3>
                <p className="text-sm text-slate-400">使用 USDT-TRC20 充值</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { usdt: 50, credits: 50 * creditsPerUsdt },
                { usdt: 100, credits: 100 * creditsPerUsdt },
                { usdt: 200, credits: 200 * creditsPerUsdt },
              ].map((item) => (
                <Link key={item.usdt} href={`/recharge?amount=${item.credits}`}>
                  <Button 
                    variant="outline" 
                    className="w-full h-14 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 rounded-xl flex flex-col items-center justify-center gap-0"
                  >
                    <span className="font-semibold text-base" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.usdt} USDT</span>
                    <span className="text-[10px] text-slate-500">{item.credits.toLocaleString()} 积分</span>
                  </Button>
                </Link>
              ))}
            </div>
            <Link href="/recharge">
              <Button variant="ghost" className="w-full gap-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10">
                自定义金额
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* 最近任务 - 全平台任务 */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <History className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">最近任务</h3>
                  <p className="text-sm text-slate-400">全平台搜索任务</p>
                </div>
              </div>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10">
                  查看全部
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            {statsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : dashboardStats?.recentTasks && dashboardStats.recentTasks.length > 0 ? (
              <div className="space-y-3">
                {dashboardStats.recentTasks.slice(0, 5).map((task: any) => {
                  const config = SOURCE_CONFIG[task.source] || SOURCE_CONFIG.tps;
                  const taskUrl = task.source === 'linkedin' 
                    ? `/results/${task.taskId}` 
                    : `${config.path}/${task.taskId}`;
                  return (
                    <Link key={`${task.source}-${task.taskId}`} href={taskUrl}>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-purple-500/30 transition-all cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            task.status === "completed" ? "bg-green-500 shadow-lg shadow-green-500/50" :
                            task.status === "failed" ? "bg-red-500 shadow-lg shadow-red-500/50" :
                            "bg-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50"
                          }`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                task.source === 'tps' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' :
                                task.source === 'spf' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                                task.source === 'anywho' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              }`}>
                                {config.label}
                              </span>
                              <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                                {task.displayName}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500">
                              {task.displayDetail} · {task.resultCount || 0} 个结果
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                  <History className="h-8 w-8 text-slate-600" />
                </div>
                <p className="text-slate-500 mb-4">暂无搜索记录</p>
                <Link href="/tps">
                  <Button variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                    开始第一次搜索
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* 使用指南 */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">使用指南</h3>
              <p className="text-sm text-slate-400">快速了解如何使用 DataReach Pro</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: 1, title: "充值积分", desc: "使用 USDT 购买积分", color: "cyan" },
              { step: 2, title: "选择搜索引擎", desc: "TPS / SPF / Anywho", color: "blue" },
              { step: 3, title: "输入姓名搜索", desc: "系统自动获取联系方式", color: "purple" },
              { step: 4, title: "导出结果", desc: "下载 CSV 文件", color: "green" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-${item.color}-500/20 to-${item.color}-600/20 flex items-center justify-center shrink-0`}>
                  <span className={`text-${item.color}-400 font-bold`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {item.step}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
