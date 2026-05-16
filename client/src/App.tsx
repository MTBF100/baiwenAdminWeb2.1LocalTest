import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import DataScreen from "./pages/DataScreen";
import Home from "./pages/Home";
import LoginPage from "./pages/login";
import UsersPage from "./pages/Users";
import ArticlesPage from "./pages/Articles";
import ActivitiesPage from "./pages/Activities";
import AnalyticsPage from "./pages/Analytics";
import SyncPage from "./pages/Sync";
import LogsPage from "./pages/Logs";

function Router() {
  return (
    <Switch>
      {/* 登录页 */}
      <Route path="/login" component={LoginPage} />

      {/* 可视化数据大屏：全屏独立渲染，不走 DashboardLayout */}
      <Route path="/" component={DataScreen} />

      {/* 管理后台：所有 /users /articles 等路径走 DashboardLayout 嵌套路由 */}
      <Route path="/:rest*" nest>
        <DashboardLayout>
          <Switch>
            <Route path="/users" component={UsersPage} />
            <Route path="/articles" component={ArticlesPage} />
            <Route path="/activities" component={ActivitiesPage} />
            <Route path="/analytics" component={AnalyticsPage} />
            <Route path="/sync" component={SyncPage} />
            <Route path="/logs" component={LogsPage} />
            <Route path="/dashboard" component={Home} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
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
