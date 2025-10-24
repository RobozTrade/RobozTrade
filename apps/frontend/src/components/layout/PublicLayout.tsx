import { Outlet, Link } from "react-router-dom";
import { Sun, Moon, Mail } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { NavbarWalletAuth } from "@/components/auth/NavbarWalletAuth";
import { FaXTwitter, FaGithub } from "react-icons/fa6";

export default function PublicLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-light-bg-secondary dark:bg-dark-bg-primary transition-colors duration-300">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-white/70 dark:bg-black/70 border-b border-light-border dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
              <img
                src="/logo-text.png"
                alt="RobozTrade"
                className="h-8 sm:h-10 object-contain group-hover:scale-105 transition-transform duration-200"
              />
            </Link>

            {/* Right Side: Theme Toggle + Auth Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20 transition-all duration-200"
                aria-label="Toggle theme"
              >
                {theme === "light" ? (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-light-text-secondary" />
                ) : (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-dark-text-secondary" />
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
      <footer className="border-t border-light-border dark:border-dark-border backdrop-blur-2xl bg-white/50 dark:bg-black/50 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex flex-col items-center gap-3">
            {/* Social Icons */}
            <div className="flex items-center gap-4">
              <a
                href="https://x.com/RobozTrade"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary transition-colors duration-200"
                aria-label="X (Twitter)"
              >
                <FaXTwitter className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary" />
              </a>
              <a
                href="https://github.com/RobozTrade/RobozTrade"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary transition-colors duration-200"
                aria-label="GitHub"
              >
                <FaGithub className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary" />
              </a>
              <a
                href="mailto:trade@roboz.trade"
                className="p-2 rounded-lg hover:bg-light-bg-tertiary dark:hover:bg-dark-bg-tertiary transition-colors duration-200"
                aria-label="Email"
              >
                <Mail className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary" />
              </a>
            </div>

            <img
              src="/logo.png"
              alt="RobozTrade Logo"
              className="h-12 sm:h-16 object-contain"
            />
            <p className="text-xs sm:text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
              RobozTrade v1.2 · AI-Powered Trading Platform ·{" "}
              {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
