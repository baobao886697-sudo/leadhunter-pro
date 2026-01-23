/**
 * TruePeopleSearch 搜索历史页面
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import {
  Search,
  History,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function TpsHistory() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  const { data, isLoading } = useQuery({
    queryKey: ["tps", "history", page],
    queryFn: () => trpc.tps.getHistory.query({ page, pageSize }),
  });
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            等待中
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            搜索中
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            已完成
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            <XCircle className="h-3 w-3 mr-1" />
            失败
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="border-gray-500 text-gray-500">
            <AlertCircle className="h-3 w-3 mr-1" />
            已取消
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/tps")}
              className="hover:bg-gray-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <History className="h-6 w-6 text-cyan-500" />
                搜索历史
              </h1>
              <p className="text-gray-400 mt-1">
                查看您的 TruePeopleSearch 搜索记录
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLocation("/tps")}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
          >
            <Search className="h-4 w-4 mr-2" />
            新建搜索
          </Button>
        </div>
        
        {/* 历史记录表格 */}
        <Card className="bg-[#0d1526] border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg">搜索记录</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
              </div>
            ) : data?.tasks && data.tasks.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800">
                      <TableHead className="text-gray-400">任务ID</TableHead>
                      <TableHead className="text-gray-400">搜索模式</TableHead>
                      <TableHead className="text-gray-400">子任务数</TableHead>
                      <TableHead className="text-gray-400">结果数</TableHead>
                      <TableHead className="text-gray-400">消耗积分</TableHead>
                      <TableHead className="text-gray-400">状态</TableHead>
                      <TableHead className="text-gray-400">创建时间</TableHead>
                      <TableHead className="text-gray-400">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tasks.map((task: any) => (
                      <TableRow key={task.id} className="border-gray-800">
                        <TableCell className="font-mono text-sm">
                          {task.taskId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {task.mode === "nameOnly" ? "仅姓名" : "姓名+地点"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.completedSubTasks} / {task.totalSubTasks}
                        </TableCell>
                        <TableCell className="font-medium text-white">
                          {task.totalResults}
                        </TableCell>
                        <TableCell className="text-cyan-400">
                          {task.creditsUsed?.toFixed(1) || 0}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell className="text-sm text-gray-400">
                          {new Date(task.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/tps/task/${task.taskId}`)}
                            className="hover:bg-gray-800"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* 分页 */}
                {data.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-400">
                      第 {page} 页，共 {data.totalPages} 页
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                        disabled={page === data.totalPages}
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
                <History className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">暂无搜索记录</p>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/tps")}
                  className="mt-4 border-gray-700"
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
