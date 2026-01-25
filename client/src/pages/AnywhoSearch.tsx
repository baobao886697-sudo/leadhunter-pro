/**
 * Anywho 搜索页面
 * 布局参照 TPS，独立模块方便后期管理
 */

import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { 
  Search, 
  Users, 
  MapPin, 
  Filter, 
  Loader2, 
  Info,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Heart,
  Star,
  Building,
  Phone,
  Mail,
  Home,
  Shield,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnywhoSearch() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  
  // 搜索模式
  const [mode, setMode] = useState<"nameOnly" | "nameLocation">("nameOnly");
  
  // 输入
  const [namesInput, setNamesInput] = useState("");
  const [locationsInput, setLocationsInput] = useState("");
  
  // 过滤条件
  const [filters, setFilters] = useState({
    minAge: 18,
    maxAge: 99,
    includeMarriageStatus: true,  // Anywho 特色：婚姻状况
    includePropertyInfo: true,    // 房产信息
    includeFamilyMembers: true,   // 家庭成员
    includeEmployment: true,      // 就业历史
  });
  
  // 高级选项
  const [showFilters, setShowFilters] = useState(false);
  
  // 获取用户资料
  const { data: profile, isLoading: profileLoading } = trpc.user.profile.useQuery(undefined, {
    enabled: !!user,
  });
  
  // 获取 Anywho 配置
  const { data: anywhoConfig } = trpc.anywho.getConfig.useQuery(undefined, {
    retry: false,
    onError: () => {
      // 配置不存在时静默处理
    }
  });
  
  // 计算预估消耗
  const names = namesInput.trim().split("\n").filter(n => n.trim());
  const locations = locationsInput.trim().split("\n").filter(l => l.trim());
  
  // Anywho 费率
  const searchCost = anywhoConfig?.searchCost || 0.5;
  const detailCost = anywhoConfig?.detailCost || 0.5;
  
  // 预估消耗计算
  const estimatedSearches = mode === "nameOnly" 
    ? names.length 
    : names.length * Math.max(locations.length, 1);
  const maxPages = 10;  // Anywho 最大页数
  const avgDetailsPerSearch = 30;  // 预估每个搜索平均详情数
  const estimatedSearchPageCost = estimatedSearches * maxPages * searchCost;
  const estimatedDetailPageCost = estimatedSearches * avgDetailsPerSearch * detailCost;
  const estimatedCost = estimatedSearchPageCost + estimatedDetailPageCost;
  
  // 提交搜索
  const searchMutation = trpc.anywho.search.useMutation({
    onSuccess: (data) => {
      toast.success("搜索任务已提交", {
        description: `任务ID: ${data.taskId.slice(0, 8)}...`,
      });
      setLocation(`/anywho/task/${data.taskId}`);
    },
    onError: (error: any) => {
      toast.error("搜索失败", {
        description: error.message,
      });
    },
  });
  
  const handleSearch = () => {
    if (names.length === 0) {
      toast.error("请输入至少一个姓名");
      return;
    }
    
    if (mode === "nameLocation" && locations.length === 0) {
      toast.error("姓名+地点模式需要输入地点");
      return;
    }
    
    const userCredits = profile?.credits || 0;
    if (userCredits < estimatedCost) {
      toast.error("积分不足", {
        description: `需要约 ${estimatedCost.toFixed(1)} 积分，当前余额 ${userCredits} 积分`,
      });
      return;
    }
    
    searchMutation.mutate({
      names,
      locations: mode === "nameLocation" ? locations : undefined,
      mode,
      filters,
    });
  };

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 - 七彩鎏金效果 */}
        <style>{`
          @keyframes rainbow-title {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .rainbow-title {
            background: linear-gradient(
              90deg,
              #ffd700, #ffb347, #ff6b6b, #ff69b4, #9b59b6, #3498db, #2ecc71, #ffd700
            );
            background-size: 200% auto;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: rainbow-title 3s linear infinite;
          }
        `}</style>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              <span className="rainbow-title">Anywho 搜索</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20 text-yellow-300 border border-yellow-500/30">
                AT&T 官方数据
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              搜索美国公开数据，获取联系人详细信息，包括<span className="text-pink-400 font-medium">婚姻状况</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/anywho/history")}>
            <Clock className="h-4 w-4 mr-2" />
            搜索历史
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：搜索表单 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 搜索模式选择 */}
            <Card className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border-amber-700/50">
              <CardHeader>
                <CardTitle className="text-lg">搜索模式</CardTitle>
                <CardDescription>选择搜索方式</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={mode} onValueChange={(v) => setMode(v as "nameOnly" | "nameLocation")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="nameOnly" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      仅姓名搜索
                    </TabsTrigger>
                    <TabsTrigger value="nameLocation" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      姓名 + 地点
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="nameOnly" className="mt-4 space-y-4">
                    <div>
                      <Label htmlFor="names">姓名列表（每行一个）</Label>
                      <Textarea
                        id="names"
                        placeholder="John Smith&#10;Jane Doe&#10;Robert Johnson"
                        value={namesInput}
                        onChange={(e) => setNamesInput(e.target.value)}
                        className="mt-2 min-h-[200px] font-mono bg-slate-800/50"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        已输入 {names.length} 个姓名
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="nameLocation" className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="names2">姓名列表（每行一个）</Label>
                        <Textarea
                          id="names2"
                          placeholder="John Smith&#10;Jane Doe"
                          value={namesInput}
                          onChange={(e) => setNamesInput(e.target.value)}
                          className="mt-2 min-h-[150px] font-mono bg-slate-800/50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          已输入 {names.length} 个姓名
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="locations">地点列表（每行一个）</Label>
                        <Textarea
                          id="locations"
                          placeholder="New York, NY&#10;Los Angeles, CA&#10;Chicago, IL"
                          value={locationsInput}
                          onChange={(e) => setLocationsInput(e.target.value)}
                          className="mt-2 min-h-[150px] font-mono bg-slate-800/50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          已输入 {locations.length} 个地点
                        </p>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-sm text-amber-400 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        将搜索 {names.length} × {locations.length} = {names.length * locations.length} 个组合
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* 高级选项 */}
            <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      高级选项
                    </CardTitle>
                    <CardDescription>数据筛选和过滤条件</CardDescription>
                  </div>
                  <Switch
                    checked={showFilters}
                    onCheckedChange={setShowFilters}
                  />
                </div>
              </CardHeader>
              {showFilters && (
                <CardContent className="space-y-6">
                  {/* 年龄范围 */}
                  <div>
                    <Label>年龄范围: {filters.minAge} - {filters.maxAge} 岁</Label>
                    <div className="flex gap-4 mt-2">
                      <Slider
                        value={[filters.minAge, filters.maxAge]}
                        onValueChange={([min, max]) => setFilters(f => ({ ...f, minAge: min, maxAge: max }))}
                        min={18}
                        max={99}
                        step={1}
                      />
                    </div>
                  </div>
                  
                  {/* Anywho 特色选项 */}
                  <div className="border-t border-slate-700 pt-4">
                    <p className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Anywho 特色数据
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20">
                        <div className="flex items-center gap-3">
                          <Heart className="h-5 w-5 text-pink-400" />
                          <div>
                            <Label className="text-pink-300">婚姻状况查询</Label>
                            <p className="text-xs text-muted-foreground">获取目标人员的婚姻状态信息</p>
                          </div>
                        </div>
                        <Switch
                          checked={filters.includeMarriageStatus}
                          onCheckedChange={(v) => setFilters(f => ({ ...f, includeMarriageStatus: v }))}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Home className="h-5 w-5 text-amber-400" />
                          <div>
                            <Label>房产信息</Label>
                            <p className="text-xs text-muted-foreground">获取房产所有权和价值信息</p>
                          </div>
                        </div>
                        <Switch
                          checked={filters.includePropertyInfo}
                          onCheckedChange={(v) => setFilters(f => ({ ...f, includePropertyInfo: v }))}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-blue-400" />
                          <div>
                            <Label>家庭成员</Label>
                            <p className="text-xs text-muted-foreground">获取家庭成员和亲属关系</p>
                          </div>
                        </div>
                        <Switch
                          checked={filters.includeFamilyMembers}
                          onCheckedChange={(v) => setFilters(f => ({ ...f, includeFamilyMembers: v }))}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building className="h-5 w-5 text-green-400" />
                          <div>
                            <Label>就业历史</Label>
                            <p className="text-xs text-muted-foreground">获取工作经历和职业背景</p>
                          </div>
                        </div>
                        <Switch
                          checked={filters.includeEmployment}
                          onCheckedChange={(v) => setFilters(f => ({ ...f, includeEmployment: v }))}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* 右侧：费用预估和提交 */}
          <div className="space-y-6">
            {/* 积分余额 */}
            <Card className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                  积分余额
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-400">
                  {profileLoading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    profile?.credits?.toLocaleString() || 0
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">可用积分</p>
              </CardContent>
            </Card>

            {/* 费用预估 */}
            <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  费用预估
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">搜索任务数</span>
                  <span>{estimatedSearches} 个</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">最大搜索页数</span>
                  <span>每任务 {maxPages} 页</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">预估详情数</span>
                  <span>每任务 ~{avgDetailsPerSearch} 条</span>
                </div>
                
                <div className="border-t border-slate-700 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">搜索页费用</span>
                    <span className="text-amber-400">
                      {estimatedSearches} × {maxPages} × {searchCost} = {estimatedSearchPageCost.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">详情页费用</span>
                    <span className="text-amber-400">
                      {estimatedSearches} × {avgDetailsPerSearch} × {detailCost} = {estimatedDetailPageCost.toFixed(1)}
                    </span>
                  </div>
                </div>
                
                <div className="border-t border-slate-700 pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium">预估总消耗</span>
                    <span className="text-xl font-bold text-purple-400">
                      ~{estimatedCost.toFixed(1)} 积分
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    实际费用取决于搜索结果数量，可能低于预估
                  </p>
                </div>
                
                {profile && estimatedCost > (profile.credits || 0) && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      积分不足，请先充值
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 提交按钮 */}
            <Button
              onClick={handleSearch}
              disabled={searchMutation.isPending || names.length === 0}
              className="w-full h-12 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
            >
              {searchMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  开始搜索
                </>
              )}
            </Button>

            {/* Anywho 数据优势 */}
            <Card className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 border-pink-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-500" />
                  Anywho 独家优势
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                    <Heart className="h-4 w-4 text-pink-400" />
                  </div>
                  <div>
                    <p className="font-medium text-pink-300">婚姻状况查询</p>
                    <p className="text-xs text-muted-foreground">独家提供婚姻状态信息</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-300">AT&T 官方数据</p>
                    <p className="text-xs text-muted-foreground">120亿条记录，30年行业经验</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-purple-300">95%+ 准确率</p>
                    <p className="text-xs text-muted-foreground">多源数据交叉验证</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 快速入门 */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  快速入门
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold">1</div>
                  <p className="text-sm">选择搜索模式（仅姓名 / 姓名+地点）</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold">2</div>
                  <p className="text-sm">输入姓名列表，每行一个姓名</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold">3</div>
                  <p className="text-sm">点击"开始搜索"，等待结果</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold">4</div>
                  <p className="text-sm">导出 CSV 文档，包含婚姻状况等信息</p>
                </div>
              </CardContent>
            </Card>

            {/* 费用说明 */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-yellow-500" />
                  费用说明
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 每页搜索消耗 {searchCost} 积分</li>
                  <li>• 每条详情消耗 {detailCost} 积分</li>
                  <li>• 缓存命中的数据免费使用</li>
                  <li>• 搜索结果缓存 180 天</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
