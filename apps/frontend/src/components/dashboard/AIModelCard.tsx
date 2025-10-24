import { Bot, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export interface AIModel {
  id: string;
  name: string;
  portfolioValue: number;
  totalPnL: number;
  pnLPercentage: number;
  winRate: number;
  activePositions: number;
  status: "active" | "paused";
  color: string;
  logo?: string;
}

interface AIModelCardProps {
  model: AIModel;
  onClick?: () => void;
}

export function AIModelCard({ model, onClick }: AIModelCardProps) {
  const isProfit = model.totalPnL >= 0;

  return (
    <GlassCard
      hover
      onClick={onClick}
      className="p-6 min-w-[280px] animate-scale-in"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${model.color}20, ${model.color}40)`,
            }}
          >
            {model.logo ? (
              <img
                src={model.logo}
                alt={model.name}
                className="w-5 h-5 object-contain"
              />
            ) : (
              <Bot className="w-5 h-5" style={{ color: model.color }} />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {model.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  model.status === "active"
                    ? "bg-accent-green animate-pulse"
                    : "bg-light-text-tertiary dark:bg-dark-text-tertiary"
                }`}
              />
              <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary capitalize">
                {model.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="mb-4">
        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mb-1">
          Portfolio Value
        </p>
        <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
          $
          {model.portfolioValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </p>
      </div>

      {/* P&L */}
      <div className="mb-4">
        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mb-1">
          Total P&L
        </p>
        <div className="flex items-center gap-2">
          {isProfit ? (
            <TrendingUp className="w-4 h-4 text-accent-green" />
          ) : (
            <TrendingDown className="w-4 h-4 text-accent-red" />
          )}
          <span
            className={`text-lg font-semibold ${
              isProfit ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {isProfit ? "+" : ""}$
            {model.totalPnL.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
          <span
            className={`text-sm ${
              isProfit ? "text-accent-green" : "text-accent-red"
            }`}
          >
            ({isProfit ? "+" : ""}
            {model.pnLPercentage.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 dark:border-white/5">
        <div>
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mb-1">
            Win Rate
          </p>
          <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
            {model.winRate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mb-1">
            Active Positions
          </p>
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-accent-blue" />
            <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
              {model.activePositions}
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
