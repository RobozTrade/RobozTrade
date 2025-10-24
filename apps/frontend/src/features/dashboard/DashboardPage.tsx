import { useState } from "react";
import { PriceTicker } from "@/components/dashboard/PriceTicker";
import { AIModelCard, AIModel } from "@/components/dashboard/AIModelCard";
import { MultiModelChart } from "@/components/dashboard/MultiModelChart";
import { GlassCard } from "@/components/ui/GlassCard";
import { Send } from "lucide-react";

// Mock data for 5 AI models
const AI_MODELS: AIModel[] = [
  {
    id: "1",
    name: "Momentum Master",
    portfolioValue: 125430.5,
    totalPnL: 25430.5,
    pnLPercentage: 25.43,
    winRate: 68.5,
    activePositions: 5,
    status: "active",
    color: "#007aff",
    logo: "/logos/openai.svg",
  },
  {
    id: "2",
    name: "Mean Reversion Pro",
    portfolioValue: 98750.25,
    totalPnL: -1249.75,
    pnLPercentage: -1.25,
    winRate: 62.3,
    activePositions: 3,
    status: "active",
    color: "#af52de",
    logo: "/logos/claude.svg",
  },
  {
    id: "3",
    name: "Trend Follower",
    portfolioValue: 156890.0,
    totalPnL: 56890.0,
    pnLPercentage: 56.89,
    winRate: 72.1,
    activePositions: 7,
    status: "active",
    color: "#34c759",
    logo: "/logos/gemini.svg",
  },
  {
    id: "4",
    name: "Volatility Hunter",
    portfolioValue: 87320.75,
    totalPnL: -12679.25,
    pnLPercentage: -12.68,
    winRate: 55.8,
    activePositions: 2,
    status: "paused",
    color: "#ff9500",
    logo: "/logos/deepseek.svg",
  },
  {
    id: "5",
    name: "Arbitrage Bot",
    portfolioValue: 112560.0,
    totalPnL: 12560.0,
    pnLPercentage: 12.56,
    winRate: 78.9,
    activePositions: 4,
    status: "active",
    color: "#ff2d55",
    logo: "/logos/xai.svg",
  },
];

// Mock completed trades
const COMPLETED_TRADES = [
  {
    id: "1",
    aiModel: "Momentum Master",
    modelColor: "#007aff",
    pair: "BTC/USDT",
    side: "LONG",
    leverage: "10x",
    margin: 1000,
    entryPrice: 42500,
    exitPrice: 43250,
    holdingTime: "2h 34m",
    pnl: 750,
    pnlPercent: 7.5,
  },
  {
    id: "2",
    aiModel: "Trend Follower",
    modelColor: "#34c759",
    pair: "ETH/USDT",
    side: "LONG",
    leverage: "5x",
    margin: 2000,
    entryPrice: 2250,
    exitPrice: 2310,
    holdingTime: "4h 12m",
    pnl: 600,
    pnlPercent: 3.0,
  },
  // Add more trades...
];

// Mock current positions
const CURRENT_POSITIONS = [
  {
    id: "1",
    aiModel: "Momentum Master",
    modelColor: "#007aff",
    side: "LONG",
    pair: "BTC/USDT",
    leverage: "10x",
    margin: 1500,
    entryPrice: 43100,
    currentPrice: 43250,
    takeProfit: 44000,
    stopLoss: 42500,
    condition: "RSI > 70",
    unrealizedPnL: 150,
    unrealizedPnLPercent: 1.0,
  },
  // Add more positions...
];

export default function DashboardPageNew() {
  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "ai"; message: string }>
  >([
    {
      role: "ai",
      message: "Hello! I'm Momentum Master. How can I help you today?",
    },
  ]);

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;

    setChatHistory((prev) => [
      ...prev,
      { role: "user", message: chatMessage },
      {
        role: "ai",
        message: `I received your message: "${chatMessage}". I'm analyzing the market conditions and will update you shortly.`,
      },
    ]);
    setChatMessage("");
  };

  return (
    <div className="min-h-screen">
      {/* Price Ticker */}
      <PriceTicker />

      <div className="max-w-[1920px] mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Multi-line Chart Section */}
        <GlassCard className="p-4 sm:p-6">
          <MultiModelChart models={AI_MODELS} />
        </GlassCard>

        {/* AI Model Summary Cards */}
        <div className="overflow-x-auto pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-3 sm:gap-4 min-w-max sm:min-w-0">
            {AI_MODELS.map((model) => (
              <AIModelCard
                key={model.id}
                model={model}
                onClick={() => setSelectedModel(model)}
              />
            ))}
          </div>
        </div>

        {/* Two-Column Layout: Tables + Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column: Trading Tables (70%) */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Completed Trades Table */}
            <GlassCard className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 sm:mb-4">
                Completed Trades
              </h3>
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
                      {COMPLETED_TRADES.map((trade) => (
                        <tr
                          key={trade.id}
                          className="border-b border-white/5 hover:bg-white/5 dark:hover:bg-black/5 transition-colors"
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: trade.modelColor }}
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
                            ${trade.entryPrice.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right text-light-text-primary dark:text-dark-text-primary">
                            ${trade.exitPrice.toLocaleString()}
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
                                {trade.pnl >= 0 ? "+" : ""}$
                                {trade.pnl.toLocaleString()}
                              </span>
                              <span
                                className={`text-xs ${
                                  trade.pnl >= 0
                                    ? "text-accent-green"
                                    : "text-accent-red"
                                }`}
                              >
                                ({trade.pnl >= 0 ? "+" : ""}
                                {trade.pnlPercent}%)
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>

            {/* Current Positions Table - Grouped by AI Model */}
            <GlassCard className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 sm:mb-4">
                Current Positions
              </h3>
              <div className="space-y-3 sm:space-y-4">
                {AI_MODELS.filter((m) => m.activePositions > 0).map((model) => (
                  <details key={model.id} className="group" open>
                    <summary className="cursor-pointer list-none flex items-center justify-between p-2 sm:p-3 rounded-xl hover:bg-white/5 dark:hover:bg-black/5 transition-colors">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full"
                          style={{ backgroundColor: model.color }}
                        />
                        <span className="text-sm sm:text-base font-medium text-light-text-primary dark:text-dark-text-primary">
                          {model.name}
                        </span>
                        <span className="text-xs sm:text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                          ({model.activePositions})
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
                            {CURRENT_POSITIONS.filter(
                              (p) => p.aiModel === model.name
                            ).map((position) => (
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
                                  ${position.entryPrice.toLocaleString()}
                                </td>
                                <td className="py-2 px-2 text-right text-light-text-primary dark:text-dark-text-primary">
                                  ${position.currentPrice.toLocaleString()}
                                </td>
                                <td className="py-2 px-2 text-right text-accent-green">
                                  ${position.takeProfit.toLocaleString()}
                                </td>
                                <td className="py-2 px-2 text-right text-accent-red">
                                  ${position.stopLoss.toLocaleString()}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  <div className="flex flex-col items-end">
                                    <span
                                      className={`font-semibold ${
                                        position.unrealizedPnL >= 0
                                          ? "text-accent-green"
                                          : "text-accent-red"
                                      }`}
                                    >
                                      {position.unrealizedPnL >= 0 ? "+" : ""}$
                                      {position.unrealizedPnL.toLocaleString()}
                                    </span>
                                    <span
                                      className={`text-xs ${
                                        position.unrealizedPnL >= 0
                                          ? "text-accent-green"
                                          : "text-accent-red"
                                      }`}
                                    >
                                      ({position.unrealizedPnL >= 0 ? "+" : ""}
                                      {position.unrealizedPnLPercent}%)
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
            </GlassCard>
          </div>

          {/* Right Column: Chat Interface (30%) */}
          <div className="lg:col-span-1">
            <GlassCard className="p-0 h-[600px] sm:h-[700px] lg:h-[800px] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 dark:border-white/5">
                <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                  AI Model Chat
                </h3>
              </div>

              {/* Model List Sidebar */}
              <div className="flex-1 flex overflow-hidden">
                <div className="w-24 border-r border-white/10 dark:border-white/5 p-2 space-y-2 overflow-y-auto">
                  {AI_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model)}
                      className={`w-full p-2 rounded-xl transition-all ${
                        selectedModel.id === model.id
                          ? "bg-white/20 dark:bg-black/20"
                          : "hover:bg-white/10 dark:hover:bg-black/10"
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: model.color }}
                      >
                        {model.name.substring(0, 2)}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Chat Messages */}
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-2xl ${
                            msg.role === "user"
                              ? "bg-accent-blue text-white"
                              : "bg-white/10 dark:bg-black/10 text-light-text-primary dark:text-dark-text-primary"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="p-4 border-t border-white/10 dark:border-white/5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleSendMessage()
                        }
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 rounded-xl backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="p-2 rounded-xl bg-accent-blue text-white hover:bg-accent-blue/80 transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
