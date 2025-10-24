import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { getStatusColor } from "@/lib/utils";
import { SUPPORTED_AI_MODELS } from "@roboz-trade/shared-types";

export default function BotsPage() {
  const { data: bots } = useQuery({
    queryKey: ["bots"],
    queryFn: () => api.getBots(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Trading Bots</h1>
          <p className="text-text-secondary mt-1">
            Manage your automated trading strategies
          </p>
        </div>
        <Link
          to="/app/bots/new"
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Bot
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots?.data?.map((bot) => {
          const isNewBot = !!bot.tradingSymbols;
          const aiModelInfo = isNewBot
            ? SUPPORTED_AI_MODELS.find((m) => m.value === bot.aiModel)
            : null;

          return (
            <Link
              key={bot.id}
              to={`/app/bots/${bot.id}`}
              className="card hover:shadow-glow transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {bot.name}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {isNewBot
                      ? `${
                          (bot.tradingSymbols as string[])?.length || 0
                        } Symbols`
                      : bot.tradingPair}
                  </p>
                </div>
                <span className={`badge badge-${getStatusColor(bot.status)}`}>
                  {bot.status}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">
                    {isNewBot ? "AI Model:" : "Strategy:"}
                  </span>
                  {isNewBot && aiModelInfo ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={aiModelInfo.logo}
                        alt={aiModelInfo.provider}
                        className="w-5 h-5 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                      />
                      <span className="text-text-primary font-medium">
                        {aiModelInfo.label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-text-primary font-medium">
                      {bot.strategyType?.replace("_", " ").toUpperCase() ||
                        "N/A"}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {(!bots?.data || bots.data.length === 0) && (
        <div className="card text-center py-12">
          <p className="text-text-secondary mb-4">
            No trading bots yet. Create your first bot to get started!
          </p>
          <Link
            to="/app/bots/new"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Your First Bot
          </Link>
        </div>
      )}
    </div>
  );
}
