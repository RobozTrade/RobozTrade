import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface BotPerformanceData {
  botId: string;
  botName: string;
  totalBalance: number | null;
  unrealizedPnl: number | null;
  accountBalance: number | null;
  executionTime: string | null;
  status: string;
}

interface BotPerformanceHistory {
  id: string;
  executionTime: string;
  totalBalance: number | null;
  unrealizedPnl: number | null;
  accountBalance: number | null;
  accountExposure: number | null;
  tradesExecuted: number;
  status: string;
}

type ChartMode = 'unrealized_pnl' | 'account_balance';

const BOT_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
];

export function BotPerformanceChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const [chartMode, setChartMode] = useState<ChartMode>('unrealized_pnl');
  const [legendScrollPosition, setLegendScrollPosition] = useState(0);
  const legendContainerRef = useRef<HTMLDivElement>(null);

  // Fetch latest bot performance data
  const { data: latestData, refetch } = useQuery({
    queryKey: ['bot-performance-latest'],
    queryFn: async () => {
      const response = await api.getBotPerformanceLatest();
      return response.data as BotPerformanceData[];
    },
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  // Fetch performance history for all bots
  const { data: historyData } = useQuery({
    queryKey: ['bot-performance-history', latestData],
    queryFn: async () => {
      if (!latestData || latestData.length === 0) return {};
      
      const historyPromises = latestData.map(async (bot) => {
        const response = await api.getBotPerformanceHistory(bot.botId, 100);
        return { botId: bot.botId, history: response.data as BotPerformanceHistory[] };
      });

      const results = await Promise.all(historyPromises);
      const historyMap: Record<string, BotPerformanceHistory[]> = {};
      results.forEach(({ botId, history }) => {
        historyMap[botId] = history;
      });
      return historyMap;
    },
    enabled: !!latestData && latestData.length > 0,
  });

  // Fetch initial balances for all bots
  const { data: initialBalances } = useQuery({
    queryKey: ['bot-initial-balances', latestData],
    queryFn: async () => {
      if (!latestData || latestData.length === 0) return {};
      
      const balancePromises = latestData.map(async (bot) => {
        const response = await api.getBotInitialBalance(bot.botId);
        return { botId: bot.botId, initialBalance: response.data.initialBalance };
      });

      const results = await Promise.all(balancePromises);
      const balanceMap: Record<string, number> = {};
      results.forEach(({ botId, initialBalance }) => {
        balanceMap[botId] = initialBalance;
      });
      return balanceMap;
    },
    enabled: !!latestData && latestData.length > 0,
  });

  // Calculate minimum initial balance for normalization
  const minInitialBalance = initialBalances 
    ? Math.min(...Object.values(initialBalances).filter(b => b !== null && b > 0))
    : null;

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data when mode, history, or initial balances change
  useEffect(() => {
    if (!chartRef.current || !historyData || !initialBalances || !latestData) return;

    // Clear existing series
    seriesRefs.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    seriesRefs.current.clear();

    // Create a line series for each bot
    latestData.forEach((bot, index) => {
      const history = historyData[bot.botId];
      if (!history || history.length === 0) return;

      const initialBalance = initialBalances[bot.botId];
      if (!initialBalance) return;

      const color = BOT_COLORS[index % BOT_COLORS.length];
      const series = chartRef.current!.addLineSeries({
        color,
        lineWidth: 2,
        title: bot.botName,
      });

      // Transform history data based on chart mode
      const data: LineData[] = history
        .map((entry) => {
          const timestamp = new Date(entry.executionTime).getTime() / 1000;
          let value: number;

          if (chartMode === 'unrealized_pnl') {
            // Show unrealized P&L as percentage
            value = entry.unrealizedPnl !== null && initialBalance > 0
              ? (entry.unrealizedPnl / initialBalance) * 100
              : 0;
          } else {
            // Show account balance as percentage change from initial
            const balance = entry.totalBalance ?? entry.accountBalance ?? 0;
            value = initialBalance > 0
              ? ((balance - initialBalance) / initialBalance) * 100
              : 0;
          }

          return {
            time: timestamp as Time,
            value,
          };
        })
        .filter((d) => !isNaN(d.value))
        .sort((a, b) => (a.time as number) - (b.time as number));

      if (data.length > 0) {
        series.setData(data);
        seriesRefs.current.set(bot.botId, series);
      }
    });

    // Fit content
    chartRef.current.timeScale().fitContent();
  }, [chartMode, historyData, initialBalances, latestData]);

  // Legend scroll handlers
  const scrollLegend = (direction: 'left' | 'right') => {
    if (!legendContainerRef.current) return;
    const scrollAmount = 300;
    const newPosition = direction === 'left' 
      ? Math.max(0, legendScrollPosition - scrollAmount)
      : legendScrollPosition + scrollAmount;
    
    legendContainerRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
    setLegendScrollPosition(newPosition);
  };

  const showNormalizationMessage = chartMode === 'account_balance' && 
    minInitialBalance !== null && 
    initialBalances &&
    Object.values(initialBalances).some(b => b !== minInitialBalance);

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
          Bot Performance
        </h3>
        
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 bg-white/5 dark:bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setChartMode('unrealized_pnl')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartMode === 'unrealized_pnl'
                ? 'bg-accent-green text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
            }`}
          >
            Unrealized P&L
          </button>
          <button
            onClick={() => setChartMode('account_balance')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              chartMode === 'account_balance'
                ? 'bg-accent-green text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
            }`}
          >
            Account Balance
          </button>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full" />

      {/* Normalization Message */}
      {showNormalizationMessage && (
        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary text-center">
          Values adjusted to minimum initial balance: ${minInitialBalance?.toFixed(2)}
        </p>
      )}

      {/* Legend */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollLegend('left')}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div 
            ref={legendContainerRef}
            className="flex-1 overflow-x-auto scrollbar-hide"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div className="flex gap-4 min-w-max">
              {latestData?.map((bot, index) => (
                <div
                  key={bot.botId}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: BOT_COLORS[index % BOT_COLORS.length] }}
                  />
                  <img
                    src="/ai-icon.svg"
                    alt="AI"
                    className="w-4 h-4"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                    {bot.botName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => scrollLegend('right')}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

