import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollText, Info, AlertTriangle, XCircle } from "lucide-react";

const levelMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  info: { label: "信息", variant: "secondary", icon: Info },
  warn: { label: "警告", variant: "default", icon: AlertTriangle },
  error: { label: "错误", variant: "destructive", icon: XCircle },
};

const modules = [
  { value: "all_modules", label: "全部模块" },
  { value: "wxUsers", label: "用户管理" },
  { value: "wxArticles", label: "文章管理" },
  { value: "wxActivities", label: "活动管理" },
  { value: "sync", label: "数据同步" },
  { value: "analysis", label: "数据分析" },
];

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("");

  const pageSize = 30;
  const stableInput = useMemo(() => ({
    page, pageSize,
    level: levelFilter || undefined,
    module: moduleFilter || undefined,
  }), [page, pageSize, levelFilter, moduleFilter]);

  const { data, isLoading } = trpc.systemLogs.list.useQuery(stableInput);
  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统日志</h1>
        <p className="text-muted-foreground mt-1">API 调用记录、数据同步状态与异常信息</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              操作日志
            </CardTitle>
            <div className="flex gap-2">
              <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v === "all_levels" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-28"><SelectValue placeholder="全部级别" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_levels">全部级别</SelectItem>
                  <SelectItem value="info">信息</SelectItem>
                  <SelectItem value="warn">警告</SelectItem>
                  <SelectItem value="error">错误</SelectItem>
                </SelectContent>
              </Select>
              <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v === "all_modules" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-32"><SelectValue placeholder="全部模块" /></SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">级别</TableHead>
                      <TableHead className="w-28">模块</TableHead>
                      <TableHead className="w-32">操作</TableHead>
                      <TableHead>消息</TableHead>
                      <TableHead className="w-40">时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((log) => {
                      const level = levelMap[log.level] || levelMap.info;
                      const LevelIcon = level.icon;
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant={level.variant} className="text-xs gap-1">
                              <LevelIcon className="h-3 w-3" />
                              {level.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{log.module}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.action}</TableCell>
                          <TableCell className="text-sm max-w-[400px] truncate">{log.message}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(log.createdAt).toLocaleString("zh-CN")}</TableCell>
                        </TableRow>
                      );
                    })}
                    {(!data?.data || data.data.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">暂无日志记录</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">共 {data?.total ?? 0} 条</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                    <span className="flex items-center text-sm px-2">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
