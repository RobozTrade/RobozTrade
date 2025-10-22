import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import Layout from "./components/layout/Layout";
import PublicLayout from "./components/layout/PublicLayout";
import DashboardPage from "./features/dashboard/DashboardPage";
import BotsPage from "./features/bots/BotsPage";
import BotDetailPage from "./features/bots/BotDetailPage";
import CreateBotPage from "./features/bots/CreateBotPage";
import CreateBotPageNew from "./features/bots/CreateBotPageNew";
import MarketPage from "./features/market/MarketPage";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import BenchmarksPage from "./features/benchmarks/BenchmarksPage";
import SettingsPage from "./features/settings/SettingsPage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  // If not authenticated, redirect to home page where they can connect wallet
  return token ? <>{children}</> : <Navigate to="/" />;
}

function App() {
  return (
    <Routes>
      {/* Public routes with auth buttons */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<DashboardPage />} />
      </Route>

      {/* Redirect old auth routes to home (wallet auth is in navbar) */}
      <Route path="/login" element={<Navigate to="/" />} />
      <Route path="/register" element={<Navigate to="/" />} />

      {/* Private routes with sidebar */}
      <Route
        path="/app"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="bots" element={<BotsPage />} />
        <Route path="bots/new" element={<CreateBotPageNew />} />
        <Route path="bots/new-legacy" element={<CreateBotPage />} />
        <Route path="bots/:id" element={<BotDetailPage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="benchmarks" element={<BenchmarksPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
