import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data: trades } = useQuery({
    queryKey: ['trades'],
    queryFn: () => api.getTrades(),
  });

  const totalTrades = trades?.data?.length || 0;
  const winningTrades = trades?.data?.filter((t) => (t.pnl || 0) > 0).length || 0;
  const losingTrades = trades?.data?.filter((t) => (t.pnl || 0) < 0).length || 0;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnl = trades?.data?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Analytics</h1>
        <p className="text-text-secondary mt-1">
          Performance metrics and insights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-text-secondary">Total Trades</p>
          <p className="text-3xl font-bold text-text-primary mt-2">
            {totalTrades}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Win Rate</p>
          <p className="text-3xl font-bold text-success mt-2">
            {winRate.toFixed(1)}%
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Total P&L</p>
          <p
            className={`text-3xl font-bold mt-2 ${
              totalPnl >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {formatCurrency(totalPnl)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Avg Trade</p>
          <p className="text-3xl font-bold text-text-primary mt-2">
            {totalTrades > 0 ? formatCurrency(totalPnl / totalTrades) : '$0.00'}
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Trade Distribution
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-text-secondary mb-2">Winning Trades</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-background-tertiary rounded-full h-4">
                <div
                  className="bg-success h-4 rounded-full"
                  style={{ width: `${winRate}%` }}
                />
              </div>
              <span className="text-text-primary font-medium">
                {winningTrades}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-2">Losing Trades</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-background-tertiary rounded-full h-4">
                <div
                  className="bg-danger h-4 rounded-full"
                  style={{ width: `${100 - winRate}%` }}
                />
              </div>
              <span className="text-text-primary font-medium">
                {losingTrades}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

