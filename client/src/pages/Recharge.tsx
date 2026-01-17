import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Coins, Copy, Clock, CheckCircle, XCircle, Loader2, QrCode } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const PRESET_AMOUNTS = [100, 500, 1000, 5000];

export default function Recharge() {
  const { user } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialAmount = params.get("amount");
  
  const [credits, setCredits] = useState(initialAmount ? Number(initialAmount) : 100);
  const [activeOrder, setActiveOrder] = useState<string | null>(null);

  const { data: profile } = trpc.user.profile.useQuery(undefined, { enabled: !!user });
  
  const { data: orders, isLoading: ordersLoading } = trpc.recharge.history.useQuery(
    { limit: 10 },
    { enabled: !!user }
  );

  const createOrderMutation = trpc.recharge.create.useMutation({
    onSuccess: (data) => {
      toast.success("充值订单已创建");
      setActiveOrder(data.orderId);
    },
    onError: (error) => {
      toast.error(error.message || "创建订单失败");
    },
  });

  const { data: orderDetail, refetch: refetchOrder } = trpc.recharge.status.useQuery(
    { orderId: activeOrder! },
    { 
      enabled: !!activeOrder,
      refetchInterval: 5000
    }
  );

  const usdtAmount = credits / 100;

  const handleCreateOrder = () => {
    if (credits < 100) {
      toast.error("最低充值100积分");
      return;
    }
    createOrderMutation.mutate({ credits, network: "TRC20" });
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("地址已复制");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500/20 text-green-400">已确认</Badge>;
      case "expired":
        return <Badge variant="destructive">已过期</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400">待支付</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">积分充值</h1>
          <p className="text-muted-foreground mt-1">
            使用USDT充值积分，1 USDT = 100 积分
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 充值表单 */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                充值积分
              </CardTitle>
              <CardDescription>
                当前余额：{profile?.credits?.toLocaleString() || 0} 积分
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 预设金额 */}
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant={credits === amount ? "default" : "outline"}
                    onClick={() => setCredits(amount)}
                    className="w-full"
                  >
                    {amount}
                  </Button>
                ))}
              </div>

              {/* 自定义金额 */}
              <div className="space-y-2">
                <Label className="text-card-foreground">自定义积分数量</Label>
                <Input
                  type="number"
                  min={100}
                  step={100}
                  value={credits}
                  onChange={(e) => setCredits(Math.max(100, Number(e.target.value)))}
                  className="bg-input border-border text-foreground"
                />
              </div>

              {/* 费用计算 */}
              <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">积分数量</span>
                  <span className="text-foreground font-medium">{credits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">兑换比例</span>
                  <span className="text-foreground">1 USDT = 100 积分</span>
                </div>
                <div className="border-t border-border my-2" />
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">应付金额</span>
                  <span className="text-xl font-bold text-primary">{usdtAmount} USDT</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCreateOrder}
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    创建订单中...
                  </>
                ) : (
                  "创建充值订单"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 支付信息 */}
          {activeOrder && orderDetail && (
            <Card className="border-primary/30 bg-card">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  支付信息
                </CardTitle>
                <CardDescription>
                  订单号：{orderDetail.id} · {getStatusBadge(orderDetail.status)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderDetail.status === "pending" ? (
                  <>
                    <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
                      <div>
                        <Label className="text-muted-foreground text-xs">网络</Label>
                        <p className="text-foreground font-medium">{orderDetail.usdtNetwork}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">收款地址</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-sm bg-input p-2 rounded text-foreground break-all">
                            {orderDetail.walletAddress}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyAddress(orderDetail.walletAddress)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">支付金额</Label>
                        <p className="text-2xl font-bold text-primary">
                          {Number(orderDetail.usdtAmount)} USDT
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        订单将在 {new Date(orderDetail.expiresAt).toLocaleString()} 过期
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm text-yellow-400">
                        请在过期前完成转账，系统将自动检测到账并充值积分
                      </p>
                    </div>
                  </>
                ) : orderDetail.status === "confirmed" ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">充值成功</h3>
                    <p className="text-muted-foreground mt-2">
                      {orderDetail.credits} 积分已到账
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">订单已过期</h3>
                    <p className="text-muted-foreground mt-2">
                      请创建新的充值订单
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 充值记录 */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">充值记录</CardTitle>
            <CardDescription>最近的充值订单</CardDescription>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        order.status === "confirmed" ? "bg-green-500/20" :
                        order.status === "expired" ? "bg-destructive/20" :
                        "bg-yellow-500/20"
                      }`}>
                        {order.status === "confirmed" ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : order.status === "expired" ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {order.credits} 积分
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {Number(order.usdtAmount)} USDT · {order.usdtNetwork}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(order.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                暂无充值记录
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
