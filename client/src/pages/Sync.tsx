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
import {
  RefreshCw, Database, CheckCircle2, XCircle, Clock, Loader2, Zap,
} from "lucide-react";
import { toast } from "sonner";

const collections = [
  { value: "Users", label: "用户集合 (Users)" },
  { value: "Article", label: "文章集合 (Article)" },
  { value: "Active", label: "活动集合 (Active)" },
  { value: "songGoMessage", label: "消息集合 (songGoMessage)" },
  { value: "Cookies", label: "积分交易集合 (Cookies)" },
  { value: "all", label: "全部集合" },
];

export default function SyncPage() {
  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [filterCollection, setFilterCollection] = useState<string>("");

  const pageSize = 20;
  const stableInput = useMemo(() => ({ page, pageSize, collection: filterCollection || undefined }), [page, pageSize, filterCollection]);
  const { data: logs, isLoading, refetch } = trpc.sync.logs.useQuery(stableInput);

  const syncMutation = trpc.sync.triggerSync.useMutation({
    onSuccess: (result) => {
      const failed = result.results.filter((r) => r.status === "failed");
      if (failed.length > 0) {
        toast.warning(`同步部分完成，${failed.length} 个集合失败`);
      } else {
        toast.success("数据同步完成");
      }
      refetch();
    },
    onError: (e) => toast.error(`同步失败: ${e.message}`),
  });

  const totalPages = Math.ceil((logs?.total ?? 0) / pageSize);

  const handleSync = () => {
    syncMutation.mutate({ collection: selectedCollection as any });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据同步</h1>
        <p className="text-muted-foreground mt-1">微信云数据库 ETL 数据同步管理</p>
      </div>

      {/* Sync Control */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            触发同步
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-3">
                选择要同步的微信云数据库集合，系统将执行 ETL 流程将数据清洗并加载到 MySQL 数据仓库中。
              </p>
              <div className="flex gap-3">
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {collections.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleSync} disabled={syncMutation.isPending}>
                  {syncMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />同步中...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />开始同步</>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-4">
              {[
                { label: "Users", icon: "👤" },
                { label: "Article", icon: "📄" },
                { label: "Active", icon: "🎯" },
                { label: "Message", icon: "💬" },
              ].map((c) => (
                <div key={c.label} className="flex flex-col items-center gap-1">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-xl">{c.icon}</div>
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Results */}
          {syncMutation.data && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">同步结果</h4>
              <div className="space-y-2">
                {syncMutation.data.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.collection}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.status === "success" ? (
                        <>
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />{(r as any).records} 条
                          </Badge>
                        </>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" />失败
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base">同步日志</CardTitle>
            <Select value={filterCollection} onValueChange={(v) => { setFilterCollection(v === "all_filter" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="全部集合" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_filter">全部集合</SelectItem>
                <SelectItem value="Users">Users</SelectItem>
                <SelectItem value="Article">Article</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="songGoMessage">songGoMessage</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>集合</TableHead>
                      <TableHead>操作</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>总记录</TableHead>
                      <TableHead>已同步</TableHead>
                      <TableHead>失败</TableHead>
                      <TableHead>耗时</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs?.data.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.collection}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{log.action.replace("_", " ")}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={log.status === "success" ? "default" : log.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                            {log.status === "success" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : log.status === "failed" ? <XCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                            {log.status === "success" ? "成功" : log.status === "failed" ? "失败" : "运行中"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.totalRecords}</TableCell>
                        <TableCell className="font-mono text-sm">{log.syncedRecords}</TableCell>
                        <TableCell className="font-mono text-sm">{log.failedRecords}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.duration ? `${log.duration}ms` : "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(log.startedAt).toLocaleString("zh-CN")}</TableCell>
                      </TableRow>
                    ))}
                    {(!logs?.data || logs.data.length === 0) && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无同步日志</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">共 {logs?.total ?? 0} 条</p>
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
