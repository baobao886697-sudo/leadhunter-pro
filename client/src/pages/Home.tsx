import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Target, Search, Phone, Shield, Zap, CheckCircle, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // 已登录用户自动跳转到仪表盘
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen bg-background">
      {/* 导航栏 */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">LeadHunter Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">登录</Button>
            </Link>
            <Link href="/register">
              <Button>免费注册</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
              快速获取
              <span className="text-primary"> LinkedIn专业人士 </span>
              的联系方式
            </h1>
            <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
              通过姓名、职位和地区精准搜索，获取经过验证的电话号码。
              强大的双重验证系统确保数据准确性。
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2 text-lg px-8">
                  <Search className="h-5 w-5" />
                  开始免费试用
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                  已有账户？登录
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              注册即送 100 积分体验
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            为什么选择 LeadHunter Pro？
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl bg-card border border-border">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                精准搜索
              </h3>
              <p className="text-muted-foreground">
                通过姓名、职位和州进行精准搜索，快速找到目标人员的联系方式。
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                双重验证
              </h3>
              <p className="text-muted-foreground">
                通过 TruePeopleSearch 和 FastPeopleSearch 双重验证，确保电话号码准确有效。
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                高效批量
              </h3>
              <p className="text-muted-foreground">
                自动批量处理，每批50条数据，系统自动运行直到完成或积分用尽。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            简单透明的定价
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            按需付费，无月费，无隐藏费用
          </p>
          <div className="max-w-md mx-auto">
            <div className="p-8 rounded-xl bg-card border-2 border-primary">
              <div className="text-center mb-6">
                <p className="text-muted-foreground">积分充值</p>
                <div className="mt-2">
                  <span className="text-4xl font-bold text-foreground">1 USDT</span>
                  <span className="text-muted-foreground"> = 100 积分</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  搜索费用：1 积分/次
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  获取电话：2 积分/条
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  二次验证：免费
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  CSV导出：免费
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  结果保留：7天
                </li>
              </ul>
              <Link href="/register">
                <Button className="w-full" size="lg">
                  立即开始
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            准备好开始了吗？
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            注册账户即可获得 100 积分免费体验，无需信用卡。
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2 text-lg px-8">
              免费注册
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">LeadHunter Pro</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 LeadHunter Pro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
