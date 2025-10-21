import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import Layout from "./components/layout/Layout";
import PublicLayout from "./components/layout/PublicLayout";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import BotsPage from "./features/bots/BotsPage";
import BotDetailPage from "./features/bots/BotDetailPage";
import CreateBotPage from "./features/bots/CreateBotPage";
import MarketPage from "./features/market/MarketPage";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import BenchmarksPage from "./features/benchmarks/BenchmarksPage";
import SettingsPage from "./features/settings/SettingsPage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  return !token ? <>{children}</> : <Navigate to="/" />;
}

function App() {
  return (
    <Routes>
      {/* Public routes with auth buttons */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<DashboardPage />} />
      </Route>

      {/* Auth routes */}
      <Route
        path="/login"
        element={
          <AuthOnlyRoute>
            <LoginPage />
          </AuthOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <AuthOnlyRoute>
            <RegisterPage />
          </AuthOnlyRoute>
        }
      />

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
        <Route path="bots/new" element={<CreateBotPage />} />
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
