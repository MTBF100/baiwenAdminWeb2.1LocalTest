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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Play, Pause, CheckCircle2, Trash2, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pending: { label: "待开始", variant: "secondary", color: "text-amber-600" },
  active: { label: "进行中", variant: "default", color: "text-emerald-600" },
  ended: { label: "已结束", variant: "outline", color: "text-muted-foreground" },
};

export default function ActivitiesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [editActivity, setEditActivity] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewActivity, setViewActivity] = useState<any>(null);

  const pageSize = 20;
  const stableInput = useMemo(() => ({ page, pageSize, status: statusFilter || undefined }), [page, pageSize, statusFilter]);

  const { data, isLoading, refetch } = trpc.wxActivities.list.useQuery(stableInput);
  const { data: stats } = trpc.wxActivities.stats.useQuery();

  const updateMutation = trpc.wxActivities.update.useMutation({
    onSuccess: () => { toast.success("活动更新成功"); setEditActivity(null); refetch(); },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.wxActivities.delete.useMutation({
    onSuccess: () => { toast.success("活动已删除"); setDeleteId(null); refetch(); },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("zh-CN");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">活动管理</h1>
        <p className="text-muted-foreground mt-1">管理小程序活动数据与状态</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: "总活动", value: stats?.total ?? 0, icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50" },
          { title: "进行中", value: stats?.active ?? 0, icon: Play, color: "text-emerald-600", bg: "bg-emerald-50" },
          { title: "待开始", value: stats?.pending ?? 0, icon: Pause, color: "text-amber-600", bg: "bg-amber-50" },
          { title: "已结束", value: stats?.ended ?? 0, icon: CheckCircle2, color: "text-gray-600", bg: "bg-gray-50" },
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
            <CardTitle className="text-base">活动列表</CardTitle>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-28"><SelectValue placeholder="全部状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待开始</SelectItem>
                <SelectItem value="active">进行中</SelectItem>
                <SelectItem value="ended">已结束</SelectItem>
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
                      <TableHead>活动名称</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>开始日期</TableHead>
                      <TableHead>结束日期</TableHead>
                      <TableHead>参与人数</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((activity) => {
                      const attendees = Array.isArray(activity.attendActMan) ? activity.attendActMan.length : 0;
                      return (
                        <TableRow key={activity.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">{activity.name || "未命名活动"}</TableCell>
                          <TableCell>
                            <Badge variant={statusMap[activity.status ?? "pending"]?.variant ?? "secondary"}>
                              {statusMap[activity.status ?? "pending"]?.label ?? activity.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(activity.startDate)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(activity.endDate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-sm">{attendees}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewActivity(activity)}><Users className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditActivity(activity)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(activity.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!data?.data || data.data.length === 0) && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无活动数据</TableCell></TableRow>
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

      {/* View Participants Dialog */}
      <Dialog open={!!viewActivity} onOpenChange={() => setViewActivity(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewActivity?.name} - 参与者</DialogTitle></DialogHeader>
          {viewActivity && (
            <div className="space-y-3">
              {viewActivity.describe && <p className="text-sm text-muted-foreground">{viewActivity.describe}</p>}
              <div className="border rounded-lg divide-y">
                {Array.isArray(viewActivity.attendActMan) && viewActivity.attendActMan.length > 0 ? (
                  viewActivity.attendActMan.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">{i + 1}</div>
                      <span className="text-sm">{typeof p === "string" ? p : JSON.stringify(p)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-muted-foreground">暂无参与者</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editActivity} onOpenChange={() => setEditActivity(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑活动</DialogTitle></DialogHeader>
          {editActivity && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>活动名称</Label>
                <Input value={editActivity.name || ""} onChange={(e) => setEditActivity({ ...editActivity, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>活动描述</Label>
                <Textarea value={editActivity.describe || ""} onChange={(e) => setEditActivity({ ...editActivity, describe: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={editActivity.status || "pending"} onValueChange={(v) => setEditActivity({ ...editActivity, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待开始</SelectItem>
                    <SelectItem value="active">进行中</SelectItem>
                    <SelectItem value="ended">已结束</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditActivity(null)}>取消</Button>
            <Button onClick={() => updateMutation.mutate({ id: editActivity.id, name: editActivity.name, describe: editActivity.describe, status: editActivity.status })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>此操作将永久删除该活动数据，无法恢复。确定要继续吗？</AlertDialogDescription>
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
