import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Send,
  Terminal,
  BarChart3,
  MessageSquare,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import TradingChart from "@/components/charts/TradingChart";

type TabType = "model" | "chat" | "positions" | "readme";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("model");
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "agent"; message: string }>
  >([
    {
      role: "agent",
      message: "Hello! I'm your trading agent. How can I help you today?",
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: bots } = useQuery({
    queryKey: ["bots"],
    queryFn: () => api.getBots(),
  });

  const { data: trades } = useQuery({
    queryKey: ["trades"],
    queryFn: () => api.getTrades(),
  });

  const activeBots = bots?.data?.filter((b) => b.status === "active") || [];
  const totalTrades = trades?.data?.length || 0;
  const totalPnl = trades?.data?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0;
  const accountValue = 10000 + totalPnl; // Starting with $10,000

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;

    setChatHistory((prev) => [...prev, { role: "user", message: chatMessage }]);
    setChatMessage("");

    // Simulate agent response
    setTimeout(() => {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "agent",
          message:
            "I'm analyzing the market conditions. Based on current trends, I recommend monitoring BTC/USDT for potential entry points.",
        },
      ]);
    }, 1000);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4">
      {/* Header with Live Prices */}
      <div className="border border-green-500/30 bg-black/50 p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-500 font-bold">LIVE</span>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              BTC <span className="text-white">$95,000.00</span>
            </div>
            <div>
              ETH <span className="text-white">$3,500.00</span>
            </div>
            <div>
              SOL <span className="text-white">$180.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Chart */}
        <div className="lg:col-span-2 border border-green-500/30 bg-black/50 p-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-white">
                  $
                  {accountValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-sm ${
                    totalPnl >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {totalPnl >= 0 ? "+" : ""}
                  {formatPercentage((totalPnl / 10000) * 100)}
                </span>
              </div>
              <span className="text-xs text-green-500/70">
                TOTAL ACCOUNT VALUE
              </span>
            </div>
          </div>

          <div className="h-96 bg-black border border-green-500/20">
            <TradingChart symbol="BTCUSDT" />
          </div>

          <div className="mt-4 text-xs text-green-500/70">
            <span>ALL</span> | <span>72H</span>
          </div>
        </div>

        {/* Right Column - Tabs */}
        <div className="border border-green-500/30 bg-black/50 flex flex-col">
          {/* Tab Headers */}
          <div className="border-b border-green-500/30 flex">
            <button
              onClick={() => setActiveTab("model")}
              className={`flex-1 px-4 py-3 text-xs font-bold transition-colors ${
                activeTab === "model"
                  ? "bg-green-500/20 text-green-400 border-b-2 border-green-500"
                  : "text-green-500/50 hover:text-green-400"
              }`}
            >
              <Terminal className="w-4 h-4 inline mr-1" />
              MODEL
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 px-4 py-3 text-xs font-bold transition-colors ${
                activeTab === "chat"
                  ? "bg-green-500/20 text-green-400 border-b-2 border-green-500"
                  : "text-green-500/50 hover:text-green-400"
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-1" />
              CHAT
            </button>
          </div>

          <div className="border-b border-green-500/30 flex">
            <button
              onClick={() => setActiveTab("positions")}
              className={`flex-1 px-4 py-3 text-xs font-bold transition-colors ${
                activeTab === "positions"
                  ? "bg-green-500/20 text-green-400 border-b-2 border-green-500"
                  : "text-green-500/50 hover:text-green-400"
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1" />
              POSITIONS
            </button>
            <button
              onClick={() => setActiveTab("readme")}
              className={`flex-1 px-4 py-3 text-xs font-bold transition-colors ${
                activeTab === "readme"
                  ? "bg-green-500/20 text-green-400 border-b-2 border-green-500"
                  : "text-green-500/50 hover:text-green-400"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              README.TXT
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "model" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-green-500 font-bold mb-2 text-sm">
                    ACTIVE AGENTS
                  </h3>
                  <div className="space-y-2">
                    {activeBots.map((bot) => (
                      <div
                        key={bot.id}
                        className="border border-green-500/30 p-3 bg-black/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-bold text-sm">
                            {bot.name}
                          </span>
                          <span className="text-xs text-green-500">
                            {bot.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-green-500/70 space-y-1">
                          <div>PAIR: {bot.tradingPair}</div>
                          <div>STRATEGY: {bot.strategyType}</div>
                          <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20">
                            <div className="text-green-400">LOGIC:</div>
                            <div className="text-green-500/70 mt-1">
                              {bot.strategyType === "ma_cross" &&
                                "Moving Average Crossover - Buy when fast MA crosses above slow MA"}
                              {bot.strategyType === "rsi" &&
                                "RSI Strategy - Buy when RSI < 30, Sell when RSI > 70"}
                              {bot.strategyType === "bollinger" &&
                                "Bollinger Bands - Buy at lower band, Sell at upper band"}
                              {bot.strategyType === "custom" &&
                                "Custom Strategy - User-defined logic"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {activeBots.length === 0 && (
                      <div className="text-green-500/50 text-xs text-center py-8">
                        NO ACTIVE AGENTS
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`${
                        msg.role === "user" ? "text-right" : "text-left"
                      }`}
                    >
                      <div
                        className={`inline-block p-2 text-xs ${
                          msg.role === "user"
                            ? "bg-green-500/20 border border-green-500/30"
                            : "bg-black/50 border border-green-500/30"
                        }`}
                      >
                        <div className="text-green-500/70 mb-1">
                          {msg.role === "user" ? "YOU" : "AGENT"}
                        </div>
                        <div className="text-green-400">{msg.message}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-black border border-green-500/30 px-3 py-2 text-sm text-green-400 placeholder-green-500/30 focus:outline-none focus:border-green-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="px-4 py-2 bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                  >
                    <Send className="w-4 h-4 text-green-500" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "positions" && (
              <div className="space-y-2">
                <h3 className="text-green-500 font-bold mb-3 text-sm">
                  OPEN POSITIONS
                </h3>
                {trades?.data?.slice(0, 10).map((trade) => (
                  <div
                    key={trade.id}
                    className="border border-green-500/30 p-3 bg-black/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-bold text-sm">
                        {trade.tradingPair}
                      </span>
                      <span
                        className={`text-xs ${
                          trade.side === "BUY"
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {trade.side}
                      </span>
                    </div>
                    <div className="text-xs text-green-500/70 space-y-1">
                      <div className="flex justify-between">
                        <span>ENTRY:</span>
                        <span className="text-white">
                          ${trade.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>QUANTITY:</span>
                        <span className="text-white">{trade.quantity}</span>
                      </div>
                      {trade.pnl !== null && (
                        <div className="flex justify-between">
                          <span>P&L:</span>
                          <span
                            className={
                              trade.pnl >= 0 ? "text-green-500" : "text-red-500"
                            }
                          >
                            {trade.pnl >= 0 ? "+" : ""}
                            {formatCurrency(trade.pnl)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(!trades?.data || trades.data.length === 0) && (
                  <div className="text-green-500/50 text-xs text-center py-8">
                    NO OPEN POSITIONS
                  </div>
                )}
              </div>
            )}

            {activeTab === "readme" && (
              <div className="text-xs text-green-500/70 space-y-4">
                <div>
                  <h3 className="text-green-500 font-bold mb-2">
                    ROBOZ TRADE v1.0
                  </h3>
                  <p>AI-powered trading platform for cryptocurrency markets.</p>
                </div>
                <div>
                  <h4 className="text-green-500 font-bold mb-1">FEATURES:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Automated trading bots with multiple strategies</li>
                    <li>Real-time market data and analysis</li>
                    <li>Performance tracking and analytics</li>
                    <li>Secure API key management</li>
                    <li>Benchmark testing for strategies</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-green-500 font-bold mb-1">STRATEGIES:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>MA Cross: Moving Average Crossover</li>
                    <li>RSI: Relative Strength Index</li>
                    <li>Bollinger: Bollinger Bands</li>
                    <li>Custom: User-defined logic</li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-green-500/30">
                  <p className="text-green-500/50">
                    STATUS: CONNECTED TO SERVER
                    <br />
                    UPTIME: 99.9%
                    <br />
                    LAST UPDATE: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="border border-green-500/30 bg-black/50 p-4">
          <div className="text-xs text-green-500/70 mb-1">COMPLETED TRADES</div>
          <div className="text-2xl font-bold text-white">{totalTrades}</div>
        </div>
        <div className="border border-green-500/30 bg-black/50 p-4">
          <div className="text-xs text-green-500/70 mb-1">ACTIVE BOTS</div>
          <div className="text-2xl font-bold text-white">
            {activeBots.length}
          </div>
        </div>
        <div className="border border-green-500/30 bg-black/50 p-4">
          <div className="text-xs text-green-500/70 mb-1">TOTAL P&L</div>
          <div
            className={`text-2xl font-bold ${
              totalPnl >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {totalPnl >= 0 ? "+" : ""}
            {formatCurrency(totalPnl)}
          </div>
        </div>
      </div>
    </div>
  );
}
