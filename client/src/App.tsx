import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
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

    <Route path="/login" component={LoginPage} />


    <Route path="/" nest>
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/users" component={UsersPage} />
        <Route path="/articles" component={ArticlesPage} />
        <Route path="/activities" component={ActivitiesPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/sync" component={SyncPage} />
        <Route path="/logs" component={LogsPage} />
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
