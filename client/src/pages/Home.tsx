import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  Target, Search, Phone, Shield, Zap, CheckCircle, ArrowRight, Sparkles, 
  Database, Globe, TrendingUp, Users, Building2, Linkedin, Twitter, 
  Facebook, Mail, MapPin, BarChart3, Lock, Clock, Award, Star,
  ChevronRight, Play, Layers, Network, Cpu, Eye
} from "lucide-react";
import { useEffect, useState } from "react";

// 动态计数器组件
function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);
  
  return <span>{count.toLocaleString()}{suffix}</span>;
}

// 数据源卡片
const DATA_SOURCES = [
  { icon: Linkedin, name: "LinkedIn", records: "6.5亿+", color: "from-blue-500 to-blue-600", available: true },
  { icon: Building2, name: "企业工商", records: "2亿+", color: "from-emerald-500 to-green-600", available: true },
  { icon: Twitter, name: "Twitter/X", records: "5亿+", color: "from-slate-600 to-slate-700", available: false },
  { icon: Facebook, name: "Facebook", records: "3亿+", color: "from-blue-600 to-indigo-600", available: false },
];

// 核心功能
const CORE_FEATURES = [
  {
    icon: Search,
    title: "智能精准搜索",
    description: "通过姓名、职位、地区、行业等多维度条件精准定位目标人群，AI智能匹配算法确保找到最相关的决策者。",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    icon: Shield,
    title: "多重数据验证",
    description: "独创的多源交叉验证系统，通过多个权威数据源验证联系方式的真实性，确保数据可达率高达95%+。",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Layers,
    title: "多平台数据整合",
    description: "整合LinkedIn、企业工商、社交媒体等多平台数据，构建完整的商业人脉图谱，一站式获取全方位信息。",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: Zap,
    title: "实时数据更新",
    description: "数据库每日更新，确保您获取的始终是最新、最准确的联系方式，告别过时无效数据。",
    gradient: "from-green-500 to-emerald-500",
  },
];

// 使用场景
const USE_CASES = [
  { icon: TrendingUp, title: "销售拓客", desc: "精准触达目标客户决策层" },
  { icon: Users, title: "人才招聘", desc: "快速定位行业精英人才" },
  { icon: Building2, title: "商务合作", desc: "发现潜在合作伙伴" },
  { icon: BarChart3, title: "市场调研", desc: "深度了解目标市场" },
];

// 客户评价
const TESTIMONIALS = [
  { name: "张总", role: "某科技公司 CEO", content: "数据准确率非常高，大大提升了我们的销售效率。", rating: 5 },
  { name: "李经理", role: "某投资机构 VP", content: "一手数据资源，帮助我们快速建立行业人脉网络。", rating: 5 },
  { name: "王总监", role: "某猎头公司 总监", content: "多平台数据整合非常实用，节省了大量时间。", rating: 5 },
];

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSource, setActiveSource] = useState(0);

  // 已登录用户自动跳转到仪表盘（保持原有逻辑）
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  // 数据源轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSource((prev) => (prev + 1) % DATA_SOURCES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
      {/* 高级背景效果 */}
      <div className="fixed inset-0 pointer-events-none">
        {/* 星空点阵 */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
        {/* 网格线 */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px)`,
          backgroundSize: '100px 100px'
        }} />
        {/* 动态光晕 */}
        <div className="absolute -top-[400px] -right-[400px] w-[800px] h-[800px] bg-cyan-500/20 rounded-full blur-[200px] animate-pulse" />
        <div className="absolute -bottom-[400px] -left-[400px] w-[800px] h-[800px] bg-purple-500/15 rounded-full blur-[200px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-blue-500/10 rounded-full blur-[250px]" />
        {/* 扫描线效果 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-[200%] animate-scan" style={{
          animation: 'scan 8s linear infinite'
        }} />
      </div>

      {/* 顶部导航栏 */}
      <nav className="relative z-50 border-b border-cyan-500/10 bg-[#0a0f1a]/80 backdrop-blur-2xl sticky top-0">
        <div className="container mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Network className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0a0f1a] animate-pulse" />
            </div>
            <div>
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
                DataReach
              </span>
              <div className="flex items-center gap-2 -mt-1">
                <span className="text-[10px] text-cyan-400/80 font-medium tracking-widest">GLOBAL DATA PLATFORM</span>
                <span className="px-1.5 py-0.5 text-[9px] bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 rounded border border-cyan-500/30">PRO</span>
              </div>
            </div>
          </div>

          {/* 导航链接 */}
          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-slate-400 hover:text-cyan-400 transition-colors text-sm font-medium">产品功能</a>
            <a href="#sources" className="text-slate-400 hover:text-cyan-400 transition-colors text-sm font-medium">数据源</a>
            <a href="#pricing" className="text-slate-400 hover:text-cyan-400 transition-colors text-sm font-medium">定价方案</a>
            <a href="#cases" className="text-slate-400 hover:text-cyan-400 transition-colors text-sm font-medium">使用场景</a>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-cyan-400 hover:bg-cyan-500/10 hidden sm:flex">
                登录
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 text-white shadow-lg shadow-cyan-500/25 border-0 px-6">
                免费开始
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* 顶部标签 */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">实时在线</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <span className="text-cyan-400 text-sm">全球领先的商业数据平台</span>
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </div>
            </div>
            
            {/* 主标题 */}
            <h1 className="text-center text-5xl lg:text-7xl xl:text-8xl font-bold leading-[1.1] mb-8">
              <span className="text-white">全球人脉资源</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                一键触达
              </span>
            </h1>
            
            {/* 副标题 */}
            <p className="text-center text-xl lg:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              整合全球
              <span className="text-cyan-400 font-semibold"> 10亿+ </span>
              商业联系人数据，覆盖
              <span className="text-purple-400 font-semibold"> 195+ </span>
              国家和地区
              <br className="hidden lg:block" />
              <span className="text-slate-500">一手数据资源 · 多重验证系统 · 实时更新</span>
            </p>
            
            {/* CTA按钮 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/register">
                <Button size="lg" className="gap-3 text-lg px-10 py-7 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 text-white shadow-2xl shadow-cyan-500/30 border-0 rounded-2xl group">
                  <Zap className="h-5 w-5 group-hover:animate-pulse" />
                  立即开始免费试用
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-3 text-lg px-10 py-7 border-slate-700 text-slate-300 hover:bg-slate-800/50 hover:border-cyan-500/50 hover:text-cyan-400 rounded-2xl">
                <Play className="h-5 w-5" />
                观看演示视频
              </Button>
            </div>

            {/* 核心数据展示 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-5xl mx-auto">
              {[
                { value: 1000000000, suffix: "+", label: "全球数据记录", icon: Database, color: "cyan" },
                { value: 195, suffix: "+", label: "覆盖国家地区", icon: Globe, color: "purple" },
                { value: 95, suffix: "%+", label: "数据验证准确率", icon: Shield, color: "green" },
                { value: 24, suffix: "/7", label: "全天候实时服务", icon: Clock, color: "blue" },
              ].map((stat, index) => (
                <div 
                  key={index} 
                  className="relative group p-6 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-all duration-500 backdrop-blur-sm overflow-hidden"
                >
                  {/* 悬停光效 */}
                  <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  <div className="relative z-10">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${stat.color}-500/20 to-${stat.color}-600/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                    </div>
                    <div className="text-3xl lg:text-4xl font-bold text-white mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-sm text-slate-500">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 信任背书 */}
            <div className="mt-16 text-center">
              <p className="text-slate-600 text-sm mb-6">已服务超过 10,000+ 企业客户</p>
              <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
                {['企业A', '企业B', '企业C', '企业D', '企业E'].map((company, i) => (
                  <div key={i} className="text-slate-500 font-semibold text-lg">{company}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 数据源展示 */}
      <section id="sources" className="relative py-24 border-t border-cyan-500/10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400">多平台数据整合</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              一手数据，<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">多源整合</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              我们直接对接全球主流商业平台，确保数据的一手性和准确性
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-5xl mx-auto">
            {DATA_SOURCES.map((source, index) => (
              <div 
                key={index}
                className={`relative p-6 rounded-2xl border transition-all duration-500 ${
                  source.available 
                    ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 hover:border-cyan-500/50 cursor-pointer' 
                    : 'bg-slate-900/50 border-slate-800 opacity-60'
                }`}
              >
                {!source.available && (
                  <div className="absolute top-3 right-3 px-2 py-1 text-[10px] bg-slate-700 text-slate-400 rounded">即将上线</div>
                )}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${source.color} flex items-center justify-center mb-4 ${source.available ? 'shadow-lg' : ''}`}>
                  <source.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{source.name}</h3>
                <p className="text-2xl font-bold text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {source.records}
                </p>
                <p className="text-sm text-slate-500 mt-1">数据记录</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 核心功能 */}
      <section id="features" className="relative py-24 border-t border-cyan-500/10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400">核心能力</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              为什么选择 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">DataReach</span>？
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              采用先进的数据挖掘和验证技术，为您提供最精准的商业联系人信息
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {CORE_FEATURES.map((feature, index) => (
              <div 
                key={index}
                className="group relative p-8 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-all duration-500 overflow-hidden"
              >
                {/* 背景光效 */}
                <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity duration-500`} />
                
                <div className="relative z-10 flex gap-6">
                  <div className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使用场景 */}
      <section id="cases" className="relative py-24 border-t border-cyan-500/10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              适用于<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">多种场景</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {USE_CASES.map((item, index) => (
              <div key={index} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-green-500/30 transition-all duration-300 text-center group">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <item.icon className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 定价方案 */}
      <section id="pricing" className="relative py-24 border-t border-cyan-500/10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <Award className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">透明定价</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              简单透明的<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">定价方案</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              按需付费，无月费，无隐藏费用
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="relative p-10 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
              {/* 推荐标签 */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full text-sm font-semibold text-white shadow-lg">
                ✨ 推荐方案
              </div>

              <div className="text-center mb-10 pt-4">
                <p className="text-slate-400 mb-4">USDT-TRC20 充值</p>
                <div className="flex items-baseline justify-center gap-3">
                  <span className="text-6xl font-bold text-white">1</span>
                  <span className="text-2xl text-cyan-400 font-semibold">USDT</span>
                  <span className="text-3xl text-slate-600">=</span>
                  <span className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">100</span>
                  <span className="text-2xl text-slate-400">积分</span>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                {[
                  { text: "搜索预览", price: "1 积分/次", highlight: false },
                  { text: "获取联系方式", price: "2 积分/条", highlight: false },
                  { text: "多重数据验证", price: "免费", highlight: true },
                  { text: "CSV/Excel 导出", price: "免费", highlight: true },
                  { text: "数据保留期限", price: "180天", highlight: true },
                  { text: "API 接口访问", price: "免费", highlight: true },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <CheckCircle className={`h-5 w-5 ${item.highlight ? 'text-green-400' : 'text-cyan-400'}`} />
                      <span className="text-slate-300">{item.text}</span>
                    </div>
                    <span className={`font-semibold ${item.highlight ? 'text-green-400' : 'text-white'}`}>{item.price}</span>
                  </div>
                ))}
              </div>

              <Link href="/register">
                <Button className="w-full py-7 text-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 text-white shadow-xl shadow-cyan-500/25 border-0 rounded-2xl font-semibold">
                  立即开始免费试用
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>

              <p className="text-center text-slate-500 text-sm mt-4">
                <Lock className="inline w-4 h-4 mr-1" />
                安全支付 · 即时到账
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 客户评价 */}
      <section className="relative py-24 border-t border-cyan-500/10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              客户<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">真实评价</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map((item, index) => (
              <div key={index} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                <div className="flex gap-1 mb-4">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-6 leading-relaxed">"{item.content}"</p>
                <div>
                  <p className="text-white font-semibold">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 border-t border-cyan-500/10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto text-center p-12 lg:p-16 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 relative overflow-hidden">
            {/* 背景装饰 */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-cyan-500/30">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                准备好触达全球人脉了吗？
              </h2>
              <p className="text-slate-400 mb-10 max-w-xl mx-auto text-lg">
                立即注册，开始使用全球领先的商业数据平台，获取一手精准的潜在客户联系方式。
              </p>
              <Link href="/register">
                <Button size="lg" className="gap-3 text-lg px-12 py-7 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 text-white shadow-2xl shadow-cyan-500/30 border-0 rounded-2xl">
                  免费开始使用
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 border-t border-cyan-500/10 bg-slate-950/50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center">
                <Network className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-lg">DataReach</span>
                <span className="text-cyan-400/60 text-xs block">Global Data Platform</span>
              </div>
            </div>

            {/* 链接 */}
            <div className="flex items-center gap-8 text-sm text-slate-500">
              <a href="#" className="hover:text-cyan-400 transition-colors">关于我们</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">隐私政策</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">服务条款</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">联系我们</a>
            </div>

            {/* 版权 */}
            <p className="text-sm text-slate-600">
              © 2024 DataReach Pro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* 全局样式 */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
}
