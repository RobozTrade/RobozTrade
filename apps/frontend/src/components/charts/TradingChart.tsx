import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, Time } from "lightweight-charts";
import type { Kline } from "@roboz-trade/shared-types";

interface TradingChartProps {
  data?: Kline[];
  symbol: string;
}

export default function TradingChart({ data = [] }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#22c55e",
      },
      grid: {
        vertLines: { color: "#22c55e20" },
        horzLines: { color: "#22c55e20" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#22c55e30",
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    if (data.length > 0) {
      const formattedData = data.map((k) => ({
        time: (k.time / 1000) as Time, // Convert to seconds and cast to Time
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }));

      candlestickSeries.setData(formattedData);
    } else {
      // Generate sample data if no data provided
      const sampleData = generateSampleData();
      candlestickSeries.setData(sampleData);
    }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
}

// Generate sample candlestick data for demo
function generateSampleData() {
  const data = [];
  const basePrice = 95000;
  let currentPrice = basePrice;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 100; i >= 0; i--) {
    const time = (now - i * 3600) as Time; // Hourly candles
    const change = (Math.random() - 0.5) * 1000;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * 500;
    const low = Math.min(open, close) - Math.random() * 500;

    data.push({
      time,
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
  }

  return data;
}
