import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Pencil, Trash2, Users, Shield, Activity } from "lucide-react";
import { toast } from "sonner";

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);

  const pageSize = 20;
  const stableInput = useMemo(() => ({ page, pageSize, search: search || undefined }), [page, pageSize, search]);
  const { data, isLoading, refetch } = trpc.wxUsers.list.useQuery(stableInput);
  const { data: stats } = trpc.wxUsers.stats.useQuery();

  const updateMutation = trpc.wxUsers.update.useMutation({
    onSuccess: () => { toast.success("用户更新成功"); setEditUser(null); refetch(); },
    onError: (e) => toast.error(`更新失败: ${e.message}`),
  });

  const deleteMutation = trpc.wxUsers.delete.useMutation({
    onSuccess: () => { toast.success("用户已删除"); setDeleteUserId(null); refetch(); },
    onError: (e) => toast.error(`删除失败: ${e.message}`),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
        <p className="text-muted-foreground mt-1">管理微信小程序用户数据</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "总用户数", value: stats?.total ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { title: "管理员", value: stats?.admins ?? 0, icon: Shield, color: "text-violet-600", bg: "bg-violet-50" },
          { title: "近7天活跃", value: stats?.recentActive ?? 0, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
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

      {/* Search & Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base">用户列表</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="搜索昵称..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full sm:w-64"
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
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
                      <TableHead>昵称</TableHead>
                      <TableHead>签名</TableHead>
                      <TableHead>设备</TableHead>
                      <TableHead>金币</TableHead>
                      <TableHead>银币</TableHead>
                      <TableHead>管理员</TableHead>
                      <TableHead>注册时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium max-w-[120px] truncate">{user.originalNick || "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground">{user.originalSlogan || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.phoneModel || "-"}</TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono">{user.goldCoin ?? 0}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono">{user.silverCoin ?? 0}</Badge></TableCell>
                        <TableCell>{user.administrator ? <Badge className="bg-violet-100 text-violet-700">是</Badge> : <span className="text-muted-foreground">否</span>}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(user.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(user)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteUserId(user.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!data?.data || data.data.length === 0) && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无用户数据，请先同步微信云数据库</TableCell></TableRow>
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

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑用户</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>昵称</Label>
                <Input value={editUser.originalNick || ""} onChange={(e) => setEditUser({ ...editUser, originalNick: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>签名</Label>
                <Input value={editUser.originalSlogan || ""} onChange={(e) => setEditUser({ ...editUser, originalSlogan: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>金币</Label>
                  <Input type="number" value={editUser.goldCoin ?? 0} onChange={(e) => setEditUser({ ...editUser, goldCoin: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>银币</Label>
                  <Input type="number" value={editUser.silverCoin ?? 0} onChange={(e) => setEditUser({ ...editUser, silverCoin: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editUser.administrator} onCheckedChange={(v) => setEditUser({ ...editUser, administrator: v })} />
                <Label>管理员权限</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>取消</Button>
            <Button onClick={() => updateMutation.mutate({ id: editUser.id, originalNick: editUser.originalNick, originalSlogan: editUser.originalSlogan, goldCoin: editUser.goldCoin, silverCoin: editUser.silverCoin, administrator: editUser.administrator })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteUserId !== null} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>此操作将永久删除该用户数据，无法恢复。确定要继续吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteUserId && deleteMutation.mutate({ id: deleteUserId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
