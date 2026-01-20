import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  MessageSquare, 
  Send, 
  Lightbulb, 
  Briefcase, 
  Code, 
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  MessageCircle
} from "lucide-react";
import { toast } from "sonner";

// 反馈类型配置
const FEEDBACK_TYPES = [
  { value: 'question', label: '问题咨询', icon: HelpCircle, color: 'text-blue-400', description: '使用过程中遇到的问题' },
  { value: 'suggestion', label: '功能建议', icon: Lightbulb, color: 'text-yellow-400', description: '产品改进建议' },
  { value: 'business', label: '商务合作', icon: Briefcase, color: 'text-green-400', description: '商务洽谈、代理合作' },
  { value: 'custom_dev', label: '定制开发', icon: Code, color: 'text-purple-400', description: '定制化功能开发需求' },
  { value: 'other', label: '其他', icon: MessageSquare, color: 'text-gray-400', description: '其他反馈' },
] as const;

// 状态配置
const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  processing: { label: '处理中', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Loader2 },
  resolved: { label: '已解决', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  closed: { label: '已关闭', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: AlertCircle },
};

export default function Feedback() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');
  const [selectedType, setSelectedType] = useState<string>('question');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取我的反馈列表
  const { data: feedbacksData, isLoading: feedbacksLoading, refetch: refetchFeedbacks } = trpc.feedback.myFeedbacks.useQuery(
    { page: 1, limit: 50 },
    { enabled: !!user }
  );

  // 提交反馈
  const submitMutation = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success('反馈提交成功', { description: '我们会尽快处理您的反馈' });
      setTitle('');
      setContent('');
      setContactInfo('');
      setActiveTab('history');
      refetchFeedbacks();
    },
    onError: (error) => {
      toast.error('提交失败', { description: error.message });
    },
  });

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('请输入标题');
      return;
    }
    if (content.trim().length < 10) {
      toast.error('内容至少10个字');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync({
        type: selectedType as any,
        title: title.trim(),
        content: content.trim(),
        contactInfo: contactInfo.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbacks = feedbacksData?.feedbacks || [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 relative">
        {/* 背景装饰 */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px]" />
        </div>

        {/* 页面标题 */}
        <div className="relative">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/20">
              <MessageCircle className="w-6 h-6 text-cyan-400" />
            </div>
            联系我们
          </h1>
          <p className="text-gray-400 mt-2">
            有任何问题、建议或合作需求，欢迎随时联系我们
          </p>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="relative">
          <TabsList className="bg-gray-800/50 border border-gray-700/50 p-1">
            <TabsTrigger 
              value="submit" 
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <Send className="w-4 h-4 mr-2" />
              提交反馈
            </TabsTrigger>
            <TabsTrigger 
              value="history"
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <Clock className="w-4 h-4 mr-2" />
              我的反馈
              {feedbacks.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-gray-700 text-gray-300">
                  {feedbacks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 提交反馈 */}
          <TabsContent value="submit" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧：反馈类型选择 */}
              <div className="lg:col-span-1">
                <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">选择反馈类型</CardTitle>
                    <CardDescription>请选择最符合您需求的类型</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {FEEDBACK_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = selectedType === type.value;
                      return (
                        <button
                          key={type.value}
                          onClick={() => setSelectedType(type.value)}
                          className={`w-full p-3 rounded-lg border transition-all text-left flex items-center gap-3 ${
                            isSelected 
                              ? 'bg-cyan-500/10 border-cyan-500/50 text-white' 
                              : 'bg-gray-800/30 border-gray-700/50 text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : type.color}`} />
                          <div className="flex-1">
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-gray-500">{type.description}</div>
                          </div>
                          {isSelected && <ChevronRight className="w-4 h-4 text-cyan-400" />}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* 右侧：反馈表单 */}
              <div className="lg:col-span-2">
                <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">填写反馈内容</CardTitle>
                    <CardDescription>请详细描述您的问题或需求，以便我们更好地为您服务</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-gray-300">标题 *</Label>
                      <Input
                        id="title"
                        placeholder="请简要描述您的问题或需求"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                        className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-cyan-500/50"
                      />
                      <div className="text-xs text-gray-500 text-right">{title.length}/200</div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content" className="text-gray-300">详细内容 *</Label>
                      <Textarea
                        id="content"
                        placeholder="请详细描述您的问题、建议或需求..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        maxLength={2000}
                        rows={6}
                        className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-cyan-500/50 resize-none"
                      />
                      <div className="text-xs text-gray-500 text-right">{content.length}/2000</div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact" className="text-gray-300">联系方式（可选）</Label>
                      <Input
                        id="contact"
                        placeholder="微信号、电话或其他联系方式"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        maxLength={200}
                        className="bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-500 focus:border-cyan-500/50"
                      />
                      <div className="text-xs text-gray-500">留下联系方式，方便我们与您沟通</div>
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !title.trim() || content.trim().length < 10}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          提交中...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          提交反馈
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 我的反馈历史 */}
          <TabsContent value="history" className="mt-6">
            <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg">我的反馈记录</CardTitle>
                <CardDescription>查看您提交的反馈和处理状态</CardDescription>
              </CardHeader>
              <CardContent>
                {feedbacksLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  </div>
                ) : feedbacks.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">暂无反馈记录</p>
                    <Button
                      variant="outline"
                      className="mt-4 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                      onClick={() => setActiveTab('submit')}
                    >
                      提交第一条反馈
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((feedback: any) => {
                      const typeConfig = FEEDBACK_TYPES.find(t => t.value === feedback.type);
                      const statusConfig = STATUS_CONFIG[feedback.status as keyof typeof STATUS_CONFIG];
                      const TypeIcon = typeConfig?.icon || MessageSquare;
                      const StatusIcon = statusConfig?.icon || Clock;

                      return (
                        <div
                          key={feedback.id}
                          className="p-4 rounded-lg bg-gray-800/30 border border-gray-700/50 hover:border-gray-600/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <TypeIcon className={`w-4 h-4 ${typeConfig?.color || 'text-gray-400'}`} />
                                <span className="text-xs text-gray-500">{typeConfig?.label || '其他'}</span>
                                <Badge className={`${statusConfig?.color} text-xs`}>
                                  <StatusIcon className={`w-3 h-3 mr-1 ${feedback.status === 'processing' ? 'animate-spin' : ''}`} />
                                  {statusConfig?.label || '未知'}
                                </Badge>
                              </div>
                              <h3 className="text-white font-medium truncate">{feedback.title}</h3>
                              <p className="text-gray-400 text-sm mt-1 line-clamp-2">{feedback.content}</p>
                              <div className="text-xs text-gray-500 mt-2">
                                提交时间：{new Date(feedback.createdAt).toLocaleString('zh-CN')}
                              </div>
                            </div>
                          </div>

                          {/* 管理员回复 */}
                          {feedback.adminReply && (
                            <div className="mt-4 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-4 h-4 text-cyan-400" />
                                <span className="text-cyan-400 text-sm font-medium">官方回复</span>
                                {feedback.repliedAt && (
                                  <span className="text-xs text-gray-500">
                                    {new Date(feedback.repliedAt).toLocaleString('zh-CN')}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-300 text-sm whitespace-pre-wrap">{feedback.adminReply}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
