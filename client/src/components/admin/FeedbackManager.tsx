import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  MessageSquare, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  HelpCircle,
  Lightbulb,
  Briefcase,
  Code,
  Send,
  Eye,
  Filter
} from "lucide-react";

// 反馈类型配置
const FEEDBACK_TYPES = {
  question: { label: '问题咨询', icon: HelpCircle, color: 'text-blue-400' },
  suggestion: { label: '功能建议', icon: Lightbulb, color: 'text-yellow-400' },
  business: { label: '商务合作', icon: Briefcase, color: 'text-green-400' },
  custom_dev: { label: '定制开发', icon: Code, color: 'text-purple-400' },
  other: { label: '其他', icon: MessageSquare, color: 'text-gray-400' },
};

// 状态配置
const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  processing: { label: '处理中', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Loader2 },
  resolved: { label: '已解决', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  closed: { label: '已关闭', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: AlertCircle },
};

export function FeedbackManager() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyStatus, setReplyStatus] = useState<string>("resolved");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取反馈列表
  const { data: feedbacksData, isLoading, refetch } = trpc.feedback.list.useQuery({
    page: 1,
    limit: 100,
    status: statusFilter === "all" ? undefined : statusFilter as any,
    type: typeFilter === "all" ? undefined : typeFilter as any,
  });

  // 回复反馈
  const replyMutation = trpc.feedback.reply.useMutation({
    onSuccess: () => {
      toast.success('回复成功');
      setReplyDialogOpen(false);
      setReplyContent("");
      setSelectedFeedback(null);
      refetch();
    },
    onError: (error) => {
      toast.error('回复失败', { description: error.message });
    },
  });

  // 更新状态
  const updateStatusMutation = trpc.feedback.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('状态更新成功');
      refetch();
    },
    onError: (error) => {
      toast.error('更新失败', { description: error.message });
    },
  });

  const handleReply = async () => {
    if (!selectedFeedback || !replyContent.trim()) {
      toast.error('请输入回复内容');
      return;
    }

    setIsSubmitting(true);
    try {
      await replyMutation.mutateAsync({
        feedbackId: selectedFeedback.id,
        reply: replyContent.trim(),
        status: replyStatus as any,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = (feedbackId: number, status: string) => {
    updateStatusMutation.mutate({
      feedbackId,
      status: status as any,
    });
  };

  const feedbacks = feedbacksData?.feedbacks || [];
  const stats = feedbacksData?.stats || { pending: 0, processing: 0, resolved: 0, closed: 0 };

  return (
    <div className="relative space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 text-orange-400" />
            <span className="text-sm text-orange-400">用户反馈</span>
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            反馈管理
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '待处理', value: stats.pending, color: 'yellow', icon: Clock },
          { label: '处理中', value: stats.processing, color: 'blue', icon: Loader2 },
          { label: '已解决', value: stats.resolved, color: 'green', icon: CheckCircle },
          { label: '已关闭', value: stats.closed, color: 'gray', icon: AlertCircle },
        ].map((stat, index) => (
          <Card key={index} className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${
                  stat.color === 'yellow' ? 'text-yellow-400' :
                  stat.color === 'blue' ? 'text-blue-400' :
                  stat.color === 'green' ? 'text-green-400' :
                  'text-gray-400'
                }`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选器 */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">筛选：</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="resolved">已解决</SelectItem>
                <SelectItem value="closed">已关闭</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="question">问题咨询</SelectItem>
                <SelectItem value="suggestion">功能建议</SelectItem>
                <SelectItem value="business">商务合作</SelectItem>
                <SelectItem value="custom_dev">定制开发</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 反馈列表 */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">反馈列表</CardTitle>
          <CardDescription>共 {feedbacksData?.total || 0} 条反馈</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">暂无反馈</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">类型</TableHead>
                  <TableHead className="text-slate-400">用户</TableHead>
                  <TableHead className="text-slate-400">标题</TableHead>
                  <TableHead className="text-slate-400">状态</TableHead>
                  <TableHead className="text-slate-400">时间</TableHead>
                  <TableHead className="text-slate-400 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbacks.map((feedback: any) => {
                  const typeConfig = FEEDBACK_TYPES[feedback.type as keyof typeof FEEDBACK_TYPES] || FEEDBACK_TYPES.other;
                  const statusConfig = STATUS_CONFIG[feedback.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const TypeIcon = typeConfig.icon;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <TableRow key={feedback.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                          <span className="text-slate-300 text-sm">{typeConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">{feedback.userEmail || '-'}</TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-white font-medium truncate">{feedback.title}</p>
                          <p className="text-slate-500 text-xs truncate">{feedback.content}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className={`w-3 h-3 mr-1 ${feedback.status === 'processing' ? 'animate-spin' : ''}`} />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {new Date(feedback.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedFeedback(feedback);
                              setReplyContent(feedback.adminReply || "");
                              setReplyStatus(feedback.status === 'pending' ? 'resolved' : feedback.status);
                              setReplyDialogOpen(true);
                            }}
                            className="text-slate-400 hover:text-white hover:bg-slate-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            查看
                          </Button>
                          {feedback.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusChange(feedback.id, 'processing')}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            >
                              开始处理
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 回复对话框 */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">反馈详情</DialogTitle>
            <DialogDescription>查看反馈内容并回复用户</DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              {/* 反馈信息 */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const typeConfig = FEEDBACK_TYPES[selectedFeedback.type as keyof typeof FEEDBACK_TYPES] || FEEDBACK_TYPES.other;
                    const TypeIcon = typeConfig.icon;
                    return (
                      <>
                        <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                        <span className="text-sm text-slate-400">{typeConfig.label}</span>
                      </>
                    );
                  })()}
                  <span className="text-slate-500">|</span>
                  <span className="text-sm text-slate-400">{selectedFeedback.userEmail}</span>
                </div>
                <h3 className="text-white font-medium mb-2">{selectedFeedback.title}</h3>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{selectedFeedback.content}</p>
                {selectedFeedback.contactInfo && (
                  <p className="text-cyan-400 text-sm mt-2">
                    联系方式：{selectedFeedback.contactInfo}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-2">
                  提交时间：{new Date(selectedFeedback.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>

              {/* 已有回复 */}
              {selectedFeedback.adminReply && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">已回复</span>
                    {selectedFeedback.repliedAt && (
                      <span className="text-xs text-slate-500">
                        {new Date(selectedFeedback.repliedAt).toLocaleString('zh-CN')}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{selectedFeedback.adminReply}</p>
                </div>
              )}

              {/* 回复表单 */}
              <div className="space-y-3">
                <label className="text-sm text-slate-400">回复内容</label>
                <Textarea
                  placeholder="输入回复内容..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={4}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm text-slate-400">更新状态为</label>
                <Select value={replyStatus} onValueChange={setReplyStatus}>
                  <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="processing">处理中</SelectItem>
                    <SelectItem value="resolved">已解决</SelectItem>
                    <SelectItem value="closed">已关闭</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplyDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              取消
            </Button>
            <Button
              onClick={handleReply}
              disabled={isSubmitting || !replyContent.trim()}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  提交回复
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
