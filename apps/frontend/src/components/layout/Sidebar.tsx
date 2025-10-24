import { NavLink } from "react-router-dom";
import { LayoutDashboard, Bot, BarChart3, History, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Trading Bots", href: "/app/bots", icon: Bot },
  { name: "Analytics", href: "/app/analytics", icon: BarChart3 },
  { name: "Trade History", href: "/app/trade-history", icon: History },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  return (
    <div className="w-64 h-full backdrop-blur-2xl bg-white/70 dark:bg-black/70 border-r border-light-border dark:border-dark-border flex flex-col">
      <div className="p-6 flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <img
            src="/logo-text.png"
            alt="RobozTrade"
            className="h-10 object-contain"
          />
          <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            AI Trading Platform
          </p>
        </div>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-accent-blue text-white shadow-glow"
                  : "text-light-text-secondary dark:text-dark-text-secondary hover:bg-white/20 dark:hover:bg-black/20 hover:text-light-text-primary dark:hover:text-dark-text-primary"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-light-border dark:border-dark-border">
        <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
          <p>Version 2.0.0</p>
          <p className="mt-1">© {new Date().getFullYear()} RobozTrade</p>
        </div>
      </div>
    </div>
  );
}
