import { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
  MouseEventParams,
} from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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

interface BotPerformanceHistory {
  id: string;
  executionTime: string;
  totalBalance: number | null;
  unrealizedPnl: number | null;
  accountBalance: number | null;
  accountExposure: number | null;
  tradesExecuted: number;
  status: string;
}

interface BotDataPoint {
  botId: string;
  botName: string;
  totalBalance: number;
  unrealizedPnl: number;
  color: string;
}

type ChartMode = "unrealized_pnl" | "account_balance";

const BOT_COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
];

const getAIModelLogo = (aiModel: AIModel | null | undefined): string => {
  if (!aiModel) return "/ai-icon.svg";
  const modelInfo = SUPPORTED_AI_MODELS.find((m) => m.value === aiModel);
  return modelInfo?.logo ?? "/ai-icon.svg";
};

interface BotPerformanceChartProps {
  selectedSingleBotId?: string | null;
  walletAddress?: string; // If provided, use public API endpoints for specific wallet
  showAllPublicBots?: boolean; // If true, show all public bots (no wallet filter)
}

export function BotPerformanceChart({
  selectedSingleBotId,
  walletAddress,
  showAllPublicBots = false,
}: BotPerformanceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const [chartMode, setChartMode] = useState<ChartMode>("unrealized_pnl");
  const [legendScrollPosition, setLegendScrollPosition] = useState(0);
  const legendContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipData, setTooltipData] = useState<BotDataPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedBots, setSelectedBots] = useState<Set<string> | null>(null); // null = show all, Set = show selected

  // Map to store bot data for each series
  const botDataMapRef = useRef<Map<string, Map<number, BotDataPoint>>>(
    new Map()
  );

  // Fetch all bots to get AI model information
  const { data: botsData = [] } = useQuery<TradingBot[]>({
    queryKey: showAllPublicBots
      ? ["all-public-bots"]
      : walletAddress
      ? ["public-bots", walletAddress]
      : ["bots"],
    queryFn: async () => {
      const response = showAllPublicBots
        ? await api.getAllPublicBots()
        : walletAddress
        ? await api.getPublicBots(walletAddress)
        : await api.getBots();
      return (response.data ?? []) as TradingBot[];
    },
    staleTime: 60_000,
  });

  // Ensure bots is always an array
  const bots = Array.isArray(botsData) ? botsData : [];

  // Fetch latest bot performance data
  const { data: latestData } = useQuery({
    queryKey: showAllPublicBots
      ? ["all-public-bot-performance-latest"]
      : walletAddress
      ? ["public-bot-performance-latest", walletAddress]
      : ["bot-performance-latest"],
    queryFn: async () => {
      const response = showAllPublicBots
        ? await api.getAllPublicBotPerformanceLatest()
        : walletAddress
        ? await api.getPublicBotPerformanceLatest(walletAddress)
        : await api.getBotPerformanceLatest();
      return response.data as BotPerformanceData[];
    },
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  // Fetch performance history for all bots
  const { data: historyData } = useQuery({
    queryKey: showAllPublicBots
      ? ["all-public-bot-performance-history", latestData]
      : walletAddress
      ? ["public-bot-performance-history", walletAddress, latestData]
      : ["bot-performance-history", latestData],
    queryFn: async () => {
      if (!latestData || latestData.length === 0) return {};

      const historyPromises = latestData.map(async (bot) => {
        const response = showAllPublicBots
          ? await api.getAllPublicBotPerformanceHistory(bot.botId, 100)
          : walletAddress
          ? await api.getPublicBotPerformanceHistory(
              walletAddress,
              bot.botId,
              100
            )
          : await api.getBotPerformanceHistory(bot.botId, 100);
        return {
          botId: bot.botId,
          history: response.data as BotPerformanceHistory[],
        };
      });

      const results = await Promise.all(historyPromises);
      const historyMap: Record<string, BotPerformanceHistory[]> = {};
      results.forEach(({ botId, history }) => {
        historyMap[botId] = history;
      });
      return historyMap;
    },
    enabled: !!latestData && latestData.length > 0,
  });

  // Fetch initial balances for all bots
  const { data: initialBalances } = useQuery({
    queryKey: showAllPublicBots
      ? ["all-public-bot-initial-balances", latestData]
      : walletAddress
      ? ["public-bot-initial-balances", walletAddress, latestData]
      : ["bot-initial-balances", latestData],
    queryFn: async () => {
      if (!latestData || latestData.length === 0) return {};

      const balancePromises = latestData.map(async (bot) => {
        const response = showAllPublicBots
          ? await api.getAllPublicBotInitialBalance(bot.botId)
          : walletAddress
          ? await api.getPublicBotInitialBalance(walletAddress, bot.botId)
          : await api.getBotInitialBalance(bot.botId);
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

  // Calculate minimum initial balance for normalization
  const minInitialBalance = initialBalances
    ? Math.min(
        ...Object.values(initialBalances).filter((b) => b !== null && b > 0)
      )
    : null;

  // Handle legend item click
  const handleLegendClick = (botId: string) => {
    setSelectedBots((prev) => {
      if (prev === null) {
        // Currently showing all, select only this bot
        return new Set([botId]);
      } else if (prev.has(botId)) {
        // Bot is selected, remove it
        const newSet = new Set(prev);
        newSet.delete(botId);
        // If no bots selected, show all
        return newSet.size === 0 ? null : newSet;
      } else {
        // Bot not selected, add it
        return new Set([...prev, botId]);
      }
    });
  };

  // Clear selection to show all bots
  const clearSelection = () => {
    setSelectedBots(null);
  };

  // Get filtered data based on selection
  const getFilteredData = () => {
    if (selectedSingleBotId) {
      // When single bot is selected, show only that bot
      return (
        latestData?.filter((bot) => bot.botId === selectedSingleBotId) || []
      );
    }
    if (!latestData || selectedBots === null) return latestData;
    return latestData.filter((bot) => selectedBots.has(bot.botId));
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
    });

    chartRef.current = chart;

    // Add crosshair move handler for tooltip
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.point || !param.time || !chartContainerRef.current) {
        setTooltipData(null);
        return;
      }

      // Find which series is being hovered
      const seriesData = param.seriesData;
      let hoveredBotData: BotDataPoint | null = null;

      seriesData.forEach((data, series) => {
        if (data && "value" in data) {
          // Find the bot ID for this series
          for (const [botId, seriesRef] of seriesRefs.current.entries()) {
            if (seriesRef === series) {
              const timestamp = param.time as number;
              const botDataMap = botDataMapRef.current.get(botId);
              if (botDataMap) {
                hoveredBotData = botDataMap.get(timestamp) || null;
              }
              break;
            }
          }
        }
      });

      if (hoveredBotData) {
        setTooltipData(hoveredBotData);
        setTooltipPosition({
          x: param.point.x,
          y: param.point.y,
        });
      } else {
        setTooltipData(null);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data when mode, history, or initial balances change
  useEffect(() => {
    if (!chartRef.current || !historyData || !initialBalances || !latestData)
      return;

    // Clear existing series and data maps
    seriesRefs.current.forEach((series) => {
      try {
        if (series && chartRef.current) {
          chartRef.current.removeSeries(series);
        }
      } catch (error) {
        // Series may have already been removed
        console.warn("Failed to remove series:", error);
      }
    });
    seriesRefs.current.clear();
    botDataMapRef.current.clear();

    // Get filtered data based on selection
    const filteredData = getFilteredData();
    if (!filteredData) return;

    // Create a line series for each bot
    filteredData.forEach((bot, index) => {
      const history = historyData[bot.botId];
      if (!history || history.length === 0) return;

      const initialBalance = initialBalances[bot.botId];
      if (!initialBalance) return;

      const color = BOT_COLORS[index % BOT_COLORS.length];

      // Configure series based on chart mode
      const seriesOptions: any = {
        color,
        lineWidth: 2,
        title: bot.botName,
      };

      const series = chartRef.current!.addLineSeries(seriesOptions);

      // Create a map to store bot data for each timestamp
      const botDataMap = new Map<number, BotDataPoint>();

      // Transform history data based on chart mode
      const data: LineData[] = history
        .map((entry) => {
          const timestamp = new Date(entry.executionTime).getTime() / 1000;
          let value: number;

          if (chartMode === "unrealized_pnl") {
            // Show unrealized P&L as percentage
            value =
              entry.unrealizedPnl !== null && initialBalance > 0
                ? (entry.unrealizedPnl / initialBalance) * 100
                : 0;
          } else {
            // Show account balance as absolute dollar value
            value = entry.totalBalance ?? entry.accountBalance ?? 0;
          }

          // Store bot data for tooltip
          botDataMap.set(timestamp, {
            botId: bot.botId,
            botName: bot.botName,
            totalBalance: entry.totalBalance ?? entry.accountBalance ?? 0,
            unrealizedPnl: entry.unrealizedPnl ?? 0,
            color,
          });

          return {
            time: timestamp as Time,
            value,
          };
        })
        .filter((d) => !isNaN(d.value))
        .sort((a, b) => (a.time as number) - (b.time as number));

      if (data.length > 0) {
        series.setData(data);
        seriesRefs.current.set(bot.botId, series);
        botDataMapRef.current.set(bot.botId, botDataMap);
      }
    });

    // Configure Y-axis based on mode
    if (chartMode === "account_balance") {
      // Show dollar values on Y-axis
      chartRef.current.applyOptions({
        localization: {
          priceFormatter: (price: number) => {
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(price);
          },
        },
      });
    } else {
      // Show percentage values on Y-axis
      chartRef.current.applyOptions({
        localization: {
          priceFormatter: (price: number) => {
            return `${price.toFixed(2)}%`;
          },
        },
      });
    }

    // Fit content and auto-scale
    chartRef.current.timeScale().fitContent();

    // Add middle point indicator line after a delay to ensure data is rendered
    setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();

        // Calculate the middle value based on chart mode
        let middleValue: number;
        let middleLabel: string;

        if (chartMode === "unrealized_pnl") {
          // For P&L mode, middle point is 0 (break-even)
          middleValue = 0;
          middleLabel = "Break Even (0%)";
        } else {
          // For account balance mode, middle point is the average initial balance
          const initialBalanceValues = Object.values(initialBalances);
          const avgInitialBalance =
            initialBalanceValues.reduce((sum, bal) => sum + bal, 0) /
            initialBalanceValues.length;
          middleValue = avgInitialBalance;
          middleLabel = "Initial Balance";
        }

        // Add horizontal line at the middle point
        // We'll add it to the first series if available
        const firstSeries = Array.from(seriesRefs.current.values())[0];
        if (firstSeries) {
          firstSeries.createPriceLine({
            price: middleValue,
            color: "rgba(255, 255, 255, 0.4)",
            lineWidth: 2,
            lineStyle: 2, // Dashed line
            axisLabelVisible: true,
            title: middleLabel,
          });
        }
      }
    }, 100);
  }, [
    chartMode,
    historyData,
    initialBalances,
    latestData,
    selectedBots,
    selectedSingleBotId,
  ]);

  // Legend scroll handlers
  const scrollLegend = (direction: "left" | "right") => {
    if (!legendContainerRef.current) return;
    const scrollAmount = 300;
    const newPosition =
      direction === "left"
        ? Math.max(0, legendScrollPosition - scrollAmount)
        : legendScrollPosition + scrollAmount;

    legendContainerRef.current.scrollTo({
      left: newPosition,
      behavior: "smooth",
    });
    setLegendScrollPosition(newPosition);
  };

  // No normalization message needed since we show absolute values in Account Balance mode
  const showNormalizationMessage = false;

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
          Bot Performance
        </h3>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 bg-white/5 dark:bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setChartMode("unrealized_pnl")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartMode === "unrealized_pnl"
                ? "bg-accent-green text-white"
                : "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
            }`}
          >
            Unrealized P&L
          </button>
          <button
            onClick={() => setChartMode("account_balance")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartMode === "account_balance"
                ? "bg-accent-green text-white"
                : "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
            }`}
          >
            Account Balance
          </button>
        </div>
      </div>

      {/* Chart Container with Tooltip */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full" />

        {/* Custom Tooltip */}
        {tooltipData && (
          <div
            ref={tooltipRef}
            className="absolute z-10 pointer-events-none"
            style={{
              left: `${tooltipPosition.x + 10}px`,
              top: `${tooltipPosition.y - 80}px`,
            }}
          >
            <div className="bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl min-w-[200px]">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                <img
                  src="/ai-icon.svg"
                  alt="AI"
                  className="w-5 h-5"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="font-semibold text-white text-sm">
                  {tooltipData.botName}
                </span>
                <div
                  className="w-2 h-2 rounded-full ml-auto"
                  style={{ backgroundColor: tooltipData.color }}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Total Balance:</span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(tooltipData.totalBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Unrealized P&L:</span>
                  <span
                    className={`text-sm font-medium ${
                      tooltipData.unrealizedPnl >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatCurrency(tooltipData.unrealizedPnl)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Normalization Message */}
      {showNormalizationMessage && (
        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary text-center">
          Values adjusted to minimum initial balance: $
          {minInitialBalance?.toFixed(2)}
        </p>
      )}

      {/* Legend - Only show when not in single bot mode */}
      {!selectedSingleBotId && (
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
              Legend:
            </span>
            {selectedBots !== null && (
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-xs bg-accent-blue hover:bg-accent-blue/80 text-white rounded-md transition-colors"
              >
                Clear Selection
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollLegend("left")}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Scroll left"
            >
              <svg
                className="w-4 h-4"
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

            <div
              ref={legendContainerRef}
              className="flex-1 overflow-x-auto scrollbar-hide"
              style={{ scrollBehavior: "smooth" }}
            >
              <div className="flex gap-4 min-w-max">
                {latestData?.map((bot, index) => {
                  const isSelected =
                    selectedBots === null || selectedBots.has(bot.botId);
                  const botData = bots.find((b) => b.id === bot.botId);
                  return (
                    <div
                      key={bot.botId}
                      onClick={() => handleLegendClick(bot.botId)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-accent-green/20 border border-accent-green/30"
                          : "bg-white/5 hover:bg-white/10 opacity-60"
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            BOT_COLORS[index % BOT_COLORS.length],
                        }}
                      />
                      <img
                        src={getAIModelLogo(botData?.aiModel)}
                        alt="AI Model"
                        className="w-4 h-4 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                      />
                      <span
                        className={`text-sm font-medium ${
                          isSelected
                            ? "text-light-text-primary dark:text-dark-text-primary"
                            : "text-light-text-secondary dark:text-dark-text-secondary"
                        }`}
                      >
                        {bot.botName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => scrollLegend("right")}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Scroll right"
            >
              <svg
                className="w-4 h-4"
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
      )}
    </div>
  );
}
