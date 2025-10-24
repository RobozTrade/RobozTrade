import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Filter, Download } from "lucide-react";

type TradeStatus = "OPEN" | "CLOSED" | "CANCELLED" | "ALL";

export default function TradeHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<TradeStatus>("ALL");
  const [selectedBot, setSelectedBot] = useState<string>("ALL");

  const { data: bots } = useQuery({
    queryKey: ["bots"],
    queryFn: () => api.getBots(),
  });

  const {
    data: allTrades,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["all-trade-history", selectedBot, statusFilter],
    queryFn: async () => {
      if (selectedBot === "ALL") {
        return api.getTrades();
      } else {
        const status = statusFilter === "ALL" ? undefined : statusFilter;
        return api.getBotTradeHistory(selectedBot, 200, status);
      }
    },
  });

  const trades = allTrades?.data || [];

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
              onChange={(e) => setSelectedBot(e.target.value)}
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
              onChange={(e) => setStatusFilter(e.target.value as TradeStatus)}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTrades.map((trade: any) => (
                  <tr
                    key={trade.id}
                    className="hover:bg-background-tertiary/50 transition-colors"
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-text-primary">
                        {trade.symbol.replace("USDT", "")}
                      </span>
                      <span className="text-xs text-text-secondary ml-1">
                        USDT
                      </span>
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
                      {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : "-"}
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
