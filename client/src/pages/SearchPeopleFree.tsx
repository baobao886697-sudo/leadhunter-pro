import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Rocket, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Users, 
  Shield, 
  Zap, 
  Clock,
  CheckCircle2,
  Star,
  Gift,
  Bell,
  Globe
} from "lucide-react";
import { useState } from "react";

export default function SearchPeopleFree() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const features = [
    {
      icon: Search,
      title: "免费人员搜索",
      description: "无需付费，即可搜索超过7亿人的公开信息"
    },
    {
      icon: Phone,
      title: "反向电话查询",
      description: "通过电话号码查找机主姓名、地址及其他联系方式"
    },
    {
      icon: Mail,
      title: "邮箱反查服务",
      description: "输入邮箱地址，获取关联的个人或企业信息"
    },
    {
      icon: MapPin,
      title: "地址信息查询",
      description: "了解任意地址的现任和历史住户详细信息"
    },
    {
      icon: Shield,
      title: "背景调查",
      description: "包含犯罪记录、法院记录等公共信息查询"
    },
    {
      icon: Globe,
      title: "全球覆盖",
      description: "支持多国人员信息搜索，不仅限于美国"
    }
  ];

  const highlights = [
    {
      icon: Gift,
      title: "100% 免费",
      description: "核心搜索功能完全免费，无隐藏费用"
    },
    {
      icon: Zap,
      title: "即时结果",
      description: "毫秒级响应，快速获取搜索结果"
    },
    {
      icon: Users,
      title: "7亿+ 数据",
      description: "覆盖全球超过7亿人的公开记录"
    }
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* 顶部横幅 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-500 to-lime-500 p-8 md:p-12 mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
              <Rocket className="w-3 h-3 mr-1" />
              即将上线
            </Badge>
            <Badge className="bg-lime-400/20 text-lime-100 border-lime-400/30">
              <Gift className="w-3 h-3 mr-1" />
              免费服务
            </Badge>
            <Badge className="bg-yellow-400/20 text-yellow-100 border-yellow-400/30">
              <Star className="w-3 h-3 mr-1" />
              热门推荐
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            SearchPeopleFree
          </h1>
          <p className="text-lg text-white/90 max-w-2xl mb-6">
            全球最大的免费人员搜索平台，覆盖超过7亿人的公开信息。
            通过姓名、电话、邮箱或地址，免费获取您需要的联系人信息。
          </p>
          <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>预计上线：2026年Q1</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>已有 2,567 人关注</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-4 h-4" />
              <span>支持全球搜索</span>
            </div>
          </div>
        </div>
      </div>

      {/* 亮点展示 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {highlights.map((item, index) => (
          <Card key={index} className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <item.icon className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold text-green-400 mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 功能介绍 */}
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Search className="w-5 h-5 text-green-400" />
        核心功能
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {features.map((feature, index) => (
          <Card key={index} className="bg-card/50 border-green-500/20 hover:border-green-500/40 transition-all hover:shadow-lg hover:shadow-green-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                  <feature.icon className="w-5 h-5 text-green-400" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-muted-foreground text-sm">
                {feature.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 订阅通知 */}
      <Card className="bg-card/50 border-dashed border-2 border-green-500/30">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">功能开发中</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            我们正在努力开发 SearchPeopleFree 集成功能。作为免费服务，
            上线后您可以无限制地使用核心搜索功能。敬请期待！
          </p>
          <Button 
            onClick={() => setIsSubscribed(true)}
            disabled={isSubscribed}
            className={`${isSubscribed 
              ? 'bg-green-500/20 text-green-400 border-green-500/30' 
              : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400'
            }`}
          >
            {isSubscribed ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                已订阅通知
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                订阅上线通知
              </>
            )}
          </Button>
          {isSubscribed && (
            <p className="text-sm text-green-400 mt-3">
              感谢您的关注！功能上线后我们会通过系统通知告知您。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
