import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Eye, CheckCircle, XCircle, Trash2, FileText, Clock, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审核", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
  offline: { label: "已下架", variant: "outline" },
};

export default function ArticlesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [viewArticle, setViewArticle] = useState<any>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const pageSize = 20;
  const stableInput = useMemo(() => ({
    page, pageSize,
    search: search || undefined,
    status: statusFilter || undefined,
  }), [page, pageSize, search, statusFilter]);

  const { data, isLoading, refetch } = trpc.wxArticles.list.useQuery(stableInput);
  const { data: stats } = trpc.wxArticles.stats.useQuery();

  const approveMutation = trpc.wxArticles.approve.useMutation({
    onSuccess: () => { toast.success("文章已通过审核"); refetch(); },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const rejectMutation = trpc.wxArticles.reject.useMutation({
    onSuccess: () => { toast.success("文章已拒绝"); setRejectId(null); setRejectReason(""); refetch(); },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const deleteMutation = trpc.wxArticles.delete.useMutation({
    onSuccess: () => { toast.success("文章已删除"); setDeleteId(null); refetch(); },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">文章管理</h1>
        <p className="text-muted-foreground mt-1">审核、编辑和管理小程序文章内容</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: "总文章", value: stats?.total ?? 0, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { title: "待审核", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { title: "已通过", value: stats?.approved ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { title: "已拒绝", value: stats?.rejected ?? 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
        ].map((s) => (
          <Card key={s.title} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.title}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base">文章列表</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-28"><SelectValue placeholder="全部状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待审核</SelectItem>
                  <SelectItem value="approved">已通过</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                  <SelectItem value="offline">已下架</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="搜索标题..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))} className="w-full sm:w-52" />
              <Button variant="outline" size="icon" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
            </div>
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
                      <TableHead>标题</TableHead>
                      <TableHead>作者</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>浏览</TableHead>
                      <TableHead>点赞</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{article.title || "无标题"}</TableCell>
                        <TableCell className="text-muted-foreground">{article.author || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusMap[article.status ?? "pending"]?.variant ?? "secondary"}>
                            {statusMap[article.status ?? "pending"]?.label ?? article.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{article.viewCount ?? 0}</TableCell>
                        <TableCell className="font-mono text-sm">{article.likeCount ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(article.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewArticle(article)}><Eye className="h-3.5 w-3.5" /></Button>
                            {article.status === "pending" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => approveMutation.mutate({ id: article.id })}><CheckCircle className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => setRejectId(article.id)}><XCircle className="h-3.5 w-3.5" /></Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(article.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!data?.data || data.data.length === 0) && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无文章数据</TableCell></TableRow>
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

      {/* View Dialog */}
      <Dialog open={!!viewArticle} onOpenChange={() => setViewArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewArticle?.title || "文章详情"}</DialogTitle></DialogHeader>
          {viewArticle && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>作者: {viewArticle.author || "-"}</span>
                <span>浏览: {viewArticle.viewCount ?? 0}</span>
                <span>点赞: {viewArticle.likeCount ?? 0}</span>
              </div>
              {viewArticle.summary && <div className="p-3 bg-muted rounded-lg text-sm"><strong>摘要:</strong> {viewArticle.summary}</div>}
              {viewArticle.statusMessage && <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm"><strong>审核信息:</strong> {viewArticle.statusMessage}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectId !== null} onOpenChange={() => { setRejectId(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>拒绝文章</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>拒绝原因</Label>
              <Textarea placeholder="请输入拒绝原因..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }}>取消</Button>
            <Button variant="destructive" onClick={() => rejectId && rejectMutation.mutate({ id: rejectId, reason: rejectReason })} disabled={!rejectReason.trim() || rejectMutation.isPending}>
              {rejectMutation.isPending ? "提交中..." : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>文章将被归档到已删除文章表中。确定要继续吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
