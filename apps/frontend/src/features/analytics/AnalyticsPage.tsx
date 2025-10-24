import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Target,
  BarChart3,
} from "lucide-react";

// Helper function to get crypto icon path
const getCryptoIcon = (symbol: string | undefined): string => {
  if (!symbol) return "/crypto/btc.svg"; // Default fallback
  const coin = symbol.replace("USDT", "").toLowerCase();
  return `/crypto/${coin}.svg`;
};

export default function AnalyticsPage() {
  const [selectedBot, setSelectedBot] = useState<string>("ALL");

  const { data: bots } = useQuery({
    queryKey: ["bots"],
    queryFn: () => api.getBots(),
  });

  const {
    data: allTrades,
    isLoading: tradesLoading,
    error: tradesError,
  } = useQuery({
    queryKey: ["all-trade-history", selectedBot],
    queryFn: async () => {
      if (selectedBot === "ALL") {
        return api.getTrades();
      } else {
        return api.getBotTradeHistory(selectedBot, 500);
      }
    },
  });

  // Fetch bot metrics if a specific bot is selected (for future use)
  useQuery({
    queryKey: ["bot-metrics", selectedBot],
    queryFn: () =>
      selectedBot !== "ALL" ? api.getBotMetrics(selectedBot) : null,
    enabled: selectedBot !== "ALL",
  });

  const trades = allTrades?.data || [];
  const closedTrades = trades.filter((t: any) => t.status === "CLOSED");

  // Debug logging
  console.log("Analytics Debug:", {
    tradesLoading,
    tradesError,
    tradesCount: trades.length,
    closedTradesCount: closedTrades.length,
    sampleTrade: trades[0],
  });

  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(
    (t: any) => (t.realizedPnl || 0) > 0
  ).length;
  const losingTrades = closedTrades.filter(
    (t: any) => (t.realizedPnl || 0) < 0
  ).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnl = closedTrades.reduce(
    (sum: number, t: any) => sum + (t.realizedPnl || 0),
    0
  );
  const totalFees = closedTrades.reduce(
    (sum: number, t: any) => sum + (t.fees || 0),
    0
  );

  // Calculate additional metrics
  const avgWin =
    winningTrades > 0
      ? closedTrades
          .filter((t: any) => (t.realizedPnl || 0) > 0)
          .reduce((sum: number, t: any) => sum + t.realizedPnl, 0) /
        winningTrades
      : 0;
  const avgLoss =
    losingTrades > 0
      ? closedTrades
          .filter((t: any) => (t.realizedPnl || 0) < 0)
          .reduce((sum: number, t: any) => sum + t.realizedPnl, 0) /
        losingTrades
      : 0;
  const profitFactor = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : 0;

  // Calculate max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;
  closedTrades.forEach((t: any) => {
    runningPnl += t.realizedPnl || 0;
    if (runningPnl > peak) peak = runningPnl;
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  // Group trades by symbol
  const tradesBySymbol: Record<string, any[]> = {};
  closedTrades.forEach((t: any) => {
    if (!tradesBySymbol[t.symbol]) tradesBySymbol[t.symbol] = [];
    tradesBySymbol[t.symbol].push(t);
  });

  const symbolStats = Object.entries(tradesBySymbol)
    .map(([symbol, symbolTrades]) => {
      const pnl = symbolTrades.reduce(
        (sum, t) => sum + (t.realizedPnl || 0),
        0
      );
      const wins = symbolTrades.filter((t) => (t.realizedPnl || 0) > 0).length;
      return {
        symbol,
        trades: symbolTrades.length,
        pnl,
        winRate:
          symbolTrades.length > 0 ? (wins / symbolTrades.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);

  if (tradesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (tradesError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-danger mb-2">Error loading analytics</p>
          <p className="text-text-secondary text-sm">{String(tradesError)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
            Analytics
          </h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Performance metrics and insights
          </p>
        </div>
        <select
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
          className="input w-full sm:w-auto sm:max-w-xs"
        >
          <option value="ALL">All Bots</option>
          {bots?.data?.map((bot: any) => (
            <option key={bot.id} value={bot.id}>
              {bot.name}
            </option>
          ))}
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-text-secondary">Total Trades</p>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-text-primary">{totalTrades}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-success">{winningTrades} wins</span>
            <span className="text-xs text-text-secondary">•</span>
            <span className="text-xs text-danger">{losingTrades} losses</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-text-secondary">Win Rate</p>
            <Target className="w-4 h-4 text-success" />
          </div>
          <p className="text-3xl font-bold text-success">
            {winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-text-secondary mt-2">
            {winningTrades} / {totalTrades} trades
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-text-secondary">Total P&L</p>
            <DollarSign
              className={`w-4 h-4 ${
                totalPnl >= 0 ? "text-success" : "text-danger"
              }`}
            />
          </div>
          <p
            className={`text-3xl font-bold ${
              totalPnl >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {formatCurrency(totalPnl)}
          </p>
          <p className="text-xs text-text-secondary mt-2">
            Fees: {formatCurrency(totalFees)}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-text-secondary">Avg Trade P&L</p>
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <p
            className={`text-3xl font-bold ${
              totalPnl >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {totalTrades > 0 ? formatCurrency(totalPnl / totalTrades) : "$0.00"}
          </p>
          <p className="text-xs text-text-secondary mt-2">Per closed trade</p>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-text-secondary">Avg Win</p>
          <p className="text-2xl font-bold text-success mt-1">
            {formatCurrency(avgWin)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Avg Loss</p>
          <p className="text-2xl font-bold text-danger mt-1">
            {formatCurrency(avgLoss)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Profit Factor</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {profitFactor.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Max Drawdown</p>
          <p className="text-2xl font-bold text-danger mt-1">
            {formatCurrency(maxDrawdown)}
          </p>
        </div>
      </div>

      {/* Trade Distribution */}
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Trade Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-text-secondary">Winning Trades</p>
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-background-tertiary rounded-full h-4">
                <div
                  className="bg-success h-4 rounded-full transition-all"
                  style={{ width: `${winRate}%` }}
                />
              </div>
              <span className="text-text-primary font-medium min-w-[3rem] text-right">
                {winningTrades}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-text-secondary">Losing Trades</p>
              <TrendingDown className="w-4 h-4 text-danger" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-background-tertiary rounded-full h-4">
                <div
                  className="bg-danger h-4 rounded-full transition-all"
                  style={{ width: `${100 - winRate}%` }}
                />
              </div>
              <span className="text-text-primary font-medium min-w-[3rem] text-right">
                {losingTrades}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance by Symbol */}
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Performance by Symbol
        </h3>
        {symbolStats.length === 0 ? (
          <p className="text-center text-text-secondary py-8">
            No trade data available
          </p>
        ) : (
          <div className="space-y-3">
            {symbolStats.slice(0, 10).map((stat) => (
              <div
                key={stat.symbol}
                className="flex items-center justify-between p-3 bg-background-tertiary rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getCryptoIcon(stat.symbol)}
                    alt={stat.symbol}
                    className="w-6 h-6"
                  />
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-text-primary">
                      {stat.symbol.replace("USDT", "")}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {stat.trades} trades
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-text-secondary">
                    {stat.winRate.toFixed(0)}% WR
                  </span>
                  <span
                    className={`font-medium ${
                      stat.pnl >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatCurrency(stat.pnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
