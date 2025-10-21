import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  TrendingUp,
  BarChart3,
  Target,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Trading Bots", href: "/app/bots", icon: Bot },
  { name: "Market", href: "/app/market", icon: TrendingUp },
  { name: "Analytics", href: "/app/analytics", icon: BarChart3 },
  { name: "Benchmarks", href: "/app/benchmarks", icon: Target },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <div className="w-64 backdrop-blur-2xl bg-white/70 dark:bg-black/70 border-r border-light-border dark:border-dark-border flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
          RobozTrade
        </h1>
        <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
          AI Trading Platform
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
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
