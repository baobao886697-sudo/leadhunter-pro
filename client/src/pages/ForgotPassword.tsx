import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Loader2, Mail, ArrowLeft, CheckCircle, Shield
} from "lucide-react";
import { ParticleNetwork } from "@/components/ParticleNetwork";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("重置链接已发送");
    },
    onError: (error) => {
      toast.error(error.message || "请求失败，请稍后重试");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("请输入邮箱地址");
      return;
    }
    requestResetMutation.mutate({ email });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden flex items-center justify-center">
      {/* 背景效果 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <ParticleNetwork />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* 返回按钮 */}
        <Link href="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </Link>

        {/* 主卡片 */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl p-8">
          {!submitted ? (
            <>
              {/* 标题 */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">忘记密码</h1>
                <p className="text-slate-400">输入您的注册邮箱，我们将发送重置链接</p>
              </div>

              {/* 表单 */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">邮箱地址</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={requestResetMutation.isPending}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 py-6 text-lg"
                >
                  {requestResetMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      发送中...
                    </>
                  ) : (
                    "发送重置链接"
                  )}
                </Button>
              </form>
            </>
          ) : (
            /* 成功状态 */
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">邮件已发送</h2>
              <p className="text-slate-400 mb-6">
                如果该邮箱已注册，您将收到一封包含重置链接的邮件。
                <br />
                请检查您的收件箱（包括垃圾邮件文件夹）。
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  重新发送
                </Button>
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                >
                  返回登录
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 底部链接 */}
        <div className="text-center mt-6 text-slate-400">
          还没有账户？{" "}
          <Link href="/register" className="text-cyan-400 hover:text-cyan-300 transition-colors">
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
}
