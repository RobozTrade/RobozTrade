import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: bot } = useQuery({
    queryKey: ['bot', id],
    queryFn: () => api.getBot(id!),
    enabled: !!id,
  });

  const { data: trades } = useQuery({
    queryKey: ['bot-trades', id],
    queryFn: () => api.getBotTrades(id!),
    enabled: !!id,
  });

  if (!bot?.data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">{bot.data.name}</h1>
        <p className="text-text-secondary mt-1">{bot.data.tradingPair}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Configuration
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-text-secondary">Strategy</p>
              <p className="text-text-primary font-medium">
                {bot.data.strategyType.replace('_', ' ').toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Status</p>
              <p className="text-text-primary font-medium">{bot.data.status}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Risk Management
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-text-secondary">Max Position Size</p>
              <p className="text-text-primary font-medium">
                {bot.data.riskConfig?.maxPositionSize || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Stop Loss</p>
              <p className="text-text-primary font-medium">
                {bot.data.riskConfig?.stopLossPercentage || 'N/A'}%
              </p>
            </div>
          </div>
        </div>
      </div>

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
                  Side
                </th>
                <th className="text-right py-3 text-text-secondary font-medium">
                  Price
                </th>
                <th className="text-right py-3 text-text-secondary font-medium">
                  Quantity
                </th>
                <th className="text-right py-3 text-text-secondary font-medium">
                  P&L
                </th>
              </tr>
            </thead>
            <tbody>
              {trades?.data?.map((trade) => (
                <tr key={trade.id} className="border-b border-border">
                  <td className="py-3 text-text-primary">
                    {formatDate(trade.executedAt)}
                  </td>
                  <td className="py-3">
                    <span
                      className={`badge ${
                        trade.side === 'BUY' ? 'badge-success' : 'badge-danger'
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-3 text-right text-text-primary">
                    {formatCurrency(trade.price)}
                  </td>
                  <td className="py-3 text-right text-text-primary">
                    {trade.quantity}
                  </td>
                  <td
                    className={`py-3 text-right font-medium ${
                      (trade.pnl || 0) >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {trade.pnl ? formatCurrency(trade.pnl) : '-'}
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

