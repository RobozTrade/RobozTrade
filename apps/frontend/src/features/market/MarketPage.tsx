import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMarketStore } from "@/stores/marketStore";
import TradingChart from "@/components/charts/TradingChart";
import { formatCurrency, formatPercentage } from "@/lib/utils";

export default function MarketPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const { subscribe } = useWebSocket();
  const { tickers } = useMarketStore();

  const { data: klines } = useQuery({
    queryKey: ["klines", symbol],
    queryFn: () => api.getKlines(symbol, "1h", 100),
  });

  useEffect(() => {
    subscribe([`${symbol.toLowerCase()}@ticker`]);
  }, [symbol, subscribe]);

  const ticker = tickers[symbol];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Market</h1>
        <p className="text-text-secondary mt-1">
          Real-time market data and charts
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{symbol}</h2>
            {ticker && (
              <div className="flex items-center gap-4 mt-2">
                <span className="text-3xl font-bold text-text-primary">
                  {formatCurrency(ticker.price)}
                </span>
                <span
                  className={`text-lg font-medium ${
                    ticker.change24h >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {formatPercentage(ticker.change24h)}
                </span>
              </div>
            )}
          </div>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="input w-48"
          >
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="BNBUSDT">BNB/USDT</option>
            <option value="SOLUSDT">SOL/USDT</option>
            <option value="XRPUSDT">XRP/USDT</option>
            <option value="DOGEUSDT">DOGE/USDT</option>
            <option value="ADAUSDT">ADA/USDT</option>
            <option value="DOTUSDT">DOT/USDT</option>
            <option value="AVAXUSDT">AVAX/USDT</option>
            <option value="LINKUSDT">LINK/USDT</option>
            <option value="UNIUSDT">UNI/USDT</option>
            <option value="ATOMUSDT">ATOM/USDT</option>
            <option value="LTCUSDT">LTC/USDT</option>
            <option value="NEARUSDT">NEAR/USDT</option>
            <option value="APTUSDT">APT/USDT</option>
            <option value="ARBUSDT">ARB/USDT</option>
            <option value="OPUSDT">OP/USDT</option>
          </select>
        </div>

        {ticker && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-text-secondary">24h High</p>
              <p className="text-lg font-semibold text-text-primary">
                {formatCurrency(ticker.high24h)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">24h Low</p>
              <p className="text-lg font-semibold text-text-primary">
                {formatCurrency(ticker.low24h)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">24h Volume</p>
              <p className="text-lg font-semibold text-text-primary">
                {ticker.volume24h.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Last Update</p>
              <p className="text-lg font-semibold text-text-primary">
                {new Date(ticker.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {klines?.data && <TradingChart data={klines.data} symbol={symbol} />}
    </div>
  );
}
