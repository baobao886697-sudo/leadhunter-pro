import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search as SearchIcon, Loader2, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

export default function Search() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [state, setState] = useState("");

  const { data: profile } = trpc.user.profile.useQuery(undefined, { enabled: !!user });

  const searchMutation = trpc.search.start.useMutation({
    onSuccess: (data) => {
      toast.success("搜索任务已创建");
      if (data.taskId) {
        setLocation(`/results/${data.taskId}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "搜索失败");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !title.trim() || !state) {
      toast.error("请填写所有必填字段");
      return;
    }

    if ((profile?.credits || 0) < 1) {
      toast.error("积分不足，请先充值");
      return;
    }

    searchMutation.mutate({ name: name.trim(), title: title.trim(), state });
  };

  const credits = profile?.credits || 0;
  const insufficientCredits = credits < 101; // 1搜索 + 100获取电话

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">搜索专业人士</h1>
          <p className="text-muted-foreground mt-1">
            输入姓名、职位和州来搜索LinkedIn专业人士的联系方式
          </p>
        </div>

        {/* 积分提示 */}
        {insufficientCredits && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>积分不足</AlertTitle>
            <AlertDescription>
              您当前有 {credits} 积分。完整搜索需要至少 101 积分（搜索1积分 + 获取电话100积分）。
              <Button variant="link" className="p-0 h-auto ml-1" onClick={() => setLocation("/recharge")}>
                立即充值
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 费用说明 */}
        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">费用说明</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>搜索费用：1 积分</li>
              <li>获取电话号码：2 积分/条（每批50条 = 100积分）</li>
              <li>二次验证：免费</li>
              <li>您当前余额：<span className="font-semibold text-foreground">{credits} 积分</span></li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">搜索条件</CardTitle>
            <CardDescription>所有字段均为必填</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-card-foreground">姓名</Label>
                <Input
                  id="name"
                  placeholder="例如：John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-input border-border text-foreground"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  输入要搜索的人员姓名
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-card-foreground">职位/工作</Label>
                <Input
                  id="title"
                  placeholder="例如：Software Engineer, CEO, Marketing Manager"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-input border-border text-foreground"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  输入职位名称或工作描述
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="state" className="text-card-foreground">州</Label>
                <Select value={state} onValueChange={setState} required>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="选择州" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  选择美国的州
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={searchMutation.isPending || insufficientCredits}
              >
                {searchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    正在创建搜索任务...
                  </>
                ) : (
                  <>
                    <SearchIcon className="mr-2 h-5 w-5" />
                    开始搜索
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
