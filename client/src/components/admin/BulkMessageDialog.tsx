import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Send, Users, Mail } from "lucide-react";

interface BulkMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: Array<{ id: number; email: string }>;
}

export function BulkMessageDialog({ open, onOpenChange, users }: BulkMessageDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"system" | "support" | "notification" | "promotion">("notification");

  const sendMutation = trpc.admin.sendBulkMessage.useMutation({
    onSuccess: (data) => {
      toast.success(`消息已发送给 ${data.count} 个用户`);
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "发送失败");
    },
  });

  const resetForm = () => {
    setSelectedUsers([]);
    setSelectAll(false);
    setTitle("");
    setContent("");
    setType("notification");
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedUsers(users.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
      setSelectAll(false);
    }
  };

  const handleSend = () => {
    if (selectedUsers.length === 0) {
      toast.error("请选择至少一个用户");
      return;
    }
    if (!title || !content) {
      toast.error("请填写标题和内容");
      return;
    }
    sendMutation.mutate({
      userIds: selectedUsers,
      title,
      content,
      type,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Mail className="h-5 w-5 text-orange-400" />
            批量发送消息
          </DialogTitle>
          <DialogDescription>
            向选中的用户发送消息通知
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 用户选择 */}
          <div>
            <Label className="text-slate-400">选择用户</Label>
            <div className="mt-2 border border-slate-700 rounded-lg max-h-40 overflow-y-auto">
              <div className="p-2 border-b border-slate-700 bg-slate-800/50 sticky top-0">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  />
                  <span className="text-sm text-slate-300">
                    全选 ({users.length} 个用户)
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                    />
                    <span className="text-sm text-slate-300">{user.email}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              已选择 {selectedUsers.length} 个用户
            </p>
          </div>

          {/* 消息类型 */}
          <div>
            <Label className="text-slate-400">消息类型</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="system">系统消息</SelectItem>
                <SelectItem value="notification">通知</SelectItem>
                <SelectItem value="support">客服消息</SelectItem>
                <SelectItem value="promotion">推广消息</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 标题 */}
          <div>
            <Label className="text-slate-400">消息标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入消息标题"
              className="bg-slate-800 border-slate-600"
            />
          </div>

          {/* 内容 */}
          <div>
            <Label className="text-slate-400">消息内容</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入消息内容"
              className="bg-slate-800 border-slate-600"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-600"
          >
            取消
          </Button>
          <Button
            onClick={handleSend}
            disabled={selectedUsers.length === 0 || !title || !content || sendMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? "发送中..." : `发送给 ${selectedUsers.length} 个用户`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
