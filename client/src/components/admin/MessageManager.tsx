import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Mail, Trash2, Search, RefreshCw, CheckCircle,
  XCircle, ChevronLeft, ChevronRight
} from "lucide-react";

export function MessageManager() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"single" | "bulk">("single");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const limit = 15;

  const { data, refetch, isLoading } = trpc.admin.getMessages.useQuery({
    page,
    limit,
    search: search || undefined,
  });

  const deleteMessageMutation = trpc.admin.deleteMessage.useMutation({
    onSuccess: () => {
      toast.success("消息已删除");
      refetch();
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error(error.message || "删除失败");
    },
  });

  const deleteMessagesMutation = trpc.admin.deleteMessages.useMutation({
    onSuccess: (data) => {
      toast.success(`已删除 ${data.count} 条消息`);
      refetch();
      setSelectedIds([]);
    },
    onError: (error) => {
      toast.error(error.message || "批量删除失败");
    },
  });

  const messages = data?.messages || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(messages.map((m: any) => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const handleDeleteSingle = (id: number) => {
    setDeleteTarget("single");
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteBulk = () => {
    if (selectedIds.length === 0) {
      toast.error("请先选择要删除的消息");
      return;
    }
    setDeleteTarget("bulk");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTarget === "single" && deleteTargetId) {
      deleteMessageMutation.mutate({ messageId: deleteTargetId });
    } else if (deleteTarget === "bulk") {
      deleteMessagesMutation.mutate({ messageIds: selectedIds });
    }
    setDeleteDialogOpen(false);
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      system: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      support: "bg-green-500/20 text-green-400 border-green-500/30",
      notification: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      promotion: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    const labels: Record<string, string> = {
      system: "系统",
      support: "客服",
      notification: "通知",
      promotion: "推广",
    };
    return (
      <Badge className={styles[type] || "bg-slate-500/20 text-slate-400"}>
        {labels[type] || type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-cyan-400" />
            消息管理
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            管理所有已发送给用户的消息，支持搜索、查看和删除
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteBulk}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除选中 ({selectedIds.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索消息标题或内容..."
            className="pl-10 bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <Button
          onClick={handleSearch}
          size="sm"
          className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
        >
          搜索
        </Button>
        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
            className="text-slate-400 hover:text-white"
          >
            清除
          </Button>
        )}
      </div>

      {/* 统计信息 */}
      <div className="text-sm text-slate-400">
        共 {total} 条消息
        {search && <span className="ml-2">（搜索: "{search}"）</span>}
      </div>

      {/* 消息列表 */}
      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={messages.length > 0 && selectedIds.length === messages.length}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                />
              </TableHead>
              <TableHead className="text-slate-400">ID</TableHead>
              <TableHead className="text-slate-400">收件人</TableHead>
              <TableHead className="text-slate-400">标题</TableHead>
              <TableHead className="text-slate-400">内容预览</TableHead>
              <TableHead className="text-slate-400">类型</TableHead>
              <TableHead className="text-slate-400">已读</TableHead>
              <TableHead className="text-slate-400">发送时间</TableHead>
              <TableHead className="text-slate-400">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                  加载中...
                </TableCell>
              </TableRow>
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                  暂无消息
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message: any) => (
                <TableRow key={message.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(message.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(message.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-slate-300 font-mono text-xs">
                    {message.id}
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs max-w-[150px] truncate">
                    {message.userEmail || `用户#${message.userId}`}
                  </TableCell>
                  <TableCell className="text-white text-sm max-w-[180px] truncate font-medium">
                    {message.title}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs max-w-[200px] truncate">
                    {message.content}
                  </TableCell>
                  <TableCell>{getTypeBadge(message.type)}</TableCell>
                  <TableCell>
                    {message.isRead ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-slate-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                    {new Date(message.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSingle(message.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            第 {page} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="border-slate-600 text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="border-slate-600 text-slate-300"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {deleteTarget === "single"
                ? "确定要删除这条消息吗？删除后用户将无法再看到这条消息。"
                : `确定要删除选中的 ${selectedIds.length} 条消息吗？删除后用户将无法再看到这些消息。`}
              <br />
              <span className="text-red-400 font-medium">此操作不可撤销。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
