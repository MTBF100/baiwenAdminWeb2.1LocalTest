import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileText,
  CalendarDays,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function Home() {
  const { data: overview, isLoading: overviewLoading } =
    trpc.dashboard.overview.useQuery();
  const { data: userStats, isLoading: userStatsLoading } =
    trpc.dashboard.userStats.useQuery();
  const { data: articleStats, isLoading: articleStatsLoading } =
    trpc.dashboard.articleStats.useQuery();

  if (overviewLoading || userStatsLoading || articleStatsLoading) {
    return <DashboardSkeleton />;
  }

  const statCards = [
    {
      title: "总用户数",
      value: overview?.userCount ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "文章总数",
      value: overview?.articleCount ?? 0,
      icon: FileText,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "活动总数",
      value: overview?.activityCount ?? 0,
      icon: CalendarDays,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "待审核文章",
      value: overview?.pendingArticles ?? 0,
      icon: AlertCircle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "今日新增用户",
      value: overview?.todayNewUsers ?? 0,
      icon: TrendingUp,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-muted-foreground mt-1">
          百文小程序数据概览与运营监控
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {stat.title}
                  </p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              用户增长趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userStats?.monthlyGrowth && userStats.monthlyGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={userStats.monthlyGrowth}>
                  <defs>
                    <linearGradient
                      id="userGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="oklch(0.55 0.2 260)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="oklch(0.55 0.2 260)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="oklch(0.55 0.2 260)"
                    fill="url(#userGradient)"
                    strokeWidth={2}
                    name="新增用户"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                暂无数据，请先同步微信云数据库
              </div>
            )}
          </CardContent>
        </Card>

        {/* Article Stats Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              文章发布统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            {articleStats?.monthlyPublish &&
            articleStats.monthlyPublish.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={articleStats.monthlyPublish}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="oklch(0.6 0.18 180)"
                    radius={[4, 4, 0, 0]}
                    name="发布文章"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                暂无数据，请先同步微信云数据库
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Article Status Overview & Recent Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              文章审核状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  label: "待审核",
                  value: articleStats?.pending ?? 0,
                  color: "bg-amber-500",
                },
                {
                  label: "已通过",
                  value: articleStats?.approved ?? 0,
                  color: "bg-emerald-500",
                },
                {
                  label: "已拒绝",
                  value: articleStats?.rejected ?? 0,
                  color: "bg-red-500",
                },
              ].map((item) => {
                const total = articleStats?.total || 1;
                const pct = Math.round(((item.value as number) / total) * 100);
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="font-medium">
                        {item.value} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              最近同步记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview?.syncLogRecent && overview.syncLogRecent.length > 0 ? (
              <div className="space-y-3">
                {overview.syncLogRecent.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{log.collection}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.startedAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        log.status === "success"
                          ? "default"
                          : log.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {log.status === "success"
                        ? "成功"
                        : log.status === "failed"
                          ? "失败"
                          : "运行中"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                暂无同步记录
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </div>
  );
}
