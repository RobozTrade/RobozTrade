import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Power, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SUPPORTED_AI_MODELS } from "@roboz-trade/shared-types";
import type { BotStatus } from "@roboz-trade/shared-types";

// Helper function to get crypto icon path
const getCryptoIcon = (symbol: string | undefined): string => {
  if (!symbol) return "/crypto/btc.svg"; // Default fallback
  const coin = symbol.replace("USDT", "").toLowerCase();
  return `/crypto/${coin}.svg`;
};

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const { data: bot, isLoading } = useQuery({
    queryKey: ["bot", id],
    queryFn: () => api.getBot(id!),
    enabled: !!id,
  });

  const { data: trades } = useQuery({
    queryKey: ["bot-trade-history", id],
    queryFn: () => api.getBotTradeHistory(id!, 50),
    enabled: !!id,
  });

  const updateBotMutation = useMutation({
    mutationFn: (status: BotStatus) => api.updateBot(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot", id] });
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      setIsTogglingStatus(false);
    },
    onError: () => {
      setIsTogglingStatus(false);
    },
  });

  const deleteBotMutation = useMutation({
    mutationFn: () => api.deleteBot(id!),
    onSuccess: () => {
      navigate("/app/bots");
    },
  });

  const handleStatusToggle = () => {
    if (!bot?.data) return;
    setIsTogglingStatus(true);
    const newStatus: BotStatus =
      bot.data.status === "active" ? "draft" : "active";
    updateBotMutation.mutate(newStatus);
  };

  const handleDelete = () => {
    deleteBotMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bot?.data) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">Bot not found</p>
      </div>
    );
  }

  const botData = bot.data;
  const isNewBot = !!botData.tradingSymbols; // New bots have tradingSymbols
  const isActive = botData.status === "active";

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/bots")}
            className="btn btn-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              {botData.name}
            </h1>
            <p className="text-text-secondary mt-1">
              {isNewBot
                ? `${
                    (botData.tradingSymbols as string[])?.length || 0
                  } Trading Symbols`
                : botData.tradingPair}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Toggle */}
          <button
            onClick={handleStatusToggle}
            disabled={isTogglingStatus}
            className={`btn flex items-center gap-2 ${
              isActive ? "btn-success" : "btn-secondary"
            }`}
          >
            {isTogglingStatus ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            {isActive ? "Active" : "Inactive"}
          </button>

          {/* Edit Button */}
          <button
            onClick={() => navigate(`/app/bots/${id}/edit`)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>

          {/* Delete Button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn btn-danger flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-text-primary mb-4">
              Delete Bot
            </h3>
            <p className="text-text-secondary mb-6">
              Are you sure you want to delete "{botData.name}"? This action
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary flex-1"
                disabled={deleteBotMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                disabled={deleteBotMutation.isPending}
              >
                {deleteBotMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bot Configuration */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Bot Configuration
          </h3>
          <div className="space-y-3">
            {isNewBot ? (
              <>
                <div>
                  <p className="text-sm text-text-secondary mb-2">
                    Trading Symbols
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(botData.tradingSymbols as string[])?.map((symbol) => (
                      <div
                        key={symbol}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background-tertiary rounded-lg"
                      >
                        <img
                          src={getCryptoIcon(symbol)}
                          alt={symbol}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-text-primary">
                          {symbol.replace("USDT", "")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Margin Asset</p>
                  <p className="text-text-primary font-medium">USDT</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">AI Model</p>
                  <div className="flex items-center gap-2 mt-1">
                    {SUPPORTED_AI_MODELS.find(
                      (m) => m.value === botData.aiModel
                    )?.logo && (
                      <img
                        src={
                          SUPPORTED_AI_MODELS.find(
                            (m) => m.value === botData.aiModel
                          )?.logo
                        }
                        alt={
                          SUPPORTED_AI_MODELS.find(
                            (m) => m.value === botData.aiModel
                          )?.provider
                        }
                        className="w-6 h-6 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                      />
                    )}
                    <p className="text-text-primary font-medium">
                      {SUPPORTED_AI_MODELS.find(
                        (m) => m.value === botData.aiModel
                      )?.label ||
                        botData.aiModel ||
                        "N/A"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Custom Prompt</p>
                  <p className="text-text-primary font-medium">
                    {botData.customPrompt ? "Custom" : "Default"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-text-secondary">Strategy Type</p>
                  <p className="text-text-primary font-medium">
                    {botData.strategyType?.replace("_", " ").toUpperCase() ||
                      "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Trading Pair</p>
                  <p className="text-text-primary font-medium">
                    {botData.tradingPair || "N/A"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Risk Management */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Risk Management
          </h3>
          <div className="space-y-3">
            {isNewBot ? (
              <>
                <div>
                  <p className="text-sm text-text-secondary">Max Leverage</p>
                  <p className="text-text-primary font-medium">
                    {botData.maxLeverage ? `${botData.maxLeverage}x` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">
                    Min Notional Per Trade
                  </p>
                  <p className="text-text-primary font-medium">
                    {botData.minNotionalPerTrade
                      ? `${botData.minNotionalPerTrade} USDT`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">
                    Max Notional Per Trade
                  </p>
                  <p className="text-text-primary font-medium">
                    {botData.maxNotionalPerTrade
                      ? `${botData.maxNotionalPerTrade} USDT`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Max Open Trades</p>
                  <p className="text-text-primary font-medium">
                    {botData.maxOpenTrades || "N/A"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-text-secondary">
                    Max Position Size
                  </p>
                  <p className="text-text-primary font-medium">
                    {botData.riskConfig?.maxPositionSize || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Stop Loss</p>
                  <p className="text-text-primary font-medium">
                    {botData.riskConfig?.stopLossPercentage
                      ? `${botData.riskConfig.stopLossPercentage}%`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Take Profit</p>
                  <p className="text-text-primary font-medium">
                    {botData.riskConfig?.takeProfitPercentage
                      ? `${botData.riskConfig.takeProfitPercentage}%`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Max Daily Loss</p>
                  <p className="text-text-primary font-medium">
                    {botData.riskConfig?.maxDailyLoss || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Max Open Trades</p>
                  <p className="text-text-primary font-medium">
                    {botData.riskConfig?.maxOpenTrades || "N/A"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Configuration (for legacy bots) */}
      {!isNewBot && botData.config && (
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Strategy Parameters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* MA Cross Strategy */}
            {botData.strategyType === "ma_cross" && (
              <>
                <div>
                  <p className="text-sm text-text-secondary">Short Period</p>
                  <p className="text-text-primary font-medium">
                    {botData.config.shortPeriod || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Long Period</p>
                  <p className="text-text-primary font-medium">
                    {botData.config.longPeriod || "N/A"}
                  </p>
                </div>
              </>
            )}

            {/* RSI Strategy */}
            {botData.strategyType === "rsi" && (
              <>
                <div>
                  <p className="text-sm text-text-secondary">RSI Period</p>
                  <p className="text-text-primary font-medium">
                    {botData.config.rsiPeriod || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">
                    Oversold Threshold
                  </p>
                  <p className="text-text-primary font-medium">
                    {botData.config.oversoldThreshold || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">
                    Overbought Threshold
                  </p>
                  <p className="text-text-primary font-medium">
                    {botData.config.overboughtThreshold || "N/A"}
                  </p>
                </div>
              </>
            )}

            {/* Bollinger Bands Strategy */}
            {botData.strategyType === "bollinger" && (
              <>
                <div>
                  <p className="text-sm text-text-secondary">Period</p>
                  <p className="text-text-primary font-medium">
                    {botData.config.period || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">
                    Standard Deviations
                  </p>
                  <p className="text-text-primary font-medium">
                    {botData.config.standardDeviations || "N/A"}
                  </p>
                </div>
              </>
            )}

            {/* Custom Strategy */}
            {botData.strategyType === "custom" &&
              botData.config.customLogic && (
                <div className="col-span-full">
                  <p className="text-sm text-text-secondary mb-2">
                    Custom Logic
                  </p>
                  <pre className="text-text-primary font-mono text-xs bg-surface-light p-3 rounded-lg overflow-x-auto">
                    {botData.config.customLogic}
                  </pre>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Custom Prompt Display (for new bots) */}
      {isNewBot && botData.customPrompt && (
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Custom AI Prompt
          </h3>
          <pre className="text-text-primary font-mono text-sm bg-surface-light p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {botData.customPrompt}
          </pre>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Trade History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-text-secondary font-medium">
                  Date
                </th>
                <th className="text-left py-3 text-text-secondary font-medium">
                  Symbol
                </th>
                <th className="text-left py-3 text-text-secondary font-medium">
                  Side
                </th>
                <th className="text-right py-3 text-text-secondary font-medium">
                  Entry Price
                </th>
                <th className="text-right py-3 text-text-secondary font-medium">
                  Exit Price
                </th>
                <th className="text-right py-3 text-text-secondary font-medium">
                  Quantity
                </th>
                <th className="text-center py-3 text-text-secondary font-medium">
                  Leverage
                </th>
                <th className="text-right py-3 text-text-secondary font-medium">
                  P&L
                </th>
                <th className="text-center py-3 text-text-secondary font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {trades?.data?.map((trade: any) => (
                <tr key={trade.id} className="border-b border-border">
                  <td className="py-3 text-text-primary text-sm">
                    {trade.openedAt
                      ? formatDate(
                          typeof trade.openedAt === "number"
                            ? new Date(trade.openedAt * 1000)
                            : new Date(trade.openedAt)
                        )
                      : "N/A"}
                  </td>
                  <td className="py-3">
                    {trade.symbol ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={getCryptoIcon(trade.symbol)}
                          alt={trade.symbol}
                          className="w-5 h-5"
                        />
                        <span className="text-sm font-medium text-text-primary">
                          {trade.symbol.replace("USDT", "")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-text-secondary">N/A</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                        trade.side === "BUY"
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-3 text-right text-text-primary text-sm">
                    ${trade.entryPrice?.toFixed(2) || "0.00"}
                  </td>
                  <td className="py-3 text-right text-text-primary text-sm">
                    {(() => {
                      // Calculate exit price if missing but trade is closed
                      if (
                        (!trade.exitPrice || trade.exitPrice === 0) &&
                        trade.status === "CLOSED" &&
                        trade.realizedPnl &&
                        trade.quantity &&
                        trade.entryPrice &&
                        trade.leverage
                      ) {
                        const pnlPerUnit = trade.realizedPnl / trade.quantity;
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
                  <td className="py-3 text-right text-text-primary text-sm">
                    {trade.quantity?.toFixed(4) || "0"}
                  </td>
                  <td className="py-3 text-center text-text-primary text-sm">
                    {trade.leverage}x
                  </td>
                  <td
                    className={`py-3 text-right font-medium text-sm ${
                      (trade.realizedPnl || 0) >= 0
                        ? "text-success"
                        : "text-danger"
                    }`}
                  >
                    {trade.realizedPnl !== null &&
                    trade.realizedPnl !== undefined
                      ? formatCurrency(trade.realizedPnl)
                      : "-"}
                  </td>
                  <td className="py-3 text-center">
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
          {(!trades?.data || trades.data.length === 0) && (
            <p className="text-text-secondary text-center py-8">
              No trades yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
