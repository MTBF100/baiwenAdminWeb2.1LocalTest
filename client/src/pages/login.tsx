import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LayoutDashboard, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("登录成功，正在跳转...");
      // 刷新用户状态后跳转首页
      await utils.auth.me.invalidate();
      window.location.href = "/";
    },
    onError: (err) => {
      setErrorMsg(err.message || "登录失败，请重试");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!username.trim() || !password.trim()) {
      setErrorMsg("用户名和密码不能为空");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo 区域 */}
        <div className="flex flex-col items-center mb-8 gap-3">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden">
              <img
                src="https://636c-cloud1-7g4qfyp29964bf90-1326816642.tcb.qcloud.la/icons/TM-LOGO.jpg"
                alt="Logo"
                className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden"
              />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">茶沫百文管理系统</h1>
            <p className="text-slate-400 text-sm mt-1">OnlineBaiWen Admin</p>
          </div>
        </div>

        {/* 登录卡片 */}
        <Card className="border-slate-700/50 bg-slate-800/80 backdrop-blur shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">管理员登录</CardTitle>
            <CardDescription className="text-slate-400">
              请输入您的管理员账号和密码
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 错误提示 */}
              {errorMsg && (
                <Alert variant="destructive" className="border-red-800/50 bg-red-950/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-300">{errorMsg}</AlertDescription>
                </Alert>
              )}

              {/* 用户名 */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300 text-sm font-medium">
                  用户名
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入管理员用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginMutation.isPending}
                  autoComplete="username"
                  autoFocus
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20"
                />
              </div>

              {/* 密码 */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                  密码
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                    autoComplete="current-password"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 登录按钮 */}
              <Button
                type="submit"
                className="w-full h-10 font-medium"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  "登录"
                )}
              </Button>
            </form>

            {/* 底部提示 */}
            <p className="text-center text-xs text-slate-500 mt-6">
              联系站主创建管理员账号
            </p>
          </CardContent>
        </Card>

        {/* 版权信息 */}
        <p className="text-center text-xs text-slate-600 mt-6">
          © {new Date().getFullYear()} OnlineBaiWen 管理系统
        </p>
      </div>
    </div>
  );
}