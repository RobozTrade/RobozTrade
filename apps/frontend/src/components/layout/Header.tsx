import { useNavigate } from "react-router-dom";
import { LogOut, User, Sun, Moon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/contexts/ThemeContext";
import { GlassButton } from "@/components/ui/GlassCard";

export default function Header() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="h-16 backdrop-blur-2xl bg-white/70 dark:bg-black/70 border-b border-light-border dark:border-dark-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
          Welcome back, {user?.displayName}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20 transition-all duration-200"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5 text-light-text-secondary" />
          ) : (
            <Sun className="w-5 h-5 text-dark-text-secondary" />
          )}
        </button>

        <div className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
          <User className="w-5 h-5" />
          <span className="text-sm">{user?.email}</span>
        </div>

        <GlassButton onClick={handleLogout} variant="secondary" size="sm">
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </div>
        </GlassButton>
      </div>
    </header>
  );
}
