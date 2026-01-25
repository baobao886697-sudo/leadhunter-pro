/**
 * Anywho 搜索历史页面
 * 独立模块，布局参照 TPS
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  Star,
  Heart,
} from "lucide-react";
import { toast } from "sonner";

export default function AnywhoHistory() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // 获取搜索历史
  const { data: history, isLoading } = trpc.anywho.getHistory.useQuery({
    page,
    pageSize,
  });
  
  // 导出 CSV
  const exportMutation = trpc.anywho.exportResults.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    },
    onError: (error: any) => {
      toast.error("导出失败", { description: error.message });
    },
  });
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">等待中</Badge>;
      case "running":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">搜索中</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-green-500 text-green-500">已完成</Badge>;
      case "failed":
        return <Badge variant="outline" className="border-red-500 text-red-500">失败</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="border-gray-500 text-gray-500">已取消</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/anywho")}
              className="hover:bg-gray-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                Anywho 搜索历史
              </h1>
              <p className="text-gray-400 mt-1">
                查看您的 Anywho 搜索任务记录
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLocation("/anywho")}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
          >
            <Search className="h-4 w-4 mr-2" />
            新建搜索
          </Button>
        </div>
        
        {/* 历史记录表格 */}
        <Card className="bg-[#0d1526] border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              搜索任务列表
              <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 ml-2">
                <Heart className="h-3 w-3 mr-1" />
                含婚姻状况
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : history && history.tasks.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400">任务ID</TableHead>
                        <TableHead className="text-gray-400">搜索模式</TableHead>
                        <TableHead className="text-gray-400">姓名数量</TableHead>
                        <TableHead className="text-gray-400">结果数</TableHead>
                        <TableHead className="text-gray-400">消耗积分</TableHead>
                        <TableHead className="text-gray-400">状态</TableHead>
                        <TableHead className="text-gray-400">创建时间</TableHead>
                        <TableHead className="text-gray-400">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.tasks.map((task: any) => (
                        <TableRow key={task.taskId} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="font-mono text-sm">
                            {task.taskId.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            {task.mode === "nameOnly" ? "仅姓名" : "姓名+地点"}
                          </TableCell>
                          <TableCell>{task.names?.length || 0}</TableCell>
                          <TableCell>{task.totalResults || 0}</TableCell>
                          <TableCell className="text-amber-400">
                            {Number(task.creditsUsed || 0).toFixed(1)}
                          </TableCell>
                          <TableCell>{getStatusBadge(task.status)}</TableCell>
                          <TableCell className="text-gray-400 text-sm">
                            {new Date(task.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocation(`/anywho/task/${task.taskId}`)}
                                className="hover:bg-gray-700"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {task.status === "completed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => exportMutation.mutate({ taskId: task.taskId })}
                                  disabled={exportMutation.isPending}
                                  className="hover:bg-gray-700"
                                >
                                  {exportMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* 分页 */}
                {history.total > pageSize && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-400">
                      显示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, history.total)} / {history.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="border-gray-700"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-400">
                        {page} / {Math.ceil(history.total / pageSize)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * pageSize >= history.total}
                        className="border-gray-700"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">暂无搜索记录</p>
                <Button
                  onClick={() => setLocation("/anywho")}
                  className="bg-gradient-to-r from-amber-600 to-orange-600"
                >
                  开始第一次搜索
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
