import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  CreditCard, Copy, ExternalLink, CheckCircle, XCircle,
  Clock, User, Coins, DollarSign, AlertTriangle, RefreshCw,
  Undo2, Search
} from "lucide-react";

interface OrderDetailDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function OrderDetailDialog({ order, open, onOpenChange, onRefresh }: OrderDetailDialogProps) {
  const [txId, setTxId] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [showRefundForm, setShowRefundForm] = useState(false);

  // Mutations
  const confirmMutation = trpc.admin.confirmOrder.useMutation({
    onSuccess: () => {
      toast.success("订单确认成功，积分已发放");
      onOpenChange(false);
      onRefresh?.();
    },
    onError: (error) => {
      toast.error(error.message || "确认失败");
    },
  });

  const cancelMutation = trpc.admin.cancelOrder.useMutation({
    onSuccess: () => {
      toast.success("订单已取消");
      onOpenChange(false);
      onRefresh?.();
    },
    onError: (error) => {
      toast.error(error.message || "取消失败");
    },
  });

  const refundMutation = trpc.admin.refundOrder.useMutation({
    onSuccess: () => {
      toast.success("退款成功，积分已扣除");
      onOpenChange(false);
      onRefresh?.();
    },
    onError: (error) => {
      toast.error(error.message || "退款失败");
    },
  });

  const checkPaymentMutation = trpc.admin.checkPayment.useMutation({
    onSuccess: (data) => {
      if (data.found) {
        toast.success(`找到匹配交易！金额: ${data.amount} USDT`);
        setTxId(data.txId || "");
        setReceivedAmount(data.amount?.toString() || "");
      } else {
        toast.info(data.message || "未找到匹配的交易");
      }
    },
    onError: (error) => {
      toast.error(error.message || "检查失败");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  const handleConfirm = () => {
    if (!txId) {
      toast.error("请输入交易哈希");
      return;
    }
    confirmMutation.mutate({
      orderId: order.orderId,
      txId,
      receivedAmount: receivedAmount || order.amount,
    });
  };

  const handleRefund = () => {
    if (!refundReason) {
      toast.error("请填写退款原因");
      return;
    }
    refundMutation.mutate({
      orderId: order.orderId,
      reason: refundReason,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">已支付</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">待支付</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">已取消</Badge>;
      case "expired":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">已过期</Badge>;
      case "mismatch":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">金额不匹配</Badge>;
      case "refunded":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">已退款</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <CreditCard className="h-5 w-5 text-orange-400" />
            订单详情
          </DialogTitle>
          <DialogDescription>
            查看和管理充值订单
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 订单基本信息 */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 text-xs">订单号</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono">{order.orderId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(order.orderId)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">状态</Label>
                  <div>{getStatusBadge(order.status)}</div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">用户ID</Label>
                  <div className="text-white">{order.userId}</div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">用户邮箱</Label>
                  <div className="text-white">{order.userEmail || "-"}</div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">充值金额</Label>
                  <div className="text-green-400 font-semibold">${order.amount} USDT</div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">积分数量</Label>
                  <div className="text-orange-400 font-semibold">{order.credits} 积分</div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">创建时间</Label>
                  <div className="text-slate-300 text-sm">{new Date(order.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">过期时间</Label>
                  <div className="text-slate-300 text-sm">{new Date(order.expiresAt).toLocaleString()}</div>
                </div>
              </div>

              {/* 收款地址 */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <Label className="text-slate-400 text-xs">收款地址</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white font-mono text-sm">{order.walletAddress}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(order.walletAddress)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* 交易信息（如果已支付） */}
              {order.txId && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <Label className="text-slate-400 text-xs">交易哈希</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white font-mono text-sm">{order.txId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(order.txId)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://tronscan.org/#/transaction/${order.txId}`, "_blank")}
                      className="h-6 w-6 p-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                  {order.receivedAmount && (
                    <div className="mt-2">
                      <Label className="text-slate-400 text-xs">实际收款</Label>
                      <div className="text-green-400">${order.receivedAmount} USDT</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作区域 */}
          {(order.status === "pending" || order.status === "mismatch") && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white">确认支付</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => checkPaymentMutation.mutate({ orderId: order.orderId })}
                    disabled={checkPaymentMutation.isPending}
                    className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {checkPaymentMutation.isPending ? "检查中..." : "自动检测"}
                  </Button>
                </div>

                <div>
                  <Label className="text-slate-400">交易哈希 (TxID)</Label>
                  <Input
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    placeholder="输入交易哈希"
                    className="bg-slate-900 border-slate-600 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-slate-400">实际收款金额（可选）</Label>
                  <Input
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder={`默认: ${order.amount}`}
                    className="bg-slate-900 border-slate-600"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleConfirm}
                    disabled={!txId || confirmMutation.isPending}
                    className="flex-1 bg-green-500 hover:bg-green-600"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {confirmMutation.isPending ? "处理中..." : "确认支付"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => cancelMutation.mutate({ orderId: order.orderId })}
                    disabled={cancelMutation.isPending}
                    className="border-red-500 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    取消订单
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 退款操作（已支付订单） */}
          {order.status === "paid" && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Undo2 className="h-4 w-4 text-purple-400" />
                  退款操作
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!showRefundForm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowRefundForm(true)}
                    className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
                  >
                    发起退款
                  </Button>
                ) : (
                  <>
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-400 text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        退款将扣除用户 {order.credits} 积分
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-400">退款原因</Label>
                      <Textarea
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="请填写退款原因"
                        className="bg-slate-900 border-slate-600"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleRefund}
                        disabled={!refundReason || refundMutation.isPending}
                        className="bg-purple-500 hover:bg-purple-600"
                      >
                        {refundMutation.isPending ? "处理中..." : "确认退款"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRefundForm(false);
                          setRefundReason("");
                        }}
                        className="border-slate-600"
                      >
                        取消
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
