import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

type TradeStatus = "OPEN" | "CLOSED" | "CANCELLED" | "ALL";

// Helper function to get crypto icon path
const getCryptoIcon = (symbol: string | undefined): string => {
  if (!symbol) return "/crypto/btc.svg"; // Default fallback
  const coin = symbol.replace("USDT", "").toLowerCase();
  return `/crypto/${coin}.svg`;
};

const ITEMS_PER_PAGE = 50;

export default function TradeHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<TradeStatus>("ALL");
  const [selectedBot, setSelectedBot] = useState<string>("ALL");
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const { data: bots } = useQuery({
    queryKey: ["bots"],
    queryFn: () => api.getBots(),
  });

  const {
    data: allTrades,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["all-trade-history", selectedBot, statusFilter, currentPage],
    queryFn: async () => {
      if (selectedBot === "ALL") {
        return api.getTrades(ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      } else {
        const status = statusFilter === "ALL" ? undefined : statusFilter;
        return api.getBotTradeHistory(selectedBot, 200, status);
      }
    },
  });

  const trades = allTrades?.data || [];
  const total = allTrades?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Reset page when filters change
  const handleStatusFilterChange = (newStatus: TradeStatus) => {
    setStatusFilter(newStatus);
    setCurrentPage(0);
  };

  const handleBotFilterChange = (newBot: string) => {
    setSelectedBot(newBot);
    setCurrentPage(0);
  };

  // Debug logging
  if (trades.length > 0) {
    console.log("Trade History Debug:", {
      isLoading,
      error,
      tradesCount: trades.length,
      sampleTrade: trades[0],
      openedAtValue: trades[0]?.openedAt,
      openedAtType: typeof trades[0]?.openedAt,
    });
  }

  // Filter trades by status if needed
  const filteredTrades =
    statusFilter === "ALL"
      ? trades
      : trades.filter((t: any) => t.status === statusFilter);

  // Calculate summary stats
  const totalTrades = filteredTrades.length;
  const closedTrades = filteredTrades.filter((t: any) => t.status === "CLOSED");
  const totalPnl = closedTrades.reduce(
    (sum: number, t: any) => sum + (t.realizedPnl || 0),
    0
  );
  const winningTrades = closedTrades.filter(
    (t: any) => (t.realizedPnl || 0) > 0
  ).length;
  const winRate =
    closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

  const handleExport = () => {
    const csv = [
      [
        "Date",
        "Bot",
        "Symbol",
        "Side",
        "Type",
        "Quantity",
        "Entry Price",
        "Exit Price",
        "Leverage",
        "P&L",
        "Status",
      ].join(","),
      ...filteredTrades.map((t: any) => {
        const openedDate = t.openedAt
          ? typeof t.openedAt === "number"
            ? new Date(t.openedAt * 1000)
            : new Date(t.openedAt)
          : null;
        return [
          openedDate ? openedDate.toISOString() : "N/A",
          t.botId,
          t.symbol,
          t.side,
          t.orderType,
          t.quantity,
          t.entryPrice,
          t.exitPrice || "",
          t.leverage,
          t.realizedPnl || "",
          t.status,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
            Trade History
          </h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Complete history of all executed trades
          </p>
        </div>
        <button
          onClick={handleExport}
          className="btn btn-secondary flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="card">
          <p className="text-sm text-text-secondary">Total Trades</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {totalTrades}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Closed Trades</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {closedTrades.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Win Rate</p>
          <p className="text-2xl font-bold text-success mt-1">
            {winRate.toFixed(1)}%
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Total P&L</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              totalPnl >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {formatCurrency(totalPnl)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Avg P&L</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              totalPnl >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {closedTrades.length > 0
              ? formatCurrency(totalPnl / closedTrades.length)
              : "$0.00"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text-secondary">
              Filters:
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
            <select
              value={selectedBot}
              onChange={(e) => handleBotFilterChange(e.target.value)}
              className="input flex-1 sm:max-w-xs"
            >
              <option value="ALL">All Bots</option>
              {bots?.data?.map((bot: any) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                handleStatusFilterChange(e.target.value as TradeStatus)
              }
              className="input flex-1 sm:max-w-xs"
            >
              <option value="ALL">All Status</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trade Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-text-secondary">
              Loading trades...
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              No trades found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-background-tertiary">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Bot
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Side
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Entry
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Exit
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Leverage
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    P&L
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTrades.map((trade: any) => {
                  const isExpanded = expandedTradeId === trade.id;
                  return (
                    <>
                      <tr
                        key={trade.id}
                        className="hover:bg-background-tertiary/50 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedTradeId(isExpanded ? null : trade.id)
                        }
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                          {trade.openedAt
                            ? formatDate(
                                typeof trade.openedAt === "number"
                                  ? new Date(trade.openedAt * 1000)
                                  : new Date(trade.openedAt)
                              )
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary">
                          {trade.botName || "Unknown Bot"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {trade.symbol ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={getCryptoIcon(trade.symbol)}
                                alt={trade.symbol}
                                className="w-5 h-5"
                              />
                              <div>
                                <span className="text-sm font-medium text-text-primary">
                                  {trade.symbol.replace("USDT", "")}
                                </span>
                                <span className="text-xs text-text-secondary ml-1">
                                  /USDT
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-text-secondary">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              trade.side === "BUY"
                                ? "bg-success/10 text-success"
                                : "bg-danger/10 text-danger"
                            }`}
                          >
                            {trade.side === "BUY" ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {trade.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-text-secondary">
                          {trade.orderType}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary text-right">
                          {trade.quantity.toFixed(6)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary text-right">
                          ${trade.entryPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary text-right">
                          {(() => {
                            // If exitPrice is 0 or missing but trade is closed with PnL, calculate it
                            if (
                              (!trade.exitPrice || trade.exitPrice === 0) &&
                              trade.status === "CLOSED" &&
                              trade.realizedPnl &&
                              trade.quantity &&
                              trade.entryPrice &&
                              trade.leverage
                            ) {
                              // Formula: exitPrice = entryPrice + (realizedPnl / quantity) / leverage
                              const pnlPerUnit =
                                trade.realizedPnl / trade.quantity;
                              const priceChange = pnlPerUnit / trade.leverage;
                              const calculatedExitPrice =
                                trade.side === "BUY"
                                  ? trade.entryPrice + priceChange
                                  : trade.entryPrice - priceChange;
                              return `$${calculatedExitPrice.toFixed(2)}`;
                            }
                            return trade.exitPrice
                              ? `$${trade.exitPrice.toFixed(2)}`
                              : "-";
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-text-primary text-center">
                          {trade.leverage}x
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          {trade.realizedPnl !== null &&
                          trade.realizedPnl !== undefined ? (
                            <span
                              className={
                                trade.realizedPnl >= 0
                                  ? "text-success font-medium"
                                  : "text-danger font-medium"
                              }
                            >
                              {formatCurrency(trade.realizedPnl)}
                            </span>
                          ) : (
                            <span className="text-text-secondary">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              trade.status === "OPEN"
                                ? "bg-primary/10 text-primary"
                                : trade.status === "CLOSED"
                                ? "bg-success/10 text-success"
                                : "bg-text-secondary/10 text-text-secondary"
                            }`}
                          >
                            {trade.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-text-secondary" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-text-secondary" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-4 py-4 bg-background-tertiary/30"
                          >
                            <div className="space-y-3 text-sm">
                              {trade.aiReasoning && (
                                <div>
                                  <p className="font-medium text-text-primary mb-1">
                                    AI Reasoning:
                                  </p>
                                  <p className="text-text-secondary">
                                    {trade.aiReasoning}
                                  </p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {trade.margin && (
                                  <div>
                                    <p className="text-text-secondary">
                                      Margin:
                                    </p>
                                    <p className="text-text-primary font-medium">
                                      {formatCurrency(trade.margin)}
                                    </p>
                                  </div>
                                )}
                                {trade.fees !== null &&
                                  trade.fees !== undefined && (
                                    <div>
                                      <p className="text-text-secondary">
                                        Fees:
                                      </p>
                                      <p className="text-text-primary font-medium">
                                        {formatCurrency(trade.fees)}
                                      </p>
                                    </div>
                                  )}
                                {trade.orderId && (
                                  <div>
                                    <p className="text-text-secondary">
                                      Order ID:
                                    </p>
                                    <p className="text-text-primary font-mono text-xs">
                                      {trade.orderId}
                                    </p>
                                  </div>
                                )}
                                {trade.closedAt && (
                                  <div>
                                    <p className="text-text-secondary">
                                      Closed At:
                                    </p>
                                    <p className="text-text-primary">
                                      {formatDate(new Date(trade.closedAt))}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {selectedBot === "ALL" && !isLoading && filteredTrades.length > 0 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              Showing {currentPage * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min((currentPage + 1) * ITEMS_PER_PAGE, total)} of {total}{" "}
              trades
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-2 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-text-primary">
                Page {currentPage + 1} of {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-2 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
