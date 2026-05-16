import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, Brain, Sparkles, TrendingUp, FileText, Loader2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

const COLORS = ["oklch(0.55 0.2 260)", "oklch(0.6 0.18 180)", "oklch(0.65 0.15 140)", "oklch(0.7 0.16 50)", "oklch(0.55 0.2 320)"];

const typeLabels: Record<string, string> = {
  user_behavior: "用户行为分析",
  content_trend: "内容趋势分析",
  operation_suggestion: "运营建议",
};

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);

  const { data: userStats } = trpc.dashboard.userStats.useQuery();
  const { data: articleStats } = trpc.dashboard.articleStats.useQuery();
  const { data: activityStats } = trpc.dashboard.activityStats.useQuery();
  const stableReportInput = useMemo(() => ({ page: 1, pageSize: 10 }), []);
  const { data: reports, refetch: refetchReports } = trpc.analysis.reports.useQuery(stableReportInput);

  const generateMutation = trpc.analysis.generate.useMutation({
    onSuccess: (result) => {
      toast.success("分析报告生成成功");
      setGeneratedContent(result.content);
      setGeneratingType(null);
      refetchReports();
    },
    onError: (e) => {
      toast.error(`生成失败: ${e.message}`);
      setGeneratingType(null);
    },
  });

  const handleGenerate = (type: "user_behavior" | "content_trend" | "operation_suggestion") => {
    setGeneratingType(type);
    setGeneratedContent(null);
    generateMutation.mutate({ type });
  };

  // Pie data for article status
  const articlePieData = articleStats ? [
    { name: "待审核", value: articleStats.pending },
    { name: "已通过", value: articleStats.approved },
    { name: "已拒绝", value: articleStats.rejected },
  ].filter((d) => d.value > 0) : [];

  // Pie data for activity status
  const activityPieData = activityStats ? [
    { name: "待开始", value: activityStats.pending },
    { name: "进行中", value: activityStats.active },
    { name: "已结束", value: activityStats.ended },
  ].filter((d) => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据分析</h1>
        <p className="text-muted-foreground mt-1">数据可视化与 AI 智能分析</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1.5" />数据概览</TabsTrigger>
          <TabsTrigger value="ai"><Brain className="h-4 w-4 mr-1.5" />AI 分析</TabsTrigger>
          <TabsTrigger value="reports"><FileText className="h-4 w-4 mr-1.5" />历史报告</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">用户增长趋势</CardTitle></CardHeader>
              <CardContent>
                {userStats?.monthlyGrowth && userStats.monthlyGrowth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={userStats.monthlyGrowth}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.55 0.2 260)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="oklch(0.55 0.2 260)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                      <Area type="monotone" dataKey="count" stroke="oklch(0.55 0.2 260)" fill="url(#areaGrad)" strokeWidth={2} name="新增用户" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">暂无数据</div>
                )}
              </CardContent>
            </Card>

            {/* Article Monthly */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">文章发布趋势</CardTitle></CardHeader>
              <CardContent>
                {articleStats?.monthlyPublish && articleStats.monthlyPublish.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={articleStats.monthlyPublish}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                      <Bar dataKey="count" fill="oklch(0.6 0.18 180)" radius={[4, 4, 0, 0]} name="发布文章" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">暂无数据</div>
                )}
              </CardContent>
            </Card>

            {/* Article Status Pie */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">文章状态分布</CardTitle></CardHeader>
              <CardContent>
                {articlePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={articlePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {articlePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">暂无数据</div>
                )}
              </CardContent>
            </Card>

            {/* Activity Status Pie */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">活动状态分布</CardTitle></CardHeader>
              <CardContent>
                {activityPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={activityPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {activityPieData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">暂无数据</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="ai" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["user_behavior", "content_trend", "operation_suggestion"] as const).map((type) => (
              <Card key={type} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                    {type === "user_behavior" ? <TrendingUp className="h-6 w-6 text-primary" /> :
                     type === "content_trend" ? <BarChart3 className="h-6 w-6 text-primary" /> :
                     <Sparkles className="h-6 w-6 text-primary" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{typeLabels[type]}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {type === "user_behavior" ? "分析用户增长、活跃度和留存趋势" :
                       type === "content_trend" ? "分析内容产出效率和质量趋势" :
                       "基于数据生成可执行的运营建议"}
                    </p>
                  </div>
                  <Button onClick={() => handleGenerate(type)} disabled={generatingType !== null} className="w-full">
                    {generatingType === type ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />生成中...</> : "生成报告"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {generatedContent && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />AI 分析报告</CardTitle></CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <Streamdown>{generatedContent}</Streamdown>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4 mt-4">
          {reports?.data && reports.data.length > 0 ? (
            reports.data.map((report) => (
              <Card key={report.id} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <Badge variant="secondary">{typeLabels[report.type] || report.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(report.generatedAt).toLocaleString("zh-CN")}</p>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none">
                  <Streamdown>{report.content || ""}</Streamdown>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无分析报告，请在"AI 分析"标签页中生成
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
