import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CoinPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const MOCK_PRICES: CoinPrice[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 43250.50, change24h: 2.45 },
  { symbol: 'ETH', name: 'Ethereum', price: 2280.75, change24h: -1.23 },
  { symbol: 'SOL', name: 'Solana', price: 98.32, change24h: 5.67 },
  { symbol: 'BNB', name: 'Binance Coin', price: 312.45, change24h: 1.89 },
  { symbol: 'ADA', name: 'Cardano', price: 0.52, change24h: -0.45 },
  { symbol: 'AVAX', name: 'Avalanche', price: 36.78, change24h: 3.21 },
  { symbol: 'DOT', name: 'Polkadot', price: 7.23, change24h: -2.10 },
  { symbol: 'MATIC', name: 'Polygon', price: 0.89, change24h: 4.56 },
];

export function PriceTicker() {
  const [prices, setPrices] = useState(MOCK_PRICES);

  useEffect(() => {
    // Simulate price updates
    const interval = setInterval(() => {
      setPrices((prev) =>
        prev.map((coin) => ({
          ...coin,
          price: coin.price * (1 + (Math.random() - 0.5) * 0.002),
          change24h: coin.change24h + (Math.random() - 0.5) * 0.5,
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden backdrop-blur-xl bg-white/50 dark:bg-black/50 border-b border-light-border dark:border-dark-border">
      <div className="flex animate-marquee">
        {[...prices, ...prices].map((coin, index) => (
          <div
            key={`${coin.symbol}-${index}`}
            className="flex items-center gap-3 px-6 py-3 whitespace-nowrap"
          >
            <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {coin.symbol}
            </span>
            <span className="text-light-text-secondary dark:text-dark-text-secondary">
              ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div
              className={`flex items-center gap-1 text-sm ${
                coin.change24h >= 0 ? 'text-accent-green' : 'text-accent-red'
              }`}
            >
              {coin.change24h >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(coin.change24h).toFixed(2)}%</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

