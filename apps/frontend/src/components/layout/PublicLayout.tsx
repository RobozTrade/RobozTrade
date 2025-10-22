import { Outlet, Link } from "react-router-dom";
import { Activity, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { NavbarWalletAuth } from "@/components/auth/NavbarWalletAuth";

export default function PublicLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-light-bg-secondary dark:bg-dark-bg-primary transition-colors duration-300">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-white/70 dark:bg-black/70 border-b border-light-border dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="p-2 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple group-hover:scale-110 transition-transform duration-200">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
                RobozTrade
              </span>
            </Link>

            {/* Right Side: Theme Toggle + Auth Buttons */}
            <div className="flex items-center gap-3">
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

              {/* Wallet Auth */}
              <NavbarWalletAuth />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-140px)]">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-light-border dark:border-dark-border backdrop-blur-2xl bg-white/50 dark:bg-black/50 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            RobozTrade v1.2 · AI-Powered Trading Platform ·{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
