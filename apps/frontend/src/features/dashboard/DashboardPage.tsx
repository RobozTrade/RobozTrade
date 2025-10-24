import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PriceTicker } from "@/components/dashboard/PriceTicker";
import { BotPerformanceChart } from "@/components/dashboard/BotPerformanceChart";
import { IndividualBotPerformance } from "@/components/dashboard/IndividualBotPerformance";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import type { TradingBot, AIModel } from "@roboz-trade/shared-types";
import { SUPPORTED_AI_MODELS } from "@roboz-trade/shared-types";

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
  aiRuntimeMs?: number | null;
  aiInvocations?: number | null;
  accountBalance?: number | null;
  totalBalance?: number | null;
  accountExposure?: number | null;
  unrealizedPnl?: number | null;
  tradesExecuted?: number | null;
  aiDecisions?: unknown;
}

interface BotDecision {
  symbol: string;
  action: string;
  confidence?: number | null;
  reasoning?: string;
  exitStrategy?: string;
  notedAt?: Date | null;
  raw?: Record<string, unknown>;
}

interface BotTranscriptEntry {
  id: string;
  botId: string;
  botName: string;
  aiModel: AIModel | null;
  color: string;
  timestamp: Date | null;
  message: string;
  thinking: string | null;
  runtimeMs: number | null | undefined;
  invocations: number | null | undefined;
  balance: number | null | undefined;
  exposure: number | null | undefined;
  tradesExecuted: number | null | undefined;
  decisions: BotDecision[];
}

interface BotExecutionResult {
  botId: string;
  executions: BotExecutionEntry[];
  error?: string;
}

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

const getActionBadgeClasses = (action: string): string => {
  const normalized = action.toUpperCase();
  if (
    normalized === "BUY" ||
    normalized === "LONG" ||
    normalized === "OPEN_LONG"
  ) {
    return "bg-accent-green/20 text-accent-green";
  }
  if (
    normalized === "SELL" ||
    normalized === "SHORT" ||
    normalized === "OPEN_SHORT"
  ) {
    return "bg-accent-red/20 text-accent-red";
  }
  if (
    normalized === "WAIT" ||
    normalized === "HOLD" ||
    normalized === "NEUTRAL"
  ) {
    return "bg-accent-blue/20 text-accent-blue";
  }
  return "bg-white/10 text-light-text-primary dark:text-dark-text-primary";
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseConfidenceValue = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseDecisionTimestamp = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const normalizeDecisions = (value: unknown): BotDecision[] => {
  if (!value) return [];

  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  const decisionsArray: unknown[] = Array.isArray(raw)
    ? raw
    : isObject(raw) && Array.isArray((raw as Record<string, unknown>).decisions)
    ? ((raw as Record<string, unknown>).decisions as unknown[])
    : isObject(raw)
    ? Object.values(raw as Record<string, unknown>)
    : [];

  return decisionsArray.filter(isObject).map((item) => {
    const symbol = String(
      item.symbol ?? item.pair ?? item.baseSymbol ?? "Unknown"
    );
    const action = String(
      (item.action ?? item.decision ?? item.side ?? "WAIT").toString()
    ).toUpperCase();
    const confidenceRaw =
      item.confidence ??
      item.confidenceScore ??
      item.conf ??
      item.confidence_percent;
    const confidence = parseConfidenceValue(confidenceRaw);
    const reasoning =
      typeof item.reasoning === "string"
        ? item.reasoning
        : typeof item.summary === "string"
        ? item.summary
        : typeof item.commentary === "string"
        ? item.commentary
        : undefined;
    const exitStrategy =
      typeof item.exitStrategy === "string"
        ? item.exitStrategy
        : typeof item.exit_strategy === "string"
        ? item.exit_strategy
        : undefined;
    const notedAt = parseDecisionTimestamp(
      item.timestamp ?? item.notedAt ?? item.time
    );

    return {
      symbol,
      action,
      confidence,
      reasoning,
      exitStrategy,
      notedAt,
      raw: item,
    } satisfies BotDecision;
  });
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

const formatConfidence = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
};

const extractSummary = (aiResponse: string | null | undefined): string => {
  if (!aiResponse) return "No AI summary available.";

  try {
    // Try to parse as JSON (same as backend does)
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Extract summary field from JSON
        if (typeof parsed.summary === "string" && parsed.summary.trim()) {
          return parsed.summary.trim();
        }

        // Fallback: extract text before JSON
        if (jsonMatch.index !== undefined && jsonMatch.index > 0) {
          const leadingText = aiResponse.slice(0, jsonMatch.index).trim();
          if (leadingText) {
            return leadingText;
          }
        }
      } catch (jsonError) {
        // JSON parsing failed, try to extract text before the JSON attempt
        if (jsonMatch.index !== undefined && jsonMatch.index > 0) {
          const leadingText = aiResponse.slice(0, jsonMatch.index).trim();
          if (leadingText) {
            const firstSentenceMatch = leadingText.match(/^[^.!?]*[.!?]/);
            if (firstSentenceMatch) {
              return firstSentenceMatch[0].trim();
            }
            return leadingText.length > 150
              ? leadingText.substring(0, 150) + "..."
              : leadingText;
          }
        }
        // If no leading text, fall through to plain text extraction
      }
    }

    // Fallback: Use first sentence from plain text
    const trimmed = aiResponse.trim();
    const firstSentenceMatch = trimmed.match(/^[^.!?]*[.!?]/);
    if (firstSentenceMatch) {
      return firstSentenceMatch[0].trim();
    }

    // Last resort: truncate
    if (trimmed.length > 150) {
      return trimmed.substring(0, 150) + "...";
    }

    return trimmed;
  } catch (error) {
    // Silently handle errors and return truncated text
    const trimmed = aiResponse.trim();
    return trimmed.length > 150 ? trimmed.substring(0, 150) + "..." : trimmed;
  }
};

const getAIModelLogo = (aiModel: AIModel | null | undefined): string => {
  if (!aiModel) return "/ai-icon.svg";
  const modelInfo = SUPPORTED_AI_MODELS.find((m) => m.value === aiModel);
  return modelInfo?.logo ?? "/ai-icon.svg";
};

export default function DashboardPageNew() {
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [selectedSingleBotId, setSelectedSingleBotId] = useState<string | null>(
    null
  );

  const {
    data: bots = [],
    isLoading: botsLoading,
    isError: botsError,
  } = useQuery<TradingBot[]>({
    queryKey: ["bots"],
    queryFn: async () => {
      const response = await api.getBots();
      return (response.data ?? []) as TradingBot[];
    },
    staleTime: 60_000,
    gcTime: Infinity, // Never garbage collect - keep data forever
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  // Ensure bots is always an array
  const safeBots = Array.isArray(bots) ? bots : [];
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

  useEffect(() => {
    const currentBotIds = safeBots.map((bot) => bot.id);

    if (currentBotIds.length === 0) {
      setSelectedBotIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    setSelectedBotIds((prev) => {
      if (
        prev.length === currentBotIds.length &&
        prev.every((id, index) => id === currentBotIds[index])
      ) {
        return prev;
      }
      return currentBotIds;
    });
  }, [safeBots]);

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

  const handleSelectSingleBot = (botId: string) => {
    setSelectedSingleBotId(botId);
  };

  const handleGoBack = () => {
    setSelectedSingleBotId(null);
  };

  const {
    data: tradesResponse = [],
    isLoading: tradesLoading,
    isError: tradesError,
  } = useQuery<TradeHistoryEntry[]>({
    queryKey: ["completed-trades"],
    enabled: safeBots.length > 0,
    queryFn: async () => {
      const response = await api.getAllTradeHistory(50); // Fetch 50 to ensure we get 10 closed trades
      return (response.data ?? []) as TradeHistoryEntry[];
    },
    staleTime: 60_000, // Keep data fresh for 1 minute
    gcTime: Infinity, // Never garbage collect - keep data forever
    refetchInterval: 120_000, // 2 minutes
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const completedTrades: CompletedTradeRow[] = useMemo(() => {
    if (!tradesResponse || tradesResponse.length === 0) return [];

    let filteredTrades = [...tradesResponse]
      .filter((trade) => trade.status === "CLOSED")
      .sort((a, b) => {
        const closedA = toDate(a.closedAt) ?? toDate(a.openedAt);
        const closedB = toDate(b.closedAt) ?? toDate(b.openedAt);
        return (closedB?.getTime() ?? 0) - (closedA?.getTime() ?? 0);
      });

    // Filter by single bot selection if active
    if (selectedSingleBotId) {
      filteredTrades = filteredTrades.filter(
        (trade) => trade.botId === selectedSingleBotId
      );
    }

    return filteredTrades
      .slice(0, 10) // Take only the latest 10 closed trades
      .map((trade) => {
        const bot = botById.get(trade.botId);
        const margin = trade.margin ?? 0;
        const realizedPnl = trade.realizedPnl ?? 0;

        return {
          id: trade.id,
          aiModel: bot?.name ?? "Unknown Bot",
          aiModelValue: bot?.aiModel ?? null,
          modelColor: colorByBotId.get(trade.botId) ?? BOT_COLOR_PALETTE[0],
          pair: formatTradingPair(trade.symbol),
          side: mapTradeSide(trade.side),
          leverage: trade.leverage ? `${trade.leverage}x` : "—",
          entryPrice: trade.entryPrice ?? 0,
          exitPrice: trade.exitPrice ?? null,
          holdingTime: formatDuration(
            trade.openedAt,
            trade.closedAt ?? trade.openedAt
          ),
          pnl: realizedPnl,
          pnlPercent: margin ? (realizedPnl / margin) * 100 : 0,
        } satisfies CompletedTradeRow;
      });
  }, [tradesResponse, botById, colorByBotId, selectedSingleBotId]);

  const {
    data: positionsResponse = [],
    isLoading: positionsLoading,
    isError: positionsError,
  } = useQuery<Array<{ botId: string; positions: PositionSnapshot[] }>>({
    queryKey: ["bot-positions"],
    enabled: safeBots.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        safeBots.map(async (bot) => {
          try {
            const response = await api.getBotPositions(bot.id);
            return {
              botId: bot.id,
              positions: (response.data ?? []) as PositionSnapshot[],
            };
          } catch (error) {
            console.error(`Failed to fetch positions for bot ${bot.id}`, error);
            return { botId: bot.id, positions: [] as PositionSnapshot[] };
          }
        })
      );

      return results;
    },
    staleTime: 60_000, // Keep data fresh for 1 minute
    gcTime: Infinity, // Never garbage collect - keep data forever
    refetchInterval: 120_000, // 2 minutes
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const {
    data: executionsResponse = [],
    isLoading: executionsLoading,
    isError: executionsError,
  } = useQuery<BotExecutionResult[]>({
    queryKey: ["bot-executions"],
    enabled: safeBots.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        safeBots.map(async (bot) => {
          try {
            const response = await api.getBotExecutionHistory(bot.id, 20);
            return {
              botId: bot.id,
              executions: (response.data ?? []) as BotExecutionEntry[],
            } satisfies BotExecutionResult;
          } catch (error) {
            console.error(
              `Failed to fetch execution history for bot ${bot.id}`,
              error
            );
            return {
              botId: bot.id,
              executions: [],
              error: "Failed to load execution history",
            } satisfies BotExecutionResult;
          }
        })
      );

      return results;
    },
    staleTime: 60_000, // Keep data fresh for 1 minute
    gcTime: Infinity, // Never garbage collect - keep data forever
    refetchInterval: 120_000, // 2 minutes
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
  });

  const executionErrors = useMemo(() => {
    return executionsResponse.filter((result) => result.error);
  }, [executionsResponse]);

  const transcripts: BotTranscriptEntry[] = useMemo(() => {
    if (!executionsResponse || executionsResponse.length === 0) return [];

    const items: BotTranscriptEntry[] = [];

    executionsResponse.forEach(({ botId, executions }) => {
      if (!executions || executions.length === 0) return;
      const bot = botById.get(botId);
      const color = colorByBotId.get(botId) ?? BOT_COLOR_PALETTE[0];

      executions.forEach((execution) => {
        if (!execution || !execution.id) return;
        const timestamp = toDate(execution.executionTime ?? null);

        // Extract only summary from aiResponse (first sentence or first 150 chars)
        const aiResponseText = execution.aiResponse?.toString().trim() || "";
        const summary = extractSummary(aiResponseText);

        items.push({
          id: execution.id,
          botId,
          botName: bot?.name ?? "Unknown Bot",
          aiModel: bot?.aiModel ?? null,
          color,
          timestamp,
          message: summary,
          thinking: execution.aiThinking?.toString().trim() || null,
          runtimeMs: execution.aiRuntimeMs,
          invocations: execution.aiInvocations,
          balance: execution.accountBalance ?? execution.totalBalance ?? null,
          exposure: execution.accountExposure ?? null,
          tradesExecuted: execution.tradesExecuted ?? null,
          decisions: normalizeDecisions(execution.aiDecisions),
        });
      });
    });

    return items.sort((a, b) => {
      const aTime = a.timestamp?.getTime() ?? 0;
      const bTime = b.timestamp?.getTime() ?? 0;
      return bTime - aTime;
    });
  }, [executionsResponse, botById, colorByBotId]);

  const filteredTranscripts = useMemo(() => {
    if (selectedSingleBotId) {
      // When single bot is selected, show only that bot's transcripts
      return transcripts.filter((entry) => entry.botId === selectedSingleBotId);
    }
    if (selectedBotIds.length === 0) return transcripts;
    const selectedSet = new Set(selectedBotIds);
    return transcripts.filter((entry) => selectedSet.has(entry.botId));
  }, [transcripts, selectedBotIds, selectedSingleBotId]);

  const positionsByBot: BotPositionGroup[] = useMemo(() => {
    if (!positionsResponse || positionsResponse.length === 0) return [];

    let filteredPositions = positionsResponse;

    // Filter by single bot selection if active
    if (selectedSingleBotId) {
      filteredPositions = positionsResponse.filter(
        ({ botId }) => botId === selectedSingleBotId
      );
    }

    return filteredPositions
      .map(({ botId, positions }) => {
        const bot = botById.get(botId);
        const mappedPositions = (positions ?? [])
          .filter((position) => Math.abs(position.quantity) > 0)
          .map((position) => {
            const margin = position.margin ?? 0;
            const unrealizedPnl = position.unrealizedPnl ?? 0;
            const side = position.quantity >= 0 ? "LONG" : "SHORT";

            return {
              id: position.id,
              side,
              pair: formatTradingPair(position.symbol),
              entryPrice: position.entryPrice ?? 0,
              currentPrice: position.currentPrice ?? 0,
              takeProfit: position.takeProfit ?? null,
              stopLoss: position.stopLoss ?? null,
              unrealizedPnl,
              unrealizedPnlPercent: margin ? (unrealizedPnl / margin) * 100 : 0,
              entryTime: position.entryTime ?? null,
            } satisfies BotPositionRow;
          });

        return {
          botId,
          botName: bot?.name ?? "Unknown Bot",
          aiModelValue: bot?.aiModel ?? null,
          color: colorByBotId.get(botId) ?? BOT_COLOR_PALETTE[0],
          positions: mappedPositions,
        } satisfies BotPositionGroup;
      })
      .filter((group) => group.positions.length > 0)
      .sort((a, b) => a.botName.localeCompare(b.botName));
  }, [positionsResponse, botById, colorByBotId, selectedSingleBotId]);
  return (
    <div className="min-h-screen">
      {/* Price Ticker */}
      <PriceTicker />

      <div className="max-w-[1920px] mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Go Back Button - Only show when single bot is selected */}
        {selectedSingleBotId && (
          <div className="flex items-center gap-4">
            <button
              onClick={handleGoBack}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 text-white rounded-lg transition-colors"
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
              Back to All Bots
            </button>
            <div className="flex items-center gap-2">
              <img
                src={getAIModelLogo(botById.get(selectedSingleBotId)?.aiModel)}
                alt="AI Model"
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
          <BotPerformanceChart selectedSingleBotId={selectedSingleBotId} />
        </GlassCard>

        {/* Individual Bot Performance Section - Hide when single bot is selected */}
        {!selectedSingleBotId && (
          <IndividualBotPerformance onSelectBot={handleSelectSingleBot} />
        )}

        {/* Two-Column Layout: Tables + Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Left Column: Trading Tables (60%) */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            {/* Completed Trades Table */}
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
                  Create a trading bot to start seeing completed trades.
                </div>
              ) : completedTrades.length === 0 ? (
                <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                  No completed trades yet. Your bots will appear here once
                  trades are closed.
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
                        {completedTrades.map((trade) => (
                          <tr
                            key={trade.id}
                            className="border-b border-white/5 hover:bg-white/5 dark:hover:bg-black/5 transition-colors"
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

            {/* Current Positions Table - Grouped by AI Model */}
            <GlassCard className="p-4 sm:p-6">
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
                  Create a trading bot to start tracking live positions.
                </div>
              ) : positionsByBot.length === 0 ? (
                <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                  No open positions at the moment.
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
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
                              {group.positions.map((position) => (
                                <tr
                                  key={position.id}
                                  className="border-b border-white/5 hover:bg-white/5 dark:hover:bg-black/5 transition-colors"
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
                                          position.unrealizedPnl >= 0
                                            ? "text-accent-green"
                                            : "text-accent-red"
                                        }`}
                                      >
                                        {formatSignedCurrency(
                                          position.unrealizedPnl
                                        )}
                                      </span>
                                      <span
                                        className={`text-xs ${
                                          position.unrealizedPnl >= 0
                                            ? "text-accent-green"
                                            : "text-accent-red"
                                        }`}
                                      >
                                        (
                                        {formatPercentage(
                                          position.unrealizedPnlPercent
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
                      className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors text-light-text-primary dark:text-dark-text-primary"
                    >
                      All Bots
                    </button>
                    <button
                      onClick={handleClearBots}
                      className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors text-light-text-primary dark:text-dark-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={selectedBotIds.length === 0}
                    >
                      Clear
                    </button>

                    {safeBots.map((bot) => {
                      const isActive = selectedBotIds.includes(bot.id);
                      return (
                        <button
                          key={bot.id}
                          onClick={() => handleToggleBotSelection(bot.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm transition-colors ${
                            isActive
                              ? "border-white/40 bg-white/10"
                              : "border-white/10 hover:border-white/20 hover:bg-white/5"
                          }`}
                        >
                          <img
                            src={getAIModelLogo(bot.aiModel)}
                            alt="AI Model"
                            className="w-4 h-4 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                          />
                          <span className="text-light-text-primary dark:text-dark-text-primary">
                            {bot.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {executionErrors.length > 0 && (
                  <div className="text-xs text-accent-orange">
                    {executionErrors.length} bot(s) failed to load decisions.
                    Latest data shown for others.
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
                    Create a trading bot to start receiving AI guidance.
                  </div>
                ) : filteredTranscripts.length === 0 ? (
                  <div className="py-6 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    No AI updates for the selected bots yet.
                  </div>
                ) : (
                  filteredTranscripts.map((entry) => {
                    const aiModelInfo = entry.aiModel
                      ? SUPPORTED_AI_MODELS.find(
                          (m) => m.value === entry.aiModel
                        )
                      : null;
                    const aiModelLogo = aiModelInfo?.logo ?? "/ai-icon.svg";
                    const aiModelProvider = aiModelInfo?.provider ?? "AI";

                    return (
                      <div
                        key={`${entry.id}-${entry.timestamp?.getTime() ?? ""}`}
                        className="p-4 rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-xl shadow-glass space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <img
                              src={aiModelLogo}
                              alt={aiModelProvider}
                              className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-gray-800 p-1"
                              onError={(e) => {
                                // Fallback to Bot icon if AI model logo not found
                                const target = e.currentTarget;
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<div class="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg" style="background-color: ${entry.color}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg></div>`;
                                }
                              }}
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
                              {entry.tradesExecuted !== null &&
                                entry.tradesExecuted !== undefined && (
                                  <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary text-right">
                                    Trades: {entry.tradesExecuted}
                                  </div>
                                )}
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
                                Balance: {formatCurrency(entry.balance ?? null)}
                              </span>
                              <span>
                                Exposure:{" "}
                                {formatCurrency(entry.exposure ?? null)}
                              </span>
                            </div>

                            {entry.decisions.length > 0 && (
                              <details className="group mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                <summary className="cursor-pointer list-none flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-blue">
                                  <span className="group-open:hidden">
                                    Show individual decisions
                                  </span>
                                  <span className="hidden group-open:inline">
                                    Hide individual decisions
                                  </span>
                                  <svg
                                    className="w-3.5 h-3.5 transition-transform group-open:rotate-180"
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
                                <div className="px-3 pb-3 space-y-3">
                                  {entry.decisions.map((decision, index) => (
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
                                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getActionBadgeClasses(
                                              decision.action
                                            )}`}
                                          >
                                            {decision.action}
                                          </span>
                                        </div>
                                        <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                                          CONF{" "}
                                          {formatConfidence(
                                            decision.confidence
                                          )}
                                        </div>
                                      </div>

                                      {decision.reasoning && (
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line">
                                          {decision.reasoning}
                                        </p>
                                      )}

                                      {decision.exitStrategy && (
                                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                          <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                            Exit Strategy:
                                          </span>{" "}
                                          {decision.exitStrategy}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {entry.thinking && (
                              <details className="group mt-2 border border-white/10 rounded-xl bg-white/5 dark:bg-black/5">
                                <summary className="cursor-pointer list-none flex items-center justify-between px-3 py-2 text-xs font-semibold text-accent-purple">
                                  <span className="group-open:hidden">
                                    Show analysis
                                  </span>
                                  <span className="hidden group-open:inline">
                                    Hide analysis
                                  </span>
                                  <svg
                                    className="w-3.5 h-3.5 transition-transform group-open:rotate-180"
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
                                <div className="px-3 pb-3 pt-2">
                                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-line leading-relaxed">
                                    {entry.thinking}
                                  </p>
                                </div>
                              </details>
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
      </div>
    </div>
  );
}
