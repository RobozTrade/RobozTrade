import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { AIModel } from './AIModelCard';

interface MultiModelChartProps {
  models: AIModel[];
}

type TimePeriod = '1H' | '24H' | '7D' | '30D' | 'ALL';

export function MultiModelChart({ models }: MultiModelChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24H');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#98989d',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });

    chartRef.current = chart;

    // Create a line series for each AI model
    models.forEach((model) => {
      const series = chart.addLineSeries({
        color: model.color,
        lineWidth: 2,
        title: model.name,
      });

      // Generate sample data for each model
      const data = generateSampleData(model, timePeriod);
      series.setData(data);

      seriesRefs.current.set(model.id, series);
    });

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
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
  }, [models, timePeriod]);

  const handleTimePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period);
  };

  return (
    <div className="space-y-4">
      {/* Time Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary">
          AI Models Performance
        </h2>
        <div className="flex gap-2">
          {(['1H', '24H', '7D', '30D', 'ALL'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => handleTimePeriodChange(period)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                timePeriod === period
                  ? 'bg-accent-blue text-white'
                  : 'bg-white/10 dark:bg-black/10 text-light-text-secondary dark:text-dark-text-secondary hover:bg-white/20 dark:hover:bg-black/20'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full" />

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {models.map((model) => (
          <div key={model.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: model.color }}
            />
            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {model.name}
            </span>
            <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
              ${model.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Generate sample data for chart
function generateSampleData(model: AIModel, period: TimePeriod): LineData[] {
  const now = Date.now();
  const data: LineData[] = [];
  
  let points = 100;
  let interval = 3600000; // 1 hour in ms
  
  switch (period) {
    case '1H':
      points = 60;
      interval = 60000; // 1 minute
      break;
    case '24H':
      points = 96;
      interval = 900000; // 15 minutes
      break;
    case '7D':
      points = 168;
      interval = 3600000; // 1 hour
      break;
    case '30D':
      points = 120;
      interval = 21600000; // 6 hours
      break;
    case 'ALL':
      points = 180;
      interval = 86400000; // 1 day
      break;
  }

  const baseValue = 100000;
  const volatility = 0.02;
  const trend = model.pnLPercentage / 100 / points;

  for (let i = 0; i < points; i++) {
    const time = (now - (points - i) * interval) / 1000;
    const randomWalk = (Math.random() - 0.5) * volatility;
    const value = baseValue * (1 + trend * i + randomWalk);
    
    data.push({
      time: time as Time,
      value: value,
    });
  }

  return data;
}

