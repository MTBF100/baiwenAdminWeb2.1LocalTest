import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import DataScreen from "./pages/DataScreen";
import LoginPage from "./pages/login";
import UsersPage from "./pages/Users";
import ArticlesPage from "./pages/Articles";
import ActivitiesPage from "./pages/Activities";
import AnalyticsPage from "./pages/Analytics";
import SyncPage from "./pages/Sync";
import LogsPage from "./pages/Logs";

/**
 * 管理后台页面包装器：用 DashboardLayout 包裹子页面
 * 不使用 wouter nest，避免相对路径匹配问题
 */
function AdminPage({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      {/* 登录页 */}
      <Route path="/login" component={LoginPage} />

      {/* 可视化数据大屏：全屏独立渲染，不走 DashboardLayout */}
      <Route path="/" component={DataScreen} />

      {/* 管理后台：每个路径直接匹配，不使用 nest */}
      <Route path="/users">
        <AdminPage><UsersPage /></AdminPage>
      </Route>
      <Route path="/articles">
        <AdminPage><ArticlesPage /></AdminPage>
      </Route>
      <Route path="/activities">
        <AdminPage><ActivitiesPage /></AdminPage>
      </Route>
      <Route path="/analytics">
        <AdminPage><AnalyticsPage /></AdminPage>
      </Route>
      <Route path="/sync">
        <AdminPage><SyncPage /></AdminPage>
      </Route>
      <Route path="/logs">
        <AdminPage><LogsPage /></AdminPage>
      </Route>

      {/* 404 */}
      <Route>
        <AdminPage><NotFound /></AdminPage>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
