import { useEffect, useState, useRef } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useMarketStore } from "@/stores/marketStore";
import { useWebSocket } from "@/hooks/useWebSocket";

interface CoinPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  previousPrice?: number;
  flashColor?: "green" | "red" | null;
}

const INITIAL_PRICES: CoinPrice[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", price: 43250.5, change24h: 2.45 },
  { symbol: "ETHUSDT", name: "Ethereum", price: 2280.75, change24h: -1.23 },
  { symbol: "SOLUSDT", name: "Solana", price: 98.32, change24h: 5.67 },
  { symbol: "BNBUSDT", name: "Binance Coin", price: 312.45, change24h: 1.89 },
  { symbol: "ADAUSDT", name: "Cardano", price: 0.52, change24h: -0.45 },
  { symbol: "AVAXUSDT", name: "Avalanche", price: 36.78, change24h: 3.21 },
  { symbol: "DOTUSDT", name: "Polkadot", price: 7.23, change24h: -2.1 },
  { symbol: "MATICUSDT", name: "Polygon", price: 0.89, change24h: 4.56 },
];

export function PriceTicker() {
  const [prices, setPrices] = useState<CoinPrice[]>(INITIAL_PRICES);
  const { subscribe } = useWebSocket();
  const tickers = useMarketStore((state) => state.tickers);
  const wsSubscribed = useRef(false);

  // Subscribe to WebSocket price feeds
  useEffect(() => {
    if (!wsSubscribed.current) {
      const channels = INITIAL_PRICES.map(
        (coin) => `${coin.symbol.toLowerCase()}@ticker`
      );
      subscribe(channels);
      wsSubscribed.current = true;
    }
  }, [subscribe]);

  // Update prices from market store and add flash effect
  useEffect(() => {
    setPrices((prev) =>
      prev.map((coin) => {
        const ticker = tickers[coin.symbol];
        if (ticker) {
          const newPrice = ticker.price;
          const oldPrice = coin.price;
          const flashColor =
            newPrice > oldPrice ? "green" : newPrice < oldPrice ? "red" : null;

          return {
            ...coin,
            price: newPrice,
            change24h: ticker.change24h,
            previousPrice: oldPrice,
            flashColor,
          };
        }
        return coin;
      })
    );

    // Clear flash effect after animation
    const timeout = setTimeout(() => {
      setPrices((prev) => prev.map((coin) => ({ ...coin, flashColor: null })));
    }, 600);

    return () => clearTimeout(timeout);
  }, [tickers]);

  return (
    <div className="relative overflow-hidden backdrop-blur-xl bg-white/50 dark:bg-black/50 border-b border-light-border dark:border-dark-border">
      <div className="flex animate-marquee">
        {[...prices, ...prices].map((coin, index) => (
          <div
            key={`${coin.symbol}-${index}`}
            className="flex items-center gap-3 px-6 py-3 whitespace-nowrap"
          >
            <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {coin.symbol.replace("USDT", "")}
            </span>
            <AnimatedPrice
              price={coin.price}
              previousPrice={coin.previousPrice}
              flashColor={coin.flashColor}
            />
            <div
              className={`flex items-center gap-1 text-sm ${
                coin.change24h >= 0 ? "text-accent-green" : "text-accent-red"
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

// Animated Price Component with count-up effect and flash
interface AnimatedPriceProps {
  price: number;
  previousPrice?: number;
  flashColor?: "green" | "red" | null;
}

function AnimatedPrice({
  price,
  previousPrice,
  flashColor,
}: AnimatedPriceProps) {
  const [displayPrice, setDisplayPrice] = useState(price);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (previousPrice !== undefined && previousPrice !== price) {
      // Animate from previous to current price
      const startPrice = previousPrice;
      const endPrice = price;
      const duration = 400; // ms
      const startTime = Date.now();

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentPrice =
          startPrice + (endPrice - startPrice) * easeProgress;

        setDisplayPrice(currentPrice);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setDisplayPrice(price);
    }
  }, [price, previousPrice]);

  const getDecimalPlaces = (value: number) => {
    if (value < 1) return 4;
    if (value < 10) return 3;
    return 2;
  };

  return (
    <span
      className={`text-light-text-secondary dark:text-dark-text-secondary transition-all duration-300 ${
        flashColor === "green"
          ? "animate-flash-green"
          : flashColor === "red"
          ? "animate-flash-red"
          : ""
      }`}
    >
      $
      {displayPrice.toLocaleString(undefined, {
        minimumFractionDigits: getDecimalPlaces(displayPrice),
        maximumFractionDigits: getDecimalPlaces(displayPrice),
      })}
      <style>{`
        @keyframes flash-green {
          0%, 100% { 
            color: inherit;
            transform: scale(1);
          }
          50% { 
            color: #34c759;
            transform: scale(1.05);
          }
        }
        @keyframes flash-red {
          0%, 100% { 
            color: inherit;
            transform: scale(1);
          }
          50% { 
            color: #ff3b30;
            transform: scale(1.05);
          }
        }
        .animate-flash-green {
          animation: flash-green 600ms ease-in-out;
        }
        .animate-flash-red {
          animation: flash-red 600ms ease-in-out;
        }
      `}</style>
    </span>
  );
}
