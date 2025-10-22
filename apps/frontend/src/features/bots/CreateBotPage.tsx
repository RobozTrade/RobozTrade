import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  StrategyType,
  CreateBotInputLegacy,
} from "@roboz-trade/shared-types";

export default function CreateBotPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [apiKeyId, setApiKeyId] = useState("");
  const [strategyType, setStrategyType] = useState<StrategyType>("ma_cross");
  const [tradingPair, setTradingPair] = useState("BTCUSDT");

  const { data: apiKeys } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: () => api.getApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateBotInputLegacy) => api.createBot(input),
    onSuccess: () => {
      navigate("/bots");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const input: CreateBotInputLegacy = {
      name,
      apiKeyId,
      strategyType,
      tradingPair,
      config: {
        shortPeriod: 10,
        longPeriod: 20,
      },
      riskConfig: {
        maxPositionSize: 1000,
        stopLossPercentage: 2,
        takeProfitPercentage: 5,
        maxDailyLoss: 500,
        maxOpenTrades: 3,
      },
    };

    createMutation.mutate(input);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">
          Create Trading Bot
        </h1>
        <p className="text-text-secondary mt-1">
          Set up a new automated trading strategy
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label">Bot Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="My Trading Bot"
            required
          />
        </div>

        <div>
          <label className="label">API Key</label>
          <select
            value={apiKeyId}
            onChange={(e) => setApiKeyId(e.target.value)}
            className="input"
            required
          >
            <option value="">Select API Key</option>
            {apiKeys?.data?.map((key) => (
              <option key={key.id} value={key.id}>
                {key.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Strategy Type</label>
          <select
            value={strategyType}
            onChange={(e) => setStrategyType(e.target.value as StrategyType)}
            className="input"
            required
          >
            <option value="ma_cross">Moving Average Cross</option>
            <option value="rsi">RSI</option>
            <option value="bollinger">Bollinger Bands</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="label">Trading Pair</label>
          <input
            type="text"
            value={tradingPair}
            onChange={(e) => setTradingPair(e.target.value)}
            className="input"
            placeholder="BTCUSDT"
            required
          />
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate("/bots")}
            className="btn btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn btn-primary flex-1"
          >
            {createMutation.isPending ? "Creating..." : "Create Bot"}
          </button>
        </div>
      </form>
    </div>
  );
}
