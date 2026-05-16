/**
 * DataScreen.tsx — 可视化数据大屏
 * 全屏独立渲染，不依赖 DashboardLayout
 * 布局：顶部 KPI | 左侧用户生态 | 中央内容热力 | 右侧内容与活动
 */
import { useEffect, useRef, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { LogOut, RefreshCw } from "lucide-react";

// ─── 全局色彩常量 ────────────────────────────────────────────────
const BG = "#0B0F19";
const PANEL_BG = "rgba(255,255,255,0.03)";
const BORDER = "rgba(0,242,254,0.15)";
const NEON = "#00F2FE";
const NEON2 = "#4FACFE";
const NEON_AMBER = "#F6D365";
const NEON_GREEN = "#43E97B";
const NEON_RED = "#F5576C";
const TEXT_DIM = "rgba(255,255,255,0.45)";
const TEXT_MAIN = "rgba(255,255,255,0.88)";
const GRID_LINE = "rgba(255,255,255,0.05)";

// ─── 工具函数 ────────────────────────────────────────────────────
function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

// ─── 子组件：面板容器 ────────────────────────────────────────────
function Panel({
  title,
  children,
  className = "",
  style,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "12px 14px",
        backdropFilter: "blur(6px)",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: NEON,
          textTransform: "uppercase",
          marginBottom: 8,
          borderBottom: `1px solid ${BORDER}`,
          paddingBottom: 6,
        }}
      >
        {title}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ─── 子组件：KPI 卡片 ────────────────────────────────────────────
function KpiCard({
  label,
  value,
  color = NEON,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon: string;
}) {
  return (
    <div
      style={{
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flex: 1,
        backdropFilter: "blur(6px)",
        boxShadow: `0 0 16px ${color}18`,
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 12px ${color}80`,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: TEXT_DIM, letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────
export default function DataScreen() {
  const { logout, user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tick, setTick] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // 认证守卫：未登录跳转到登录页
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  // 定时刷新（30s）
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // 数据请求
  const { data: kpi } = trpc.screen.kpi.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: device } = trpc.screen.deviceStats.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: growth } = trpc.screen.userGrowth.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: ai } = trpc.screen.aiActivity.useQuery(undefined, { refetchInterval: 15_000 });
  const { data: bubble } = trpc.screen.articleBubble.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: coins } = trpc.screen.coinsFeed.useQuery(undefined, { refetchInterval: 15_000 });
  const { data: topArt } = trpc.screen.topArticles.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: acts } = trpc.screen.activities.useQuery(undefined, { refetchInterval: 60_000 });

  // 退出大屏：不清除 session，直接跳转管理后台用户管理页
  const handleExitScreen = useCallback(() => {
    setLocation("/users");
  }, [setLocation]);

  // 流水墙自动滚动
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const id = setInterval(() => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
        el.scrollTop = 0;
      } else {
        el.scrollTop += 28;
      }
    }, 2000);
    return () => clearInterval(id);
  }, [coins]);

  // 认证加载占位
  if (loading) {
    return (<div style={{ width: "100vw", height: "100vh", background: "#0B0F19", display: "flex", alignItems: "center", justifyContent: "center", color: "#00F2FE", fontSize: 14 }}>数据加载中…</div>);
  }
  if (!user) return null;

  // ── ECharts 配置 ──────────────────────────────────────────────

  // 圆环图：设备 OS
  const osOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: {
      bottom: 0,
      textStyle: { color: TEXT_DIM, fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "44%"],
        data: device?.osDist?.length
          ? device.osDist.map((d, i) => ({
              name: d.name,
              value: d.value,
              itemStyle: {
                color: [NEON, NEON_AMBER, NEON_GREEN, NEON_RED, NEON2][i % 5],
              },
            }))
          : [{ name: "暂无数据", value: 1, itemStyle: { color: BORDER } }],
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: NEON },
        },
      },
    ],
  };

  // 条形图：Top5 机型
  const modelOption = {
    backgroundColor: "transparent",
    grid: { top: 4, bottom: 20, left: 8, right: 8, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: TEXT_DIM, fontSize: 9 },
    },
    yAxis: {
      type: "category",
      data: device?.top5Models?.map((m) => m.model) ?? [],
      axisLabel: { color: TEXT_MAIN, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: device?.top5Models?.map((m) => m.count) ?? [],
        barMaxWidth: 14,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: "linear",
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: NEON2 },
              { offset: 1, color: NEON },
            ],
          },
        },
        label: {
          show: true,
          position: "right",
          color: TEXT_DIM,
          fontSize: 9,
        },
      },
    ],
    tooltip: { trigger: "axis" },
  };

  // 面积折线图：用户增长
  const growthOption = {
    backgroundColor: "transparent",
    grid: { top: 10, bottom: 24, left: 8, right: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: growth?.monthly?.map((m) => m.month) ?? [],
      axisLabel: { color: TEXT_DIM, fontSize: 9 },
      axisLine: { lineStyle: { color: BORDER } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: TEXT_DIM, fontSize: 9 },
    },
    series: [
      {
        type: "line",
        data: growth?.monthly?.map((m) => m.count) ?? [],
        smooth: true,
        symbol: "none",
        lineStyle: { color: NEON, width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${NEON}55` },
              { offset: 1, color: `${NEON}00` },
            ],
          },
        },
      },
    ],
    tooltip: { trigger: "axis" },
  };

  // 气泡图：文章分类热力
  const maxBrowse = Math.max(...(bubble?.bubbles?.map((b) => b.totalBrowse) ?? [1]), 1);
  const bubbleOption = {
    backgroundColor: "transparent",
    tooltip: {
      formatter: (p: any) => {
        const d = p.data;
        return `<b>${d[3]}</b><br/>浏览: ${d[0]}<br/>点赞: ${d[1]}<br/>文章: ${d[2]}`;
      },
    },
    xAxis: {
      type: "value",
      name: "浏览量",
      nameTextStyle: { color: TEXT_DIM, fontSize: 9 },
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: TEXT_DIM, fontSize: 9 },
    },
    yAxis: {
      type: "value",
      name: "点赞",
      nameTextStyle: { color: TEXT_DIM, fontSize: 9 },
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: TEXT_DIM, fontSize: 9 },
    },
    series: [
      {
        type: "scatter",
        symbolSize: (val: number[]) =>
          Math.max(12, Math.min(60, (val[0] / maxBrowse) * 60)),
        data: bubble?.bubbles?.map((b) => [
          b.totalBrowse,
          b.totalLike,
          b.articleCount,
          b.tag,
        ]) ?? [],
        itemStyle: {
          color: (p: any) => {
            const ratio = p.data[1] / (p.data[0] + 1);
            const h = Math.round(180 + ratio * 60);
            return `oklch(0.65 0.2 ${h})`;
          },
          opacity: 0.85,
          shadowBlur: 12,
          shadowColor: `${NEON}60`,
        },
        label: {
          show: true,
          formatter: (p: any) => p.data[3],
          color: TEXT_MAIN,
          fontSize: 10,
          position: "inside",
        },
      },
    ],
  };

  // 胶囊条形图：热门文章 Top5
  const maxView = Math.max(...(topArt?.top5?.map((a) => a.viewCount ?? 0) ?? [1]), 1);
  const topArticlesOption = {
    backgroundColor: "transparent",
    grid: { top: 4, bottom: 20, left: 8, right: 8, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: GRID_LINE } },
      axisLabel: { color: TEXT_DIM, fontSize: 9 },
      max: maxView * 1.15,
    },
    yAxis: {
      type: "category",
      data: topArt?.top5?.map((a) =>
        (a.title ?? "").length > 12 ? (a.title ?? "").slice(0, 12) + "…" : (a.title ?? "")
      ) ?? [],
      axisLabel: { color: TEXT_MAIN, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: topArt?.top5?.map((a) => a.viewCount ?? 0) ?? [],
        barMaxWidth: 16,
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: {
            type: "linear",
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: NEON_AMBER },
              { offset: 1, color: "#F093FB" },
            ],
          },
        },
        label: {
          show: true,
          position: "right",
          color: TEXT_DIM,
          fontSize: 9,
          formatter: (p: any) => fmt(p.value),
        },
      },
    ],
    tooltip: { trigger: "axis" },
  };

  // 活动状态颜色
  const statusColor: Record<string, string> = {
    active: NEON_GREEN,
    pending: NEON_AMBER,
    ended: TEXT_DIM,
  };
  const statusLabel: Record<string, string> = {
    active: "进行中",
    pending: "待开始",
    ended: "已结束",
  };

  // AI 活跃率
  const aiRate =
    ai?.totalCount && ai.totalCount > 0
      ? Math.min(100, Math.round((ai.todayCount / ai.totalCount) * 100 * 10))
      : 0;

  // ── 渲染 ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: BG,
        color: TEXT_MAIN,
        fontFamily: "'SF Pro Display', 'PingFang SC', 'Helvetica Neue', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "fixed",
        inset: 0,
        zIndex: 100,
      }}
    >
      {/* ── 顶部标题栏 ── */}
      <header
        style={{
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: `1px solid ${BORDER}`,
          background: "rgba(11,15,25,0.9)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
        }}
      >
        {/* 左：品牌 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 6,
              height: 24,
              borderRadius: 3,
              background: `linear-gradient(to bottom, ${NEON}, ${NEON2})`,
              boxShadow: `0 0 8px ${NEON}`,
            }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.06em",
              background: `linear-gradient(90deg, ${NEON}, ${NEON2})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            百文 · 数据大屏
          </span>
          <span
            style={{
              fontSize: 10,
              color: TEXT_DIM,
              letterSpacing: "0.08em",
              marginLeft: 4,
            }}
          >
            ONLINE BAIWEN ANALYTICS
          </span>
        </div>

        {/* 中：KPI 快览 */}
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {[
            { label: "注册用户", value: fmt(kpi?.userCount), color: NEON },
            { label: "平台文章", value: fmt(kpi?.articleCount), color: NEON2 },
            { label: "总浏览量", value: fmt(kpi?.totalPv), color: NEON_AMBER },
            { label: "打赏流通", value: fmt(kpi?.totalCoins), color: NEON_GREEN },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: item.color,
                  textShadow: `0 0 10px ${item.color}80`,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: TEXT_DIM, letterSpacing: "0.06em" }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* 右：时间 + 退出 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LiveClock />
          <button
            onClick={handleExitScreen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${BORDER}`,
              background: "rgba(245,87,108,0.12)",
              color: NEON_RED,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "rgba(245,87,108,0.25)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "rgba(245,87,108,0.12)")
            }
          >
            <LogOut size={13} />
            退出大屏
          </button>
        </div>
      </header>

      {/* ── 主体三栏 ── */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "280px 1fr 300px",
          gap: 10,
          padding: 10,
          minHeight: 0,
        }}
      >
        {/* ── 左侧栏 ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          {/* A: 用户活跃分层 */}
          <Panel title="用户活跃度分层" className="flex-none" style={{ height: 220 }}>
            <ReactECharts
              option={osOption}
              style={{ height: 140 }}
              opts={{ renderer: "canvas" }}
            />
          </Panel>

          {/* Top5 手机型号 */}
          <Panel title="Top 5 手机型号" className="flex-none" style={{ height: 160 }}>
            <ReactECharts
              option={modelOption}
              style={{ height: 120 }}
              opts={{ renderer: "canvas" }}
            />
          </Panel>

          {/* B: 用户增长趋势 */}
          <Panel title={`用户增长趋势（${growth?.peakMonth ?? ''}）`} className="flex-1">
            <ReactECharts
              option={growthOption}
              style={{ height: "100%", minHeight: 100 }}
              opts={{ renderer: "canvas" }}
            />
          </Panel>

          {/* C: 松果 AI 活跃度 */}
          <Panel title="松果 AI 助手活跃度" className="flex-none" style={{ height: 180 }}>
            <div style={{ display: "flex", gap: 10, height: "100%" }}>
              {/* 水波仪表 */}
              <div
                style={{
                  flex: "0 0 90px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <WaveMeter value={aiRate} color={NEON} />
                <div style={{ fontSize: 10, color: TEXT_DIM, textAlign: "center" }}>
                  今日 / 总量
                  <br />
                  <span style={{ color: NEON, fontWeight: 600 }}>
                    {ai?.todayCount ?? 0}
                  </span>
                  {" / "}
                  <span style={{ color: TEXT_MAIN }}>{fmt(ai?.totalCount)}</span>
                </div>
              </div>
              {/* 问答配对自动流动弹幕 */}
              <AiChatScroller questions={ai?.recentQuestions ?? []} />
            </div>
          </Panel>
        </div>

        {/* ── 中央栏 ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          {/* 气泡图 */}
          <Panel title="文章热力图（气泡大小 = 浏览量，颜色 = 点赞率）" className="flex-1">
            <ReactECharts
              option={bubbleOption}
              style={{ height: "100%", minHeight: 200 }}
              opts={{ renderer: "canvas" }}
            />
          </Panel>

          {/* 流水墙 */}
          <Panel title="平台官方账号流水动态" className="flex-none" style={{ height: 180 }}>
            {(coins?.feed ?? []).length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: TEXT_DIM,
                  fontSize: 12,
                }}
              >
                暂无打赏记录
              </div>
            ) : (
              <div
                ref={feedRef}
                style={{
                  height: 130,
                  overflowY: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {(coins?.feed ?? []).map((tx) => {
                  const OFFICIAL = '6d99dae869970b5a01151dce5b866f7c';
                  const isOut = tx.senderId === OFFICIAL; // 官方发出
                  const accentColor = isOut ? NEON_RED : NEON_GREEN;
                  const dirLabel = isOut ? '发出' : '收入';
                  const counterpart = isOut
                    ? (tx.receiverId ?? '').slice(-6) || '用户'
                    : (tx.senderId ?? '').slice(-6) || '用户';
                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: `${accentColor}06`,
                        borderLeft: `2px solid ${accentColor}60`,
                        fontSize: 11,
                        color: TEXT_MAIN,
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 9, color: accentColor, fontWeight: 700, flexShrink: 0, border: `1px solid ${accentColor}50`, borderRadius: 3, padding: "1px 4px" }}>
                        {dirLabel}
                      </span>
                      <span style={{ color: TEXT_DIM, fontSize: 10 }}>
                        {tx.action ?? '流水'}
                      </span>
                      <span style={{ color: NEON2, fontWeight: 500 }}>
                        {counterpart}
                      </span>
                      <span style={{ color: TEXT_DIM, fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.reason ? `· ${tx.reason}` : ''}
                      </span>
                      <span style={{ color: accentColor, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {isOut ? '-' : '+'}{tx.coinAmount ?? 0}
                        <span style={{ fontSize: 9, color: TEXT_DIM, marginLeft: 2 }}>
                          {tx.coinType === 'gold' ? '金币' : '银币'}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ── 右侧栏 ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          {/* D: 热门文章 Top5 */}
          <Panel title="热门文章排行 Top 5" className="flex-none" style={{ height: 220 }}>
            <ReactECharts
              option={topArticlesOption}
              style={{ height: 180 }}
              opts={{ renderer: "canvas" }}
            />
          </Panel>

          {/* E: 活动生命周期 */}
          <Panel title="营销活动生命周期" className="flex-1">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                overflowY: "auto",
                height: "100%",
              }}
            >
              {(acts?.activities ?? []).length === 0 && (
                <div style={{ color: TEXT_DIM, fontSize: 12 }}>暂无活动数据</div>
              )}
              {(acts?.activities ?? []).map((act) => {
                const color = statusColor[act.status ?? "ended"] ?? TEXT_DIM;
                const label = statusLabel[act.status ?? "ended"] ?? "未知";
                const now = Date.now();
                const start = act.startDate ?? now;
                const end = act.endDate ?? now;
                const total = Math.max(end - start, 1);
                const progress =
                  act.status === "active"
                    ? Math.min(100, Math.round(((now - start) / total) * 100))
                    : act.status === "ended"
                    ? 100
                    : 0;
                return (
                  <div
                    key={act.id}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${color}30`,
                      borderRadius: 6,
                      padding: "8px 10px",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: TEXT_MAIN,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {act.name ?? "未命名活动"}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color,
                          background: `${color}18`,
                          borderRadius: 4,
                          padding: "1px 6px",
                          marginLeft: 6,
                          flexShrink: 0,
                          border: `1px solid ${color}40`,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {/* 进度条 */}
                    <div
                      style={{
                        height: 4,
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${progress}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}80)`,
                          borderRadius: 2,
                          transition: "width 0.5s ease",
                          boxShadow: `0 0 6px ${color}60`,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 4,
                        fontSize: 9,
                        color: TEXT_DIM,
                      }}
                    >
                      <span>
                        {act.startDate
                          ? new Date(act.startDate).toLocaleDateString("zh-CN")
                          : "—"}
                      </span>
                      <span>{progress}%</span>
                      <span>
                        {act.endDate
                          ? new Date(act.endDate).toLocaleDateString("zh-CN")
                          : "—"}
                      </span>
                    </div>
                    {act.statusMess && (
                      <div
                        style={{
                          fontSize: 9,
                          color: TEXT_DIM,
                          marginTop: 3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {act.statusMess}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* 底部装饰线 */}
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${NEON}, ${NEON2}, transparent)`,
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// ─── 实时时钟组件 ────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: NEON,
          fontVariantNumeric: "tabular-nums",
          textShadow: `0 0 8px ${NEON}60`,
        }}
      >
        {time.toLocaleTimeString("zh-CN", { hour12: false })}
      </div>
      <div style={{ fontSize: 9, color: TEXT_DIM }}>
        {time.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          weekday: "short",
        })}
      </div>
    </div>
  );
}

// ─── 水波仪表组件 ────────────────────────────────────────────────
function WaveMeter({ value, color }: { value: number; color: string }) {
  const size = 72;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const pct = Math.min(100, Math.max(0, value)) / 100;
  const fillY = cy + r - pct * 2 * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <clipPath id="circle-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <linearGradient id="wave-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {/* 背景圆 */}
      <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.05)" />
      {/* 填充 */}
      <rect
        x={cx - r}
        y={fillY}
        width={r * 2}
        height={cy + r - fillY}
        fill="url(#wave-grad)"
        clipPath="url(#circle-clip)"
      />
      {/* 边框 */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* 数值 */}
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fill={color}
        fontSize={14}
        fontWeight="700"
      >
        {value}‰
      </text>
    </svg>
  );
}

// ─── AI 问答配对自动流动弹幕 ───────────────────────────────────────────
const CHAT_COLORS = [NEON, NEON2, NEON_GREEN, NEON_AMBER, "#A78BFA", "#F472B6", "#FB923C", "#34D399", "#60A5FA", "#C084FC"];

function AiChatScroller({ questions }: { questions: { id: number; question: string; answer: string; nick: string }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = setInterval(() => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
        el.scrollTop = 0;
      } else {
        el.scrollTop += 1;
      }
    }, 60);
    return () => clearInterval(id);
  }, [questions]);

  if (questions.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_DIM, fontSize: 10 }}>
        暂无数据
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        paddingTop: 2,
      }}
    >
      {questions.map((q, i) => {
        const c = CHAT_COLORS[i % CHAT_COLORS.length];
        return (
          <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            {/* 用户提问 */}
            <div
              style={{
                fontSize: 10,
                background: `${c}0A`,
                borderRadius: 4,
                padding: "3px 6px",
                borderLeft: `2px solid ${c}70`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ color: c, fontWeight: 600 }}>{q.nick}</span>
              <span style={{ color: TEXT_DIM, margin: "0 3px" }}>问:</span>
              <span style={{ color: c, opacity: 0.85 }}>{q.question || '…'}</span>
            </div>
            {/* AI 回复 */}
            <div
              style={{
                fontSize: 10,
                background: "rgba(255,255,255,0.02)",
                borderRadius: 4,
                padding: "3px 6px",
                borderLeft: `2px solid ${NEON}40`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginLeft: 8,
              }}
            >
              <span style={{ color: NEON, fontWeight: 600 }}>🤖 AI</span>
              <span style={{ color: TEXT_DIM, margin: "0 3px" }}>答:</span>
              <span style={{ color: NEON_GREEN, opacity: 0.85 }}>{q.answer || '…'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
