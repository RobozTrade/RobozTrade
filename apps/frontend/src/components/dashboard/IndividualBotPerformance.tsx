import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { TradingBot, AIModel } from "@roboz-trade/shared-types";
import { SUPPORTED_AI_MODELS } from "@roboz-trade/shared-types";

interface BotPerformanceData {
  botId: string;
  botName: string;
  totalBalance: number | null;
  unrealizedPnl: number | null;
  accountBalance: number | null;
  executionTime: string | null;
  status: string;
}

interface IndividualBotPerformanceProps {
  onSelectBot?: (botId: string) => void;
}

const getAIModelLogo = (aiModel: AIModel | null | undefined): string => {
  if (!aiModel) return "/ai-icon.svg";
  const modelInfo = SUPPORTED_AI_MODELS.find((m) => m.value === aiModel);
  return modelInfo?.logo ?? "/ai-icon.svg";
};

export function IndividualBotPerformance({
  onSelectBot,
}: IndividualBotPerformanceProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all bots to get AI model information
  const { data: botsData = [] } = useQuery<TradingBot[]>({
    queryKey: ["bots"],
    queryFn: async () => {
      const response = await api.getBots();
      return (response.data ?? []) as TradingBot[];
    },
    staleTime: 60_000,
  });

  // Ensure bots is always an array
  const bots = Array.isArray(botsData) ? botsData : [];

  // Fetch latest bot performance data
  const { data: latestData } = useQuery({
    queryKey: ["bot-performance-latest"],
    queryFn: async () => {
      const response = await api.getBotPerformanceLatest();
      return response.data as BotPerformanceData[];
    },
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  // Fetch initial balances for percentage calculations
  const { data: initialBalances } = useQuery({
    queryKey: ["bot-initial-balances", latestData],
    queryFn: async () => {
      if (!latestData || latestData.length === 0) return {};

      const balancePromises = latestData.map(async (bot) => {
        const response = await api.getBotInitialBalance(bot.botId);
        return {
          botId: bot.botId,
          initialBalance: response.data.initialBalance,
        };
      });

      const results = await Promise.all(balancePromises);
      const balanceMap: Record<string, number> = {};
      results.forEach(({ botId, initialBalance }) => {
        balanceMap[botId] = initialBalance;
      });
      return balanceMap;
    },
    enabled: !!latestData && latestData.length > 0,
  });

  const scroll = (direction: "left" | "right") => {
    if (!containerRef.current) return;
    const scrollAmount = 400;
    const newPosition =
      direction === "left"
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;

    containerRef.current.scrollTo({ left: newPosition, behavior: "smooth" });
    setScrollPosition(newPosition);
  };

  const calculatePercentageChange = (
    current: number | null,
    initial: number | null
  ): number => {
    if (!current || !initial || initial === 0) return 0;
    return ((current - initial) / initial) * 100;
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  if (!latestData || latestData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-light-text-tertiary dark:text-dark-text-tertiary">
          No active bots found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
        Individual Bot Performance
      </h3>

      <div className="relative">
        <div className="flex items-center gap-4">
          {/* Left Arrow */}
          <button
            onClick={() => scroll("left")}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Scroll left"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Bot Cards Container */}
          <div
            ref={containerRef}
            className="flex-1 overflow-x-auto scrollbar-hide"
            style={{ scrollBehavior: "smooth" }}
          >
            <div className="flex gap-4 min-w-max pb-2">
              {latestData.map((bot) => {
                const initialBalance = initialBalances?.[bot.botId] ?? null;
                const balanceChange = calculatePercentageChange(
                  bot.totalBalance,
                  initialBalance
                );
                const pnlPercentage =
                  initialBalance && bot.unrealizedPnl !== null
                    ? (bot.unrealizedPnl / initialBalance) * 100
                    : 0;
                const isProfit = (bot.unrealizedPnl ?? 0) >= 0;
                const botData = bots.find((b) => b.id === bot.botId);

                return (
                  <GlassCard
                    key={bot.botId}
                    className="min-w-[280px] p-4 space-y-3 cursor-pointer hover:bg-white/10 dark:hover:bg-black/20 transition-colors"
                    onClick={() => onSelectBot?.(bot.botId)}
                  >
                    {/* Bot Header */}
                    <div className="flex items-center gap-2">
                      <img
                        src={getAIModelLogo(botData?.aiModel)}
                        alt="AI Model"
                        className="w-6 h-6 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                          {bot.botName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              bot.status === "SUCCESS"
                                ? "bg-accent-green animate-pulse"
                                : bot.status === "FAILED"
                                ? "bg-accent-red"
                                : "bg-light-text-tertiary dark:bg-dark-text-tertiary"
                            }`}
                          />
                          <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                            {bot.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Current Balance */}
                    <div>
                      <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mb-1">
                        Current Balance
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                          {formatCurrency(bot.totalBalance)}
                        </p>
                        <div
                          className={`flex items-center gap-1 text-sm ${
                            balanceChange >= 0
                              ? "text-accent-green"
                              : "text-accent-red"
                          }`}
                        >
                          {balanceChange >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span>{formatPercentage(balanceChange)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Unrealized P&L */}
                    <div className="pt-3 border-t border-white/10 dark:border-white/5">
                      <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mb-1">
                        Unrealized P&L
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p
                          className={`text-lg font-semibold ${
                            isProfit ? "text-accent-green" : "text-accent-red"
                          }`}
                        >
                          {formatCurrency(bot.unrealizedPnl)}
                        </p>
                        <span
                          className={`text-sm ${
                            isProfit ? "text-accent-green" : "text-accent-red"
                          }`}
                        >
                          {formatPercentage(pnlPercentage)}
                        </span>
                      </div>
                    </div>

                    {/* Last Updated */}
                    {bot.executionTime && (
                      <div className="pt-2">
                        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                          Last updated:{" "}
                          {new Date(bot.executionTime).toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </div>

          {/* Right Arrow */}
          <button
            onClick={() => scroll("right")}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Scroll right"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
