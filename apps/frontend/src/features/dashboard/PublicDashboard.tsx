import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PriceTicker } from "@/components/dashboard/PriceTicker";
import { BotPerformanceChart } from "@/components/dashboard/BotPerformanceChart";
import { IndividualBotPerformance } from "@/components/dashboard/IndividualBotPerformance";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import type { TradingBot, AIModel } from "@roboz-trade/shared-types";
import { SUPPORTED_AI_MODELS } from "@roboz-trade/shared-types";

// Helper functions
const toDate = (
  value: string | number | Date | null | undefined
): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDuration = (
  start: string | number | Date | null | undefined,
  end: string | number | Date | null | undefined
): string => {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return "—";
  const diffMs = Math.max(endDate.getTime() - startDate.getTime(), 0);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (totalHours > 0) {
    return `${totalHours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  const seconds = Math.floor(diffMs / 1000);
  return `${seconds}s`;
};

const formatTimeSinceEntry = (
  entryTime: string | number | Date | null | undefined
): string => {
  const entryDate = toDate(entryTime);
  if (!entryDate) return "—";
  const now = new Date();
  const diffMs = Math.max(now.getTime() - entryDate.getTime(), 0);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (totalHours > 0) {
    return `${totalHours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes} min`;
  }
  const seconds = Math.floor(diffMs / 1000);
  return `${seconds}s`;
};

const formatTradingPair = (symbol: string): string => {
  if (!symbol) return "—";
  const normalized = symbol.toUpperCase();
  const knownQuotes = ["USDT", "USD", "USDC", "BTC", "ETH"];
  const quote = knownQuotes.find((suffix) => normalized.endsWith(suffix));
  if (!quote) return normalized;
  const base = normalized.slice(0, -quote.length);
  return `${base}/${quote}`;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatSignedCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absolute);
  return `${prefix}${formatted}`;
};

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const rounded = Math.abs(value).toFixed(2);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${rounded}%`;
};

const mapTradeSide = (side: string): "LONG" | "SHORT" => {
  if (side === "BUY") return "LONG";
  if (side === "SELL") return "SHORT";
  return side.toUpperCase() === "SHORT" ? "SHORT" : "LONG";
};

const formatTimestamp = (
  value: string | number | Date | null | undefined
): string => {
  const date = toDate(value ?? null);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatRuntime = (runtimeMs: number | null | undefined): string => {
  if (runtimeMs === null || runtimeMs === undefined) return "—";
  if (runtimeMs < 1000) return `${runtimeMs}ms`;
  if (runtimeMs < 60_000) return `${(runtimeMs / 1000).toFixed(1)}s`;
  const minutes = runtimeMs / 60000;
  return `${minutes.toFixed(1)}m`;
};

const extractSummary = (aiResponse: string | null | undefined): string => {
  if (!aiResponse) return "No AI summary available.";

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary) return parsed.summary;
        if (parsed.reasoning) return parsed.reasoning;
      } catch {
        // Continue to fallback
      }
    }
  } catch {
    // Continue to fallback
  }

  return aiResponse.slice(0, 300);
};

const BOT_COLOR_PALETTE = [
  "#007aff",
  "#af52de",
  "#34c759",
  "#ff9500",
  "#ff2d55",
  "#3b82f6",
  "#8b5cf6",
  "#22d3ee",
];

interface TradeHistoryEntry {
  id: string;
  botId: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  leverage: number;
  margin: number;
  realizedPnl: number | null;
  fees?: number | null;
  status: string;
  openedAt: string | number | Date;
  closedAt: string | number | Date | null;
}

interface PositionSnapshot {
  id: string;
  botId: string;
  tradeId: string | null;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  liquidationPrice?: number | null;
  unrealizedPnl: number;
  leverage: number;
  margin: number;
  stopLoss: number | null;
  takeProfit: number | null;
  snapshotTime: string | number | Date | null;
  entryTime?: string | number | Date | null;
  side?: "BUY" | "SELL" | null;
  reasoning?: string | null;
  invalidationCondition?: string | null;
}

interface CompletedTradeRow {
  id: string;
  aiModel: string;
  aiModelValue: AIModel | null;
  modelColor: string;
  pair: string;
  side: "LONG" | "SHORT";
  leverage: string;
  entryPrice: number;
  exitPrice: number | null;
  holdingTime: string;
  pnl: number;
  pnlPercent: number;
}

interface BotPositionRow {
  id: string;
  side: "LONG" | "SHORT";
  pair: string;
  entryPrice: number;
  currentPrice: number;
  takeProfit: number | null;
  stopLoss: number | null;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  entryTime?: string | number | Date | null;
}

interface BotPositionGroup {
  botId: string;
  botName: string;
  aiModelValue: AIModel | null;
  color: string;
  positions: BotPositionRow[];
}

interface BotExecutionEntry {
  id: string;
  botId: string;
  executionTime: string | number | Date | null;
  aiPrompt?: string | null;
  aiResponse?: string | null;
  aiThinking?: string | null;
  aiDecisions?: any;
  symbolsProcessed?: string[];
  status?: string;
  totalBalance?: number | null;
  unrealizedPnl?: number | null;
  accountBalance?: number | null;
  aiRuntimeMs?: number | null;
  aiInvocations?: number | null;
}

interface PublicDashboardProps {
  walletAddress: string;
}

export default function PublicDashboard({
  walletAddress,
}: PublicDashboardProps) {
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [selectedSingleBotId, setSelectedSingleBotId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<
    "roboz" | "public" | "leaderboard"
  >("roboz");
  const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(
    new Set()
  );
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
    new Set()
  );
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(
    new Set()
  );

  // Fetch leaderboard data
  const { data: topBotsData } = useQuery({
    queryKey: ["public-top-bots"],
    queryFn: async () => {
      const response = await api.getPublicTopBots(50);
      return response.data;
    },
    staleTime: 60_000,
    enabled: activeTab === "leaderboard",
  });

  // Fetch bots based on active tab
  const {
    data: robozBots = [],
    isLoading: robozBotsLoading,
    isError: robozBotsError,
  } = useQuery<TradingBot[]>({
    queryKey: ["public-bots", walletAddress],
    queryFn: async () => {
      const response = await api.getPublicBots(walletAddress);
      return (response.data ?? []) as TradingBot[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    enabled: activeTab === "roboz",
  });

  const {
    data: allBots = [],
    isLoading: allBotsLoading,
    isError: allBotsError,
  } = useQuery<TradingBot[]>({
    queryKey: ["all-public-bots"],
    queryFn: async () => {
      const response = await api.getAllPublicBots();
      return (response.data ?? []) as TradingBot[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    enabled: activeTab === "public",
  });

  // Use appropriate data based on active tab
  const bots = activeTab === "public" ? allBots : robozBots;
  const botsLoading =
    activeTab === "public" ? allBotsLoading : robozBotsLoading;
  const botsError = activeTab === "public" ? allBotsError : robozBotsError;

  // Ensure bots is always an array and filter to only active bots
  const allBotsArray = Array.isArray(bots) ? bots : [];
  const safeBots = allBotsArray.filter((bot) => bot.status === "active");
  const hasBots = safeBots.length > 0;

  const colorByBotId = useMemo(() => {
    const map = new Map<string, string>();
    safeBots.forEach((bot, index) => {
      map.set(bot.id, BOT_COLOR_PALETTE[index % BOT_COLOR_PALETTE.length]);
    });
    return map;
  }, [safeBots]);

  const botById = useMemo(() => {
    const map = new Map<string, TradingBot>();
    safeBots.forEach((bot) => {
      map.set(bot.id, bot);
    });
    return map;
  }, [safeBots]);

  // Auto-select all bots on initial load only
  useEffect(() => {
    const currentBotIds = safeBots.map((bot) => bot.id);

    if (currentBotIds.length === 0) {
      return;
    }

    // Only auto-select if no bots are currently selected (initial load)
    setSelectedBotIds((prev) => {
      if (prev.length > 0) {
        // User has already made a selection, don't override
        return prev;
      }
      // Initial load: select all bots
      return currentBotIds;
    });
  }, [safeBots]);

  const handleSelectSingleBot = (botId: string) => {
    setSelectedSingleBotId(botId);
  };

  const handleGoBack = () => {
    setSelectedSingleBotId(null);
  };

  // Fetch trades based on active tab
  const {
    data: robozTrades = [],
    isLoading: robozTradesLoading,
    isError: robozTradesError,
  } = useQuery<TradeHistoryEntry[]>({
    queryKey: ["public-completed-trades", walletAddress],
    enabled: safeBots.length > 0 && activeTab === "roboz",
    queryFn: async () => {
      const response = await api.getPublicTrades(walletAddress, 50);
      return (response.data ?? []) as TradeHistoryEntry[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchInterval: 120_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const {
    data: allTrades = [],
    isLoading: allTradesLoading,
    isError: allTradesError,
  } = useQuery<TradeHistoryEntry[]>({
    queryKey: ["all-public-completed-trades"],
    enabled: safeBots.length > 0 && activeTab === "public",
    queryFn: async () => {
      const response = await api.getAllPublicTrades(50);
      return (response.data ?? []) as TradeHistoryEntry[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchInterval: 120_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const tradesResponse = activeTab === "public" ? allTrades : robozTrades;
  const tradesLoading =
    activeTab === "public" ? allTradesLoading : robozTradesLoading;
  const tradesError =
    activeTab === "public" ? allTradesError : robozTradesError;

  // Fetch positions based on active tab
  const {
    data: robozPositions = [],
    isLoading: robozPositionsLoading,
    isError: robozPositionsError,
  } = useQuery<PositionSnapshot[]>({
    queryKey: ["public-positions", walletAddress],
    enabled: safeBots.length > 0 && activeTab === "roboz",
    queryFn: async () => {
      const response = await api.getPublicPositions(walletAddress);
      return (response.data ?? []) as PositionSnapshot[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchInterval: 120_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const {
    data: allPositions = [],
    isLoading: allPositionsLoading,
    isError: allPositionsError,
  } = useQuery<PositionSnapshot[]>({
    queryKey: ["all-public-positions"],
    enabled: safeBots.length > 0 && activeTab === "public",
    queryFn: async () => {
      const response = await api.getAllPublicPositions();
      return (response.data ?? []) as PositionSnapshot[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchInterval: 120_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const positionsResponse =
    activeTab === "public" ? allPositions : robozPositions;
  const positionsLoading =
    activeTab === "public" ? allPositionsLoading : robozPositionsLoading;
  const positionsError =
    activeTab === "public" ? allPositionsError : robozPositionsError;

  const getAIModelLogo = (aiModel: AIModel | null | undefined): string => {
    if (!aiModel) return "/ai-icon.svg";
    const modelInfo = SUPPORTED_AI_MODELS.find((m) => m.value === aiModel);
    return modelInfo?.logo ?? "/ai-icon.svg";
  };

  const getAIModelName = (aiModel: AIModel | null | undefined): string => {
    if (!aiModel) return "Unknown";
    const modelInfo = SUPPORTED_AI_MODELS.find((m) => m.value === aiModel);
    return modelInfo?.label ?? "Unknown";
  };

  // Process completed trades
  const completedTrades = useMemo<CompletedTradeRow[]>(() => {
    if (!tradesResponse || tradesResponse.length === 0) return [];

    // Get active bot IDs
    const activeBotIds = new Set(safeBots.map((bot) => bot.id));

    return (
      tradesResponse
        .filter((trade) => trade.status === "CLOSED" && trade.closedAt)
        // Filter to only include trades from active bots
        .filter((trade) => activeBotIds.has(trade.botId))
        .slice(0, 10)
        .map((trade) => {
          const bot = botById.get(trade.botId);
          const aiModel = bot?.aiModel ?? null;
          const aiModelInfo = aiModel
            ? SUPPORTED_AI_MODELS.find((m) => m.value === aiModel)
            : null;
          const modelColor = colorByBotId.get(trade.botId) ?? "#007aff";

          const pnl = trade.realizedPnl ?? 0;
          const margin = trade.margin ?? 0;
          // Calculate P&L percentage based on margin (actual investment) for leveraged trading
          const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;

          return {
            id: trade.id,
            aiModel: aiModelInfo?.label ?? "Unknown",
            aiModelValue: aiModel,
            modelColor,
            pair: formatTradingPair(trade.symbol),
            side: mapTradeSide(trade.side),
            leverage: `${trade.leverage}x`,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            holdingTime: formatDuration(trade.openedAt, trade.closedAt),
            pnl,
            pnlPercent,
          };
        })
    );
  }, [tradesResponse, botById, colorByBotId, safeBots]);

  // Process current positions
  const positionsByBot = useMemo<BotPositionGroup[]>(() => {
    if (!positionsResponse || positionsResponse.length === 0) return [];

    // Get active bot IDs
    const activeBotIds = new Set(safeBots.map((bot) => bot.id));

    const grouped = new Map<string, PositionSnapshot[]>();
    // Only group positions from active bots
    positionsResponse.forEach((pos) => {
      if (activeBotIds.has(pos.botId)) {
        if (!grouped.has(pos.botId)) {
          grouped.set(pos.botId, []);
        }
        grouped.get(pos.botId)!.push(pos);
      }
    });

    return Array.from(grouped.entries()).map(([botId, positions]) => {
      const bot = botById.get(botId);
      const aiModel = bot?.aiModel ?? null;
      const color = colorByBotId.get(botId) ?? "#007aff";

      const positionRows: BotPositionRow[] = positions.map((pos) => {
        // Determine side from the trade side field if available, otherwise from quantity
        // BUY = LONG, SELL = SHORT
        let side: "LONG" | "SHORT" = "LONG";
        if (pos.side) {
          side = pos.side === "BUY" ? "LONG" : "SHORT";
        } else {
          // Fallback: positive quantity = LONG, negative = SHORT
          side = pos.quantity >= 0 ? "LONG" : "SHORT";
        }

        // Calculate P&L percentage based on margin (actual investment) for leveraged trading
        // If margin is 0 or missing, calculate it from entry price, quantity, and leverage
        let effectiveMargin = pos.margin ?? 0;
        if (
          effectiveMargin === 0 ||
          effectiveMargin === null ||
          effectiveMargin === undefined
        ) {
          const entryPrice = pos.entryPrice ?? 0;
          const quantity = Math.abs(pos.quantity);
          const leverage = pos.leverage ?? 1;
          effectiveMargin =
            leverage > 0 ? (entryPrice * quantity) / leverage : 0;
        }

        const unrealizedPnlPercent =
          effectiveMargin > 0 ? (pos.unrealizedPnl / effectiveMargin) * 100 : 0;

        return {
          id: pos.id,
          side,
          pair: formatTradingPair(pos.symbol),
          entryPrice: pos.entryPrice,
          currentPrice: pos.currentPrice,
          takeProfit: pos.takeProfit,
          stopLoss: pos.stopLoss,
          unrealizedPnl: pos.unrealizedPnl,
          unrealizedPnlPercent,
          entryTime: pos.snapshotTime,
        };
      });

      return {
        botId,
        botName: bot?.name ?? "Unknown Bot",
        aiModelValue: aiModel,
        color,
        positions: positionRows,
      };
    });
  }, [positionsResponse, botById, colorByBotId, safeBots]);

  // Fetch bot executions for AI decision feed based on active tab
  const {
    data: robozExecutions = [],
    isLoading: robozExecutionsLoading,
    isError: robozExecutionsError,
  } = useQuery<BotExecutionEntry[]>({
    queryKey: ["public-executions", walletAddress],
    enabled: safeBots.length > 0 && activeTab === "roboz",
    queryFn: async () => {
      const response = await api.getPublicExecutions(walletAddress, 50);
      return (response.data ?? []) as BotExecutionEntry[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchInterval: 120_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const {
    data: allExecutions = [],
    isLoading: allExecutionsLoading,
    isError: allExecutionsError,
  } = useQuery<BotExecutionEntry[]>({
    queryKey: ["all-public-executions"],
    enabled: safeBots.length > 0 && activeTab === "public",
    queryFn: async () => {
      const response = await api.getAllPublicExecutions(50);
      return (response.data ?? []) as BotExecutionEntry[];
    },
    staleTime: 60_000,
    gcTime: Infinity,
    refetchInterval: 120_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const executionsResponse =
    activeTab === "public" ? allExecutions : robozExecutions;
  const executionsLoading =
    activeTab === "public" ? allExecutionsLoading : robozExecutionsLoading;
  const executionsError =
    activeTab === "public" ? allExecutionsError : robozExecutionsError;

  // Process AI decision feed
  interface BotTranscriptEntry {
    id: string;
    botId: string;
    botName: string;
    aiModel: AIModel | null;
    color: string;
    timestamp: Date | null;
    message: string;
    prompt: string | null;
    thinking: string | null;
    runtimeMs: number | null | undefined;
    invocations: number | null | undefined;
    balance: number | null | undefined;
    exposure: number | null | undefined;
    tradesExecuted: number | null | undefined;
    decisions: Array<{
      symbol: string;
      action: string;
      confidence: number | null;
      reasoning?: string | null;
      analysis?: string | null;
    }>;
  }

  const filteredTranscripts = useMemo<BotTranscriptEntry[]>(() => {
    if (!executionsResponse || executionsResponse.length === 0) return [];

    // Get active bot IDs
    const activeBotIds = new Set(safeBots.map((bot) => bot.id));

    // First filter to only include executions from active bots
    const activeExecutions = executionsResponse.filter((exec) =>
      activeBotIds.has(exec.botId)
    );

    // Apply bot selection filter
    let filtered: typeof activeExecutions;
    if (selectedSingleBotId) {
      // Single bot mode: show only that bot
      filtered = activeExecutions.filter(
        (exec) => exec.botId === selectedSingleBotId
      );
    } else if (selectedBotIds.length === 0) {
      // No bots selected: show empty (user explicitly cleared)
      filtered = [];
    } else {
      // Some bots selected: show only those bots
      filtered = activeExecutions.filter((exec) =>
        selectedBotIds.includes(exec.botId)
      );
    }

    return filtered.map((exec) => {
      const bot = botById.get(exec.botId);
      const aiModel = bot?.aiModel ?? null;
      const color = colorByBotId.get(exec.botId) ?? "#007aff";

      // Parse AI decisions from aiDecisions field
      let decisions: Array<{
        symbol: string;
        action: string;
        confidence: number | null;
        reasoning?: string | null;
        analysis?: string | null;
      }> = [];

      if (exec.aiDecisions) {
        try {
          const parsed =
            typeof exec.aiDecisions === "string"
              ? JSON.parse(exec.aiDecisions)
              : exec.aiDecisions;
          if (Array.isArray(parsed)) {
            decisions = parsed.map((d: any) => ({
              symbol: d.symbol ?? "Unknown",
              action: d.action ?? "HOLD",
              confidence: d.confidence ?? null,
              reasoning: d.reasoning ?? null,
              analysis: d.analysis ?? null,
            }));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      return {
        id: exec.id,
        botId: exec.botId,
        botName: bot?.name ?? "Unknown Bot",
        aiModel,
        color,
        timestamp: toDate(exec.executionTime),
        message: extractSummary(exec.aiResponse),
        prompt: exec.aiPrompt?.toString().trim() || null,
        thinking: exec.aiThinking?.toString().trim() || null,
        runtimeMs: exec.aiRuntimeMs,
        invocations: exec.aiInvocations,
        balance: exec.totalBalance,
        exposure: exec.unrealizedPnl,
        tradesExecuted: null,
        decisions,
      };
    });
  }, [
    executionsResponse,
    selectedBotIds,
    selectedSingleBotId,
    botById,
    colorByBotId,
    safeBots,
  ]);

  const handleSelectAllBots = () => {
    if (safeBots.length === 0) return;
    const allIds = safeBots.map((bot) => bot.id);
    setSelectedBotIds((prev) => {
      const unchanged =
        prev.length === allIds.length &&
        prev.every((id, index) => id === allIds[index]);
      return unchanged ? prev : allIds;
    });
  };

  const handleClearBots = () => {
    setSelectedBotIds([]);
  };

  const handleToggleBotSelection = (botId: string) => {
    setSelectedBotIds((prev) => {
      if (prev.includes(botId)) {
        return prev.filter((id) => id !== botId);
      }
      return [...prev, botId];
    });
  };

  if (botsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-12">
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (botsError || !hasBots) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-12">
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary">
            No trading bots found for this wallet address.
          </p>
        </div>
      </div>
    );
  }

  // Get header text based on active tab
  const getHeaderText = () => {
    switch (activeTab) {
      case "roboz":
        return {
          title: "Roboz's Team",
          subtitle: "These bots are run by the Roboz team",
        };
      case "public":
        return {
          title: "Top Public Performers",
          subtitle: "Best performing bots by P&L for each AI model",
        };
      case "leaderboard":
        return {
          title: "Top 50 Leaderboard",
          subtitle: "Highest performing bots ranked by total P&L",
        };
    }
  };

  const headerText = getHeaderText();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
      {/* Navigation Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 p-1">
          <button
            onClick={() => setActiveTab("roboz")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "roboz"
                ? "bg-accent-blue text-white shadow-lg"
                : "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
            }`}
          >
            Roboz
          </button>
          <button
            onClick={() => setActiveTab("public")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "public"
                ? "bg-accent-blue text-white shadow-lg"
                : "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
            }`}
          >
            Public
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "leaderboard"
                ? "bg-accent-blue text-white shadow-lg"
                : "text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
            }`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
            {headerText.title}
          </h1>
          <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
            {headerText.subtitle}
          </p>
        </div>
      </div>

      {/* Conditional Content Based on Active Tab */}
      {activeTab === "roboz" && (
        <>
          {/* Price Ticker */}
          <PriceTicker />

          {/* Back Button - Show when single bot is selected */}
          {selectedSingleBotId && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoBack}
                className="px-4 py-2 rounded-xl backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20 transition-all duration-200 text-sm font-medium text-light-text-primary dark:text-dark-text-primary"
              >
                ← Back to All Bots
              </button>
              <div className="flex items-center gap-2">
                <img
                  src={getAIModelLogo(
                    botById.get(selectedSingleBotId)?.aiModel
                  )}
                  alt={getAIModelName(
                    botById.get(selectedSingleBotId)?.aiModel
                  )}
                  className="w-6 h-6 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                />
                <span className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
                  {botById.get(selectedSingleBotId)?.name ?? "Unknown Bot"}
                </span>
              </div>
            </div>
          )}

          {/* Bot Performance Chart Section */}
          <GlassCard className="p-4 sm:p-6">
            <BotPerformanceChart
              selectedSingleBotId={selectedSingleBotId}
              walletAddress={walletAddress}
            />
          </GlassCard>

          {/* Individual Bot Performance Section - Hide when single bot is selected */}
          {!selectedSingleBotId && (
            <IndividualBotPerformance
              onSelectBot={handleSelectSingleBot}
              walletAddress={walletAddress}
            />
          )}

          {/* Two-Column Layout: Current Positions + AI Decision Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* Left Column: Current Positions (60%) */}
            <div className="lg:col-span-3">
              {/* Current Positions Table - Grouped by Bot */}
              <GlassCard className="p-4 sm:p-6 h-[600px] sm:h-[700px] lg:h-[800px] flex flex-col">
                <h3 className="text-base sm:text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 sm:mb-4">
                  Current Positions
                </h3>
                {botsLoading || positionsLoading ? (
                  <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    Loading current positions...
                  </div>
                ) : botsError ? (
                  <div className="py-6 text-center text-accent-red">
                    Failed to load bots. Please try again.
                  </div>
                ) : positionsError ? (
                  <div className="py-6 text-center text-accent-red">
                    Failed to load current positions.
                  </div>
                ) : !hasBots ? (
                  <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    No trading bots found for this wallet.
                  </div>
                ) : positionsByBot.length === 0 ? (
                  <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    No open positions at the moment.
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
                    {positionsByBot.map((group) => (
                      <details key={group.botId} className="group" open>
                        <summary className="cursor-pointer list-none flex items-center justify-between p-2 sm:p-3 rounded-xl hover:bg-white/5 dark:hover:bg-black/5 transition-colors">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <img
                              src={getAIModelLogo(group.aiModelValue)}
                              alt="AI Model"
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                            />
                            <span className="text-sm sm:text-base font-medium text-light-text-primary dark:text-dark-text-primary">
                              {group.botName}
                            </span>
                            <span className="text-xs sm:text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                              ({group.positions.length})
                            </span>
                          </div>
                          <svg
                            className="w-4 h-4 sm:w-5 sm:h-5 text-light-text-tertiary dark:text-dark-text-tertiary transition-transform group-open:rotate-180"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </summary>
                        <div className="mt-2 overflow-x-auto -mx-4 sm:mx-0">
                          <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-white/10 dark:border-white/5">
                                  <th className="text-left py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    Side
                                  </th>
                                  <th className="text-left py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    Pair
                                  </th>
                                  <th className="text-right py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    Entry
                                  </th>
                                  <th className="text-right py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    Current
                                  </th>
                                  <th className="text-right py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    Time
                                  </th>
                                  <th className="text-right py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    TP
                                  </th>
                                  <th className="text-right py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    SL
                                  </th>
                                  <th className="text-right py-2 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium text-xs">
                                    Unrealized P&L
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.positions.map((position, posIndex) => (
                                  <tr
                                    key={position.id}
                                    className="border-b border-white/5 hover:bg-white/5 dark:hover:bg-black/5 transition-colors animate-fade-in-up"
                                    style={{
                                      animationDelay: `${posIndex * 50}ms`,
                                      animationFillMode: "backwards",
                                    }}
                                  >
                                    <td className="py-2 px-2">
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                                          position.side === "LONG"
                                            ? "bg-accent-green/20 text-accent-green"
                                            : "bg-accent-red/20 text-accent-red"
                                        }`}
                                      >
                                        {position.side}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-light-text-primary dark:text-dark-text-primary">
                                      {position.pair}
                                    </td>
                                    <td className="py-2 px-2 text-right text-light-text-primary dark:text-dark-text-primary">
                                      {formatCurrency(position.entryPrice)}
                                    </td>
                                    <td className="py-2 px-2 text-right text-light-text-primary dark:text-dark-text-primary">
                                      {formatCurrency(position.currentPrice)}
                                    </td>
                                    <td className="py-2 px-2 text-right text-light-text-secondary dark:text-dark-text-secondary text-xs">
                                      {formatTimeSinceEntry(position.entryTime)}
                                    </td>
                                    <td className="py-2 px-2 text-right text-accent-green">
                                      {position.takeProfit !== null
                                        ? formatCurrency(position.takeProfit)
                                        : "—"}
                                    </td>
                                    <td className="py-2 px-2 text-right text-accent-red">
                                      {position.stopLoss !== null
                                        ? formatCurrency(position.stopLoss)
                                        : "—"}
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <div className="flex flex-col items-end">
                                        <span
                                          className={`font-semibold ${
                                            (position.unrealizedPnl ?? 0) >= 0
                                              ? "text-accent-green"
                                              : "text-accent-red"
                                          }`}
                                        >
                                          {formatSignedCurrency(
                                            position.unrealizedPnl ?? 0
                                          )}
                                        </span>
                                        <span
                                          className={`text-xs ${
                                            (position.unrealizedPnl ?? 0) >= 0
                                              ? "text-accent-green"
                                              : "text-accent-red"
                                          }`}
                                        >
                                          (
                                          {formatPercentage(
                                            position.unrealizedPnlPercent ?? 0
                                          )}
                                          )
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Right Column: AI Decision Feed (40%) */}
            <div className="lg:col-span-2">
              <GlassCard className="p-0 h-[600px] sm:h-[700px] lg:h-[800px] flex flex-col">
                <div className="p-4 border-b border-white/10 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                      AI Decision Feed
                    </h3>
                    <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                      {filteredTranscripts.length} updates
                    </span>
                  </div>

                  {/* Bot selection filters - Only show when not in single bot mode */}
                  {!selectedSingleBotId && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleSelectAllBots}
                        className={`px-3 py-1.5 text-xs sm:text-sm rounded-xl border transition-all duration-200 ${
                          selectedBotIds.length === safeBots.length
                            ? "border-accent-green bg-accent-green/20 text-accent-green font-semibold"
                            : "border-white/10 hover:border-white/20 hover:bg-white/5 text-light-text-primary dark:text-dark-text-primary"
                        }`}
                      >
                        All Bots
                      </button>
                      <button
                        onClick={handleClearBots}
                        className={`px-3 py-1.5 text-xs sm:text-sm rounded-xl border transition-all duration-200 ${
                          selectedBotIds.length === 0
                            ? "border-white/10 text-light-text-tertiary dark:text-dark-text-tertiary cursor-not-allowed opacity-50"
                            : "border-white/10 hover:border-accent-red hover:bg-accent-red/10 hover:text-accent-red text-light-text-primary dark:text-dark-text-primary"
                        }`}
                      >
                        Clear
                      </button>

                      {safeBots.map((bot) => {
                        const isActive = selectedBotIds.includes(bot.id);
                        return (
                          <button
                            key={bot.id}
                            onClick={() => handleToggleBotSelection(bot.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm transition-all duration-200 ${
                              isActive
                                ? "border-accent-blue bg-accent-blue/20 shadow-glow"
                                : "border-white/10 hover:border-white/20 hover:bg-white/5"
                            }`}
                          >
                            <img
                              src={getAIModelLogo(bot.aiModel)}
                              alt="AI Model"
                              className="w-4 h-4 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                            />
                            <span
                              className={`${
                                isActive
                                  ? "text-accent-blue font-bold"
                                  : "text-light-text-primary dark:text-dark-text-primary"
                              }`}
                            >
                              {bot.name}
                            </span>
                            {isActive && (
                              <svg
                                className="w-3 h-3 text-accent-blue"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {executionsLoading ? (
                    <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                      Loading AI decisions...
                    </div>
                  ) : executionsError ? (
                    <div className="py-6 text-center text-accent-red">
                      Failed to load AI decision history.
                    </div>
                  ) : !hasBots ? (
                    <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                      No trading bots found for this wallet.
                    </div>
                  ) : filteredTranscripts.length === 0 ? (
                    <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                      No AI updates for the selected bots yet.
                    </div>
                  ) : (
                    filteredTranscripts.map((entry, index) => {
                      const aiModelInfo = entry.aiModel
                        ? SUPPORTED_AI_MODELS.find(
                            (m) => m.value === entry.aiModel
                          )
                        : null;
                      const aiModelLogo = aiModelInfo?.logo ?? "/ai-icon.svg";
                      const aiModelProvider = aiModelInfo?.provider ?? "AI";

                      return (
                        <div
                          key={`${entry.id}-${
                            entry.timestamp?.getTime() ?? ""
                          }`}
                          className="p-4 rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-xl shadow-glass space-y-3 animate-fade-in-up"
                          style={{
                            animationDelay: `${index * 100}ms`,
                            animationFillMode: "backwards",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <img
                                src={aiModelLogo}
                                alt={aiModelProvider}
                                className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-gray-800 p-1"
                              />
                            </div>

                            <div className="flex-1 space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                                    {entry.botName}
                                  </p>
                                  <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                                    {formatTimestamp(entry.timestamp)}
                                  </p>
                                </div>
                              </div>

                              <p className="text-sm leading-relaxed whitespace-pre-line text-light-text-primary dark:text-dark-text-primary">
                                {entry.message}
                              </p>

                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                                <span>
                                  Runtime: {formatRuntime(entry.runtimeMs)}
                                </span>
                                <span>
                                  Invocations: {entry.invocations ?? "—"}
                                </span>
                                <span>
                                  Balance:{" "}
                                  {formatCurrency(entry.balance ?? null)}
                                </span>
                                <span>
                                  Exposure:{" "}
                                  {formatCurrency(entry.exposure ?? null)}
                                </span>
                              </div>

                              {entry.decisions.length > 0 && (
                                <div className="mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                  <button
                                    onClick={() => {
                                      setExpandedDecisions((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(entry.id)) {
                                          next.delete(entry.id);
                                        } else {
                                          next.add(entry.id);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-blue hover:bg-white/5 dark:hover:bg-black/5 transition-colors select-none"
                                  >
                                    <span>
                                      {expandedDecisions.has(entry.id)
                                        ? "Hide individual decisions"
                                        : "Show individual decisions"}
                                    </span>
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform ${
                                        expandedDecisions.has(entry.id)
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  {expandedDecisions.has(entry.id) && (
                                    <div className="px-3 pb-3 space-y-3">
                                      {entry.decisions.map(
                                        (decision, index) => (
                                          <div
                                            key={`${entry.id}-decision-${index}`}
                                            className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 p-3 space-y-2"
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                                                  {decision.symbol}
                                                </span>
                                                <span
                                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    decision.action === "BUY" ||
                                                    decision.action === "LONG"
                                                      ? "bg-accent-green/20 text-accent-green"
                                                      : decision.action ===
                                                          "SELL" ||
                                                        decision.action ===
                                                          "SHORT"
                                                      ? "bg-accent-red/20 text-accent-red"
                                                      : decision.action ===
                                                        "CLOSE"
                                                      ? "bg-accent-blue/20 text-accent-blue"
                                                      : "bg-light-text-tertiary/20 text-light-text-tertiary dark:bg-dark-text-tertiary/20 dark:text-dark-text-tertiary"
                                                  }`}
                                                >
                                                  {decision.action}
                                                </span>
                                              </div>
                                              <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                                                CONF{" "}
                                                {decision.confidence !== null &&
                                                decision.confidence !==
                                                  undefined
                                                  ? `${(
                                                      decision.confidence * 100
                                                    ).toFixed(0)}%`
                                                  : "—"}
                                              </div>
                                            </div>

                                            {decision.reasoning && (
                                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line">
                                                {decision.reasoning}
                                              </p>
                                            )}

                                            {decision.analysis && (
                                              <div className="text-xs space-y-1">
                                                <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                                  Analysis:
                                                </p>
                                                <p className="text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line">
                                                  {decision.analysis}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {entry.prompt && (
                                <div className="mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                  <button
                                    onClick={() => {
                                      setExpandedPrompts((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(entry.id)) {
                                          next.delete(entry.id);
                                        } else {
                                          next.add(entry.id);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-blue hover:bg-white/5 dark:hover:bg-black/5 transition-colors select-none"
                                  >
                                    <span>
                                      {expandedPrompts.has(entry.id)
                                        ? "Hide prompt"
                                        : "Show prompt"}
                                    </span>
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform ${
                                        expandedPrompts.has(entry.id)
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  {expandedPrompts.has(entry.id) && (
                                    <div className="px-3 pb-3 pt-2">
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line leading-relaxed">
                                        {entry.prompt}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {entry.thinking && (
                                <div className="mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                  <button
                                    onClick={() => {
                                      setExpandedAnalysis((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(entry.id)) {
                                          next.delete(entry.id);
                                        } else {
                                          next.add(entry.id);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-purple hover:bg-white/5 dark:hover:bg-black/5 transition-colors select-none"
                                  >
                                    <span>
                                      {expandedAnalysis.has(entry.id)
                                        ? "Hide analysis"
                                        : "Show analysis"}
                                    </span>
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform ${
                                        expandedAnalysis.has(entry.id)
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  {expandedAnalysis.has(entry.id) && (
                                    <div className="px-3 pb-3 pt-2">
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line leading-relaxed">
                                        {entry.thinking}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Completed Trades Table - Full Width */}
          <GlassCard className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 sm:mb-4">
              Completed Trades
            </h3>
            {botsLoading || tradesLoading ? (
              <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                Loading completed trades...
              </div>
            ) : botsError ? (
              <div className="py-6 text-center text-accent-red">
                Failed to load bots. Please try again.
              </div>
            ) : tradesError ? (
              <div className="py-6 text-center text-accent-red">
                Failed to load completed trades.
              </div>
            ) : !hasBots ? (
              <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                No trading bots found for this wallet.
              </div>
            ) : completedTrades.length === 0 ? (
              <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                No completed trades yet.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 dark:border-white/5">
                        <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          AI Model
                        </th>
                        <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          Pair
                        </th>
                        <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          Side
                        </th>
                        <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          Leverage
                        </th>
                        <th className="text-right py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          Entry
                        </th>
                        <th className="text-right py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          Exit
                        </th>
                        <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          Time
                        </th>
                        <th className="text-right py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-medium">
                          P&L
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedTrades.map((trade, index) => (
                        <tr
                          key={trade.id}
                          className="border-b border-white/5 hover:bg-white/5 dark:hover:bg-black/5 transition-colors animate-fade-in-up"
                          style={{
                            animationDelay: `${index * 50}ms`,
                            animationFillMode: "backwards",
                          }}
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={getAIModelLogo(trade.aiModelValue)}
                                alt="AI Model"
                                className="w-5 h-5 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                              />
                              <span className="text-light-text-primary dark:text-dark-text-primary">
                                {trade.aiModel}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-light-text-primary dark:text-dark-text-primary">
                            {trade.pair}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                trade.side === "LONG"
                                  ? "bg-accent-green/20 text-accent-green"
                                  : "bg-accent-red/20 text-accent-red"
                              }`}
                            >
                              {trade.side}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-light-text-secondary dark:text-dark-text-secondary">
                            {trade.leverage}
                          </td>
                          <td className="py-3 px-2 text-right text-light-text-primary dark:text-dark-text-primary">
                            {formatCurrency(trade.entryPrice)}
                          </td>
                          <td className="py-3 px-2 text-right text-light-text-primary dark:text-dark-text-primary">
                            {trade.exitPrice !== null
                              ? formatCurrency(trade.exitPrice)
                              : "—"}
                          </td>
                          <td className="py-3 px-2 text-light-text-secondary dark:text-dark-text-secondary">
                            {trade.holdingTime}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex flex-col items-end">
                              <span
                                className={`font-semibold ${
                                  trade.pnl >= 0
                                    ? "text-accent-green"
                                    : "text-accent-red"
                                }`}
                              >
                                {formatSignedCurrency(trade.pnl)}
                              </span>
                              <span
                                className={`text-xs ${
                                  trade.pnl >= 0
                                    ? "text-accent-green"
                                    : "text-accent-red"
                                }`}
                              >
                                ({formatPercentage(trade.pnlPercent)})
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* Public Tab - All Public Bots Dashboard */}
      {activeTab === "public" && (
        <>
          {/* Price Ticker */}
          <PriceTicker />

          {/* Bot Performance Chart Section */}
          <GlassCard className="p-4 sm:p-6">
            <BotPerformanceChart
              selectedSingleBotId={selectedSingleBotId}
              showAllPublicBots={true}
            />
          </GlassCard>

          {/* Individual Bot Performance Section - Hide when single bot is selected */}
          {!selectedSingleBotId && (
            <IndividualBotPerformance
              onSelectBot={handleSelectSingleBot}
              showAllPublicBots={true}
            />
          )}

          {/* Two-Column Layout: Current Positions + AI Decision Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* Left Column: Current Positions (60%) */}
            <div className="lg:col-span-3">
              {/* Current Positions Table - Grouped by Bot */}
              <GlassCard className="p-4 sm:p-6 h-[600px] sm:h-[700px] lg:h-[800px] flex flex-col">
                <h3 className="text-base sm:text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 sm:mb-4">
                  Current Positions (All Bots)
                </h3>
                {botsLoading || positionsLoading ? (
                  <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    Loading current positions...
                  </div>
                ) : botsError ? (
                  <div className="py-6 text-center text-accent-red">
                    Failed to load bots. Please try again.
                  </div>
                ) : positionsError ? (
                  <div className="py-6 text-center text-accent-red">
                    Failed to load current positions.
                  </div>
                ) : !hasBots ? (
                  <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    No trading bots found.
                  </div>
                ) : positionsByBot.length === 0 ? (
                  <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    No open positions at the moment.
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
                    {positionsByBot.map((group) => (
                      <details
                        key={group.botId}
                        className="group rounded-xl backdrop-blur-xl bg-white/5 dark:bg-black/5 border border-white/10 dark:border-white/5"
                        open
                      >
                        <summary className="cursor-pointer list-none px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between hover:bg-white/5 dark:hover:bg-white/[0.02] transition-colors rounded-xl">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                            <span className="text-sm sm:text-base font-semibold text-light-text-primary dark:text-dark-text-primary">
                              {group.botName}
                            </span>
                            <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                              ({group.positions.length}{" "}
                              {group.positions.length === 1
                                ? "position"
                                : "positions"}
                              )
                            </span>
                          </div>
                          <svg
                            className="w-4 h-4 sm:w-5 sm:h-5 text-light-text-tertiary dark:text-dark-text-tertiary transition-transform group-open:rotate-180"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </summary>
                        <div className="px-2 sm:px-3 pb-2 sm:pb-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm">
                              <thead>
                                <tr className="border-b border-white/10 dark:border-white/5">
                                  <th className="text-left py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                                    Side
                                  </th>
                                  <th className="text-left py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                                    Pair
                                  </th>
                                  <th className="text-right py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                                    Entry
                                  </th>
                                  <th className="text-right py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                                    Current
                                  </th>
                                  <th className="text-right py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold hidden sm:table-cell">
                                    Time
                                  </th>
                                  <th className="text-right py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold hidden md:table-cell">
                                    TP
                                  </th>
                                  <th className="text-right py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold hidden md:table-cell">
                                    SL
                                  </th>
                                  <th className="text-right py-2 px-1 sm:px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                                    Unrealized P&L
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.positions.map((pos, index) => (
                                  <tr
                                    key={pos.id}
                                    className="border-b border-white/5 dark:border-white/[0.02] hover:bg-white/5 dark:hover:bg-white/[0.02] transition-colors animate-fade-in-up"
                                    style={{
                                      animationDelay: `${index * 50}ms`,
                                      animationFillMode: "backwards",
                                    }}
                                  >
                                    <td className="py-2 px-1 sm:px-2">
                                      <span
                                        className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-semibold ${
                                          pos.side === "LONG"
                                            ? "bg-accent-green/20 text-accent-green"
                                            : "bg-accent-red/20 text-accent-red"
                                        }`}
                                      >
                                        {pos.side}
                                      </span>
                                    </td>
                                    <td className="py-2 px-1 sm:px-2 text-light-text-primary dark:text-dark-text-primary font-medium">
                                      {pos.pair}
                                    </td>
                                    <td className="py-2 px-1 sm:px-2 text-right text-light-text-secondary dark:text-dark-text-secondary">
                                      {formatCurrency(pos.entryPrice)}
                                    </td>
                                    <td className="py-2 px-1 sm:px-2 text-right text-light-text-primary dark:text-dark-text-primary font-medium">
                                      {formatCurrency(pos.currentPrice)}
                                    </td>
                                    <td className="py-2 px-1 sm:px-2 text-right text-light-text-tertiary dark:text-dark-text-tertiary text-xs hidden sm:table-cell">
                                      {formatTimeSinceEntry(pos.entryTime)}
                                    </td>
                                    <td className="py-2 px-1 sm:px-2 text-right text-light-text-tertiary dark:text-dark-text-tertiary hidden md:table-cell">
                                      {pos.takeProfit
                                        ? formatCurrency(pos.takeProfit)
                                        : "—"}
                                    </td>
                                    <td className="py-2 px-1 sm:px-2 text-right text-light-text-tertiary dark:text-dark-text-tertiary hidden md:table-cell">
                                      {pos.stopLoss
                                        ? formatCurrency(pos.stopLoss)
                                        : "—"}
                                    </td>
                                    <td className="py-2 px-1 sm:px-2 text-right">
                                      <div className="flex flex-col items-end">
                                        <span
                                          className={`font-semibold ${
                                            pos.unrealizedPnl >= 0
                                              ? "text-accent-green"
                                              : "text-accent-red"
                                          }`}
                                        >
                                          {formatSignedCurrency(
                                            pos.unrealizedPnl
                                          )}
                                        </span>
                                        <span
                                          className={`text-xs ${
                                            pos.unrealizedPnl >= 0
                                              ? "text-accent-green"
                                              : "text-accent-red"
                                          }`}
                                        >
                                          (
                                          {formatPercentage(
                                            pos.unrealizedPnlPercent
                                          )}
                                          )
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Right Column: AI Decision Feed (40%) */}
            <div className="lg:col-span-2">
              <GlassCard className="p-0 h-[600px] sm:h-[700px] lg:h-[800px] flex flex-col">
                <div className="p-4 border-b border-white/10 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                      AI Decision Feed (All Bots)
                    </h3>
                    <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                      {filteredTranscripts.length} updates
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {executionsLoading ? (
                    <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                      Loading AI decisions...
                    </div>
                  ) : executionsError ? (
                    <div className="py-6 text-center text-accent-red">
                      Failed to load AI decision history.
                    </div>
                  ) : !hasBots ? (
                    <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                      No trading bots found.
                    </div>
                  ) : filteredTranscripts.length === 0 ? (
                    <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                      No AI updates yet.
                    </div>
                  ) : (
                    filteredTranscripts.map((entry, index) => {
                      const aiModelInfo = entry.aiModel
                        ? SUPPORTED_AI_MODELS.find(
                            (m) => m.value === entry.aiModel
                          )
                        : null;
                      const aiModelLogo = aiModelInfo?.logo ?? "/ai-icon.svg";
                      const aiModelProvider = aiModelInfo?.provider ?? "AI";

                      return (
                        <div
                          key={`${entry.id}-${
                            entry.timestamp?.getTime() ?? ""
                          }`}
                          className="p-4 rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-xl shadow-glass space-y-3 animate-fade-in-up"
                          style={{
                            animationDelay: `${index * 100}ms`,
                            animationFillMode: "backwards",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <img
                                src={aiModelLogo}
                                alt={aiModelProvider}
                                className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-gray-800 p-1"
                              />
                            </div>

                            <div className="flex-1 space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                                    {entry.botName}
                                  </p>
                                  <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                                    {formatTimestamp(entry.timestamp)}
                                  </p>
                                </div>
                              </div>

                              <p className="text-sm leading-relaxed whitespace-pre-line text-light-text-primary dark:text-dark-text-primary">
                                {entry.message}
                              </p>

                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                                <span>
                                  Runtime: {formatRuntime(entry.runtimeMs)}
                                </span>
                                <span>
                                  Invocations: {entry.invocations ?? "—"}
                                </span>
                                <span>
                                  Balance:{" "}
                                  {formatCurrency(entry.balance ?? null)}
                                </span>
                                <span>
                                  Exposure:{" "}
                                  {formatCurrency(entry.exposure ?? null)}
                                </span>
                              </div>

                              {entry.decisions.length > 0 && (
                                <div className="mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                  <button
                                    onClick={() => {
                                      setExpandedDecisions((prev) => {
                                        const next = new Set(prev);
                                        const key = `public-${entry.id}`;
                                        if (next.has(key)) {
                                          next.delete(key);
                                        } else {
                                          next.add(key);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-blue hover:bg-white/5 dark:hover:bg-black/5 transition-colors select-none"
                                  >
                                    <span>
                                      {expandedDecisions.has(
                                        `public-${entry.id}`
                                      )
                                        ? "Hide individual decisions"
                                        : "Show individual decisions"}
                                    </span>
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform ${
                                        expandedDecisions.has(
                                          `public-${entry.id}`
                                        )
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  {expandedDecisions.has(
                                    `public-${entry.id}`
                                  ) && (
                                    <div className="px-3 pb-3 space-y-3">
                                      {entry.decisions.map(
                                        (decision, index) => (
                                          <div
                                            key={`${entry.id}-decision-${index}`}
                                            className="rounded-lg border border-white/10 bg-white/5 dark:bg-black/10 p-3 space-y-2"
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                                                  {decision.symbol}
                                                </span>
                                                <span
                                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    decision.action === "BUY" ||
                                                    decision.action === "LONG"
                                                      ? "bg-accent-green/20 text-accent-green"
                                                      : decision.action ===
                                                          "SELL" ||
                                                        decision.action ===
                                                          "SHORT"
                                                      ? "bg-accent-red/20 text-accent-red"
                                                      : decision.action ===
                                                        "CLOSE"
                                                      ? "bg-accent-blue/20 text-accent-blue"
                                                      : "bg-light-text-tertiary/20 text-light-text-tertiary dark:bg-dark-text-tertiary/20 dark:text-dark-text-tertiary"
                                                  }`}
                                                >
                                                  {decision.action}
                                                </span>
                                              </div>
                                              <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                                                CONF{" "}
                                                {decision.confidence !== null &&
                                                decision.confidence !==
                                                  undefined
                                                  ? `${(
                                                      decision.confidence * 100
                                                    ).toFixed(0)}%`
                                                  : "—"}
                                              </div>
                                            </div>

                                            {decision.reasoning && (
                                              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line">
                                                {decision.reasoning}
                                              </p>
                                            )}

                                            {decision.analysis && (
                                              <div className="text-xs space-y-1">
                                                <p className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                                  Analysis:
                                                </p>
                                                <p className="text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line">
                                                  {decision.analysis}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {entry.prompt && (
                                <div className="mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                  <button
                                    onClick={() => {
                                      setExpandedPrompts((prev) => {
                                        const next = new Set(prev);
                                        const key = `public-${entry.id}`;
                                        if (next.has(key)) {
                                          next.delete(key);
                                        } else {
                                          next.add(key);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-blue hover:bg-white/5 dark:hover:bg-black/5 transition-colors select-none"
                                  >
                                    <span>
                                      {expandedPrompts.has(`public-${entry.id}`)
                                        ? "Hide prompt"
                                        : "Show prompt"}
                                    </span>
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform ${
                                        expandedPrompts.has(
                                          `public-${entry.id}`
                                        )
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  {expandedPrompts.has(
                                    `public-${entry.id}`
                                  ) && (
                                    <div className="px-3 pb-3 pt-2">
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line leading-relaxed">
                                        {entry.prompt}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {entry.thinking && (
                                <div className="mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                  <button
                                    onClick={() => {
                                      setExpandedAnalysis((prev) => {
                                        const next = new Set(prev);
                                        const key = `public-${entry.id}`;
                                        if (next.has(key)) {
                                          next.delete(key);
                                        } else {
                                          next.add(key);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-full cursor-pointer flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-purple hover:bg-white/5 dark:hover:bg-black/5 transition-colors select-none"
                                  >
                                    <span>
                                      {expandedAnalysis.has(
                                        `public-${entry.id}`
                                      )
                                        ? "Hide analysis"
                                        : "Show analysis"}
                                    </span>
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform ${
                                        expandedAnalysis.has(
                                          `public-${entry.id}`
                                        )
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  {expandedAnalysis.has(
                                    `public-${entry.id}`
                                  ) && (
                                    <div className="px-3 pb-3 pt-2">
                                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line leading-relaxed">
                                        {entry.thinking}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Completed Trades Table - Full Width */}
          <GlassCard className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 sm:mb-4">
              Completed Trades (Last 10)
            </h3>
            {tradesLoading ? (
              <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                Loading completed trades...
              </div>
            ) : tradesError ? (
              <div className="py-6 text-center text-accent-red">
                Failed to load completed trades.
              </div>
            ) : completedTrades.length === 0 ? (
              <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                No completed trades yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 dark:border-white/5">
                      <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                        AI Model
                      </th>
                      <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                        Pair
                      </th>
                      <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                        Side
                      </th>
                      <th className="text-left py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold hidden sm:table-cell">
                        Leverage
                      </th>
                      <th className="text-right py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                        Entry
                      </th>
                      <th className="text-right py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                        Exit
                      </th>
                      <th className="text-right py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold hidden md:table-cell">
                        Time
                      </th>
                      <th className="text-right py-3 px-2 text-light-text-tertiary dark:text-dark-text-tertiary font-semibold">
                        P&L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedTrades.map((trade, index) => (
                      <tr
                        key={trade.id}
                        className="border-b border-white/5 dark:border-white/[0.02] hover:bg-white/5 dark:hover:bg-white/[0.02] transition-colors animate-fade-in-up"
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animationFillMode: "backwards",
                        }}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: trade.modelColor }}
                            />
                            <span className="text-light-text-primary dark:text-dark-text-primary font-medium">
                              {trade.aiModel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-light-text-primary dark:text-dark-text-primary font-medium">
                          {trade.pair}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              trade.side === "LONG"
                                ? "bg-accent-green/20 text-accent-green"
                                : "bg-accent-red/20 text-accent-red"
                            }`}
                          >
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-light-text-secondary dark:text-dark-text-secondary hidden sm:table-cell">
                          {trade.leverage}
                        </td>
                        <td className="py-3 px-2 text-right text-light-text-secondary dark:text-dark-text-secondary">
                          {formatCurrency(trade.entryPrice)}
                        </td>
                        <td className="py-3 px-2 text-right text-light-text-secondary dark:text-dark-text-secondary">
                          {trade.exitPrice
                            ? formatCurrency(trade.exitPrice)
                            : "—"}
                        </td>
                        <td className="py-3 px-2 text-right text-light-text-tertiary dark:text-dark-text-tertiary text-xs hidden md:table-cell">
                          {trade.holdingTime}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={`font-semibold ${
                                trade.pnl >= 0
                                  ? "text-accent-green"
                                  : "text-accent-red"
                              }`}
                            >
                              {formatSignedCurrency(trade.pnl)}
                            </span>
                            <span
                              className={`text-xs ${
                                trade.pnl >= 0
                                  ? "text-accent-green"
                                  : "text-accent-red"
                              }`}
                            >
                              ({formatPercentage(trade.pnlPercent)})
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* Leaderboard Tab - Top 50 Bots */}
      {activeTab === "leaderboard" && (
        <GlassCard className="p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
              Top 50 Bots by Performance Score
            </h2>
            {topBotsData && (
              <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">
                  <span className="font-semibold">Ranking Formula:</span>
                </p>
                <p className="text-sm font-mono text-light-text-primary dark:text-dark-text-primary">
                  {topBotsData.formula}
                </p>
                <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                  Minimum {topBotsData.minTradesToQualify} trades required to
                  qualify. This formula balances risk-adjusted returns with
                  trading experience.
                </p>
              </div>
            )}
          </div>
          {!topBotsData ? (
            <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
              Loading leaderboard...
            </div>
          ) : topBotsData.bots.length === 0 ? (
            <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
              No qualifying bots found. Bots need at least{" "}
              {topBotsData.minTradesToQualify} trades to appear on the
              leaderboard.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 dark:border-white/5">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      Bot Name
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      AI Model
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      Score
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      P&L %
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      MDD %
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      Win Rate
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                      Trades
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topBotsData.bots.map((bot, index) => (
                    <tr
                      key={bot.botId}
                      className="border-b border-white/5 dark:border-white/[0.02] hover:bg-white/5 dark:hover:bg-white/[0.02] transition-colors animate-fade-in-up"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animationFillMode: "backwards",
                      }}
                    >
                      <td className="py-3 px-2 text-sm text-light-text-primary dark:text-dark-text-primary font-semibold">
                        #{index + 1}
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-sm text-light-text-primary dark:text-dark-text-primary font-medium">
                          {bot.botName}
                        </div>
                        <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary font-mono">
                          {bot.walletAddress.slice(0, 6)}...
                          {bot.walletAddress.slice(-4)}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {bot.aiModel || "Unknown"}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-sm font-bold text-accent-blue">
                          {bot.performanceScore.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            bot.totalPnlPercent >= 0
                              ? "text-accent-green"
                              : "text-accent-red"
                          }`}
                        >
                          {bot.totalPnlPercent >= 0 ? "+" : ""}
                          {bot.totalPnlPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-sm text-accent-red">
                        {bot.maxDrawdownPercent.toFixed(1)}%
                      </td>
                      <td className="py-3 px-2 text-right text-sm text-light-text-primary dark:text-dark-text-primary">
                        {bot.winRate.toFixed(1)}%
                      </td>
                      <td className="py-3 px-2 text-right text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {bot.totalTrades}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
