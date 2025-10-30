import { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  MouseEventParams,
} from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { api, type TradeHistoryResponse } from "@/lib/api";
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

interface BotDataPoint {
  botId: string;
  botName: string;
  totalBalance: number;
  unrealizedPnl: number;
  initialBalance: number;
  color: string;
}

type ChartMode = "total_pnl" | "unrealized_pnl" | "account_balance";

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
  const priceLineRef = useRef<{ series: ISeriesApi<"Line">; line: any } | null>(
    null
  ); // Store reference to the price line and its series
  const [chartMode, setChartMode] = useState<ChartMode>("total_pnl");
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

  // Fetch trade-based performance history for all bots
  const { data: tradeHistoryData } = useQuery({
    queryKey: showAllPublicBots
      ? ["all-public-bot-trade-history", latestData]
      : walletAddress
      ? ["public-bot-trade-history", walletAddress, latestData]
      : ["bot-trade-history", latestData],
    queryFn: async () => {
      if (!latestData || latestData.length === 0) return {};

      const historyPromises = latestData.map(async (bot) => {
        const response = showAllPublicBots
          ? await api.getAllPublicBotTradePerformanceHistory(bot.botId, 100)
          : walletAddress
          ? await api.getPublicBotTradePerformanceHistory(
              walletAddress,
              bot.botId,
              100
            )
          : await api.getBotTradePerformanceHistory(bot.botId, 100);

        return {
          botId: bot.botId,
          data: response.data as TradeHistoryResponse,
        };
      });

      const results = await Promise.all(historyPromises);
      const tradeHistoryMap: Record<string, TradeHistoryResponse> = {};

      results.forEach(({ botId, data }) => {
        tradeHistoryMap[botId] = data;
      });

      return tradeHistoryMap;
    },
    enabled: !!latestData && latestData.length > 0,
  });

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
    if (!chartRef.current || !tradeHistoryData || !latestData) return;

    // Remove the price line from its series before clearing
    if (priceLineRef.current) {
      try {
        priceLineRef.current.series.removePriceLine(priceLineRef.current.line);
      } catch (e) {
        // Price line may have already been removed
      }
      priceLineRef.current = null;
    }

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
      // Get trade data for this bot
      const tradeData = tradeHistoryData[bot.botId];
      if (!tradeData || !tradeData.history || tradeData.history.length === 0)
        return;

      const dataPoints = tradeData.history;
      const initialBalance = 100; // Fixed initial balance

      const color = BOT_COLORS[index % BOT_COLORS.length];

      // Configure series based on chart mode
      const seriesOptions: any = {
        color,
        lineWidth: 2,
        title: bot.botName,
        lastValueVisible: false, // Disable the last value price line
        priceLineVisible: false, // Disable the price line at last value
      };

      const series = chartRef.current!.addLineSeries(seriesOptions);

      // Create a map to store bot data for each timestamp
      const botDataMap = new Map<number, BotDataPoint>();

      // Transform trade data for chart
      // Add small increments to handle duplicate timestamps
      const seenTimestamps = new Map<number, number>();

      const data = dataPoints
        .map((entry: any) => {
          // Trade data has timestamp
          let timestamp =
            typeof entry.timestamp === "number"
              ? entry.timestamp
              : new Date(entry.timestamp).getTime() / 1000;

          // Handle duplicate timestamps by adding milliseconds
          const count = seenTimestamps.get(timestamp) || 0;
          if (count > 0) {
            timestamp += count * 0.001; // Add milliseconds
          }
          seenTimestamps.set(timestamp, count + 1);

          const totalBalance = entry.accountBalance ?? entry.totalBalance ?? 0;
          let value: number;

          if (chartMode === "total_pnl") {
            // Show total P&L as percentage
            value =
              totalBalance !== null && initialBalance > 0
                ? ((totalBalance - initialBalance) / initialBalance) * 100
                : 0;
          } else {
            // Show account balance as absolute dollar value
            value = totalBalance;
          }

          // Store bot data for tooltip
          botDataMap.set(timestamp, {
            botId: bot.botId,
            botName: bot.botName,
            totalBalance,
            unrealizedPnl: 0,
            initialBalance,
            color,
          });

          return {
            time: timestamp as Time,
            value,
          };
        })
        .filter((d: any) => !isNaN(d.value))
        .sort(
          (a: any, b: any) => (a.time as number) - (b.time as number)
        ) as any[];

      if (data.length > 0) {
        series.setData(data as any);
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
      // Show percentage values on Y-axis (for both total_pnl and unrealized_pnl)
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
    // Only add ONE reference line, not one per bot
    setTimeout(() => {
      if (chartRef.current && seriesRefs.current.size > 0) {
        chartRef.current.timeScale().fitContent();

        // Calculate the middle value based on chart mode
        let middleValue: number;
        let middleLabel: string;

        if (chartMode === "total_pnl") {
          // For P&L mode, middle point is 0 (break-even)
          middleValue = 0;
          middleLabel = "Break Even (0%)";
        } else {
          // For account balance mode, middle point is the fixed initial balance
          middleValue = 100; // Fixed initial balance
          middleLabel = "Initial Balance";
        }

        // Add horizontal line at the middle point
        // Only add it ONCE to the first series and store the reference
        const firstSeries = Array.from(seriesRefs.current.values())[0];
        if (firstSeries && !priceLineRef.current) {
          const priceLine = firstSeries.createPriceLine({
            price: middleValue,
            color: "rgba(255, 255, 255, 0.4)",
            lineWidth: 2,
            lineStyle: 2, // Dashed line
            axisLabelVisible: true,
            title: middleLabel,
          });
          priceLineRef.current = { series: firstSeries, line: priceLine };
        }
      }
    }, 100);
  }, [
    chartMode,
    tradeHistoryData,
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

        {/* Chart Mode Toggle */}
        <div className="flex items-center gap-2 bg-white/5 dark:bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setChartMode("total_pnl")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartMode === "total_pnl"
                ? "bg-accent-green text-white"
                : "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
            }`}
          >
            Total P&L
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

      {/* Trade Info */}
      {tradeHistoryData && (
        <div className="flex items-center justify-center gap-2 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
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
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          <span>
            Showing trade-based performance •{" "}
            {Object.values(tradeHistoryData).reduce(
              (sum, data) => sum + (data?.totalTrades || 0),
              0
            )}{" "}
            total trades
          </span>
        </div>
      )}

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
                  <span className="text-xs text-gray-400">Total P&L:</span>
                  <span
                    className={`text-sm font-medium ${
                      tooltipData.totalBalance - tooltipData.initialBalance >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatCurrency(
                      tooltipData.totalBalance - tooltipData.initialBalance
                    )}
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
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
