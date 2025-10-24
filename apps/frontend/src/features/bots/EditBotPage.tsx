import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, Info } from "lucide-react";
import { api } from "@/lib/api";
import type { TradingSymbol, AIModel } from "@roboz-trade/shared-types";
import {
  SUPPORTED_TRADING_SYMBOLS,
  SUPPORTED_AI_MODELS,
  DEFAULT_PROMPT_TEMPLATE,
  PROMPT_TEMPLATE_VARIABLES,
} from "@roboz-trade/shared-types";

export default function EditBotPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Form state
  const [name, setName] = useState("");
  const [tradingSymbols, setTradingSymbols] = useState<TradingSymbol[]>([
    "BTCUSDT",
  ]);
  const [aiModel, setAiModel] = useState<AIModel>(
    "anthropic/claude-3.5-sonnet"
  );
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT_TEMPLATE);
  const [maxLeverage, setMaxLeverage] = useState(20);
  const [minNotionalPerTrade, setMinNotionalPerTrade] = useState(150);
  const [maxNotionalPerTrade, setMaxNotionalPerTrade] = useState(500);
  const [maxOpenTrades, setMaxOpenTrades] = useState(3);
  const [showPromptVariables, setShowPromptVariables] = useState(false);

  // Fetch bot data
  const { data: bot, isLoading } = useQuery({
    queryKey: ["bot", id],
    queryFn: () => api.getBot(id!),
    enabled: !!id,
  });

  // Populate form when bot data loads
  useEffect(() => {
    if (bot?.data) {
      const botData = bot.data;
      setName(botData.name);

      // Handle new AI-powered bots
      if (botData.tradingSymbols) {
        setTradingSymbols(botData.tradingSymbols);
      }
      if (botData.aiModel) {
        setAiModel(botData.aiModel);
      }
      if (botData.customPrompt) {
        setCustomPrompt(botData.customPrompt);
      }
      if (botData.maxLeverage !== undefined) {
        setMaxLeverage(botData.maxLeverage);
      }
      if (botData.minNotionalPerTrade !== undefined) {
        setMinNotionalPerTrade(botData.minNotionalPerTrade);
      }
      if (botData.maxNotionalPerTrade !== undefined) {
        setMaxNotionalPerTrade(botData.maxNotionalPerTrade);
      }
      if (botData.maxOpenTrades !== undefined) {
        setMaxOpenTrades(botData.maxOpenTrades);
      }
    }
  }, [bot]);

  const updateBotMutation = useMutation({
    mutationFn: () =>
      api.updateBot(id!, {
        name,
        tradingSymbols,
        aiModel,
        customPrompt:
          customPrompt !== DEFAULT_PROMPT_TEMPLATE ? customPrompt : undefined,
        maxLeverage,
        minNotionalPerTrade,
        maxNotionalPerTrade,
        maxOpenTrades,
      }),
    onSuccess: () => {
      navigate(`/app/bots/${id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBotMutation.mutate();
  };

  const handleSymbolToggle = (symbol: TradingSymbol) => {
    setTradingSymbols((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bot?.data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Bot Not Found</h1>
          <button
            onClick={() => navigate("/app/bots")}
            className="btn btn-primary"
          >
            Back to Bots
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(`/app/bots/${id}`)}
          className="btn btn-ghost mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Bot Details
        </button>
        <h1 className="text-3xl font-bold">Edit Bot</h1>
        <p className="text-base-content/70 mt-2">
          Update your bot configuration
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Configuration */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title mb-4">Basic Configuration</h2>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Bot Name</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input input-bordered"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">AI Model</span>
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value as AIModel)}
                className="select select-bordered"
              >
                {SUPPORTED_AI_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label} - {model.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Trading Symbols */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title mb-4">Trading Symbols</h2>
            <p className="text-sm text-base-content/70 mb-4">
              Select the trading pairs you want this bot to trade
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {SUPPORTED_TRADING_SYMBOLS.map((symbol) => (
                <label
                  key={symbol}
                  className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-base-300 hover:border-primary transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={tradingSymbols.includes(symbol)}
                    onChange={() => handleSymbolToggle(symbol)}
                    className="checkbox checkbox-primary checkbox-sm"
                  />
                  <span className="text-sm font-medium">{symbol}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Risk Management */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title mb-4">Risk Management</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Max Leverage</span>
                </label>
                <input
                  type="number"
                  value={maxLeverage}
                  onChange={(e) => setMaxLeverage(Number(e.target.value))}
                  min="1"
                  max="125"
                  className="input input-bordered"
                  required
                />
                <label className="label">
                  <span className="label-text-alt">1x - 125x</span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Max Open Trades</span>
                </label>
                <input
                  type="number"
                  value={maxOpenTrades}
                  onChange={(e) => setMaxOpenTrades(Number(e.target.value))}
                  min="1"
                  max="10"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Min Notional Per Trade (USDT)
                  </span>
                </label>
                <input
                  type="number"
                  value={minNotionalPerTrade}
                  onChange={(e) =>
                    setMinNotionalPerTrade(Number(e.target.value))
                  }
                  min="10"
                  className="input input-bordered"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">
                    Max Notional Per Trade (USDT)
                  </span>
                </label>
                <input
                  type="number"
                  value={maxNotionalPerTrade}
                  onChange={(e) =>
                    setMaxNotionalPerTrade(Number(e.target.value))
                  }
                  min="10"
                  className="input input-bordered"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Custom Prompt */}
        <div className="card bg-base-200">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Custom Prompt (Optional)</h2>
              <button
                type="button"
                onClick={() => setShowPromptVariables(!showPromptVariables)}
                className="btn btn-ghost btn-sm flex items-center gap-2"
              >
                <Info className="w-4 h-4" />
                {showPromptVariables ? "Hide" : "Show"} Variables
              </button>
            </div>

            {showPromptVariables && (
              <div className="alert alert-info mb-4">
                <div className="w-full">
                  <h3 className="font-semibold mb-2">Available Variables:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {PROMPT_TEMPLATE_VARIABLES.map((variable) => (
                      <div key={variable.name} className="flex flex-col">
                        <code className="text-xs bg-base-300 px-2 py-1 rounded">
                          {variable.name}
                        </code>
                        <span className="text-xs mt-1 opacity-70">
                          {variable.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="form-control">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="textarea textarea-bordered h-64 font-mono text-sm"
                placeholder="Enter custom prompt or leave default..."
              />
              <label className="label">
                <span className="label-text-alt">
                  Use Handlebars syntax for variables (e.g.,{" "}
                  {`{{current_price}}`})
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setCustomPrompt(DEFAULT_PROMPT_TEMPLATE)}
              className="btn btn-ghost btn-sm"
            >
              Reset to Default
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate(`/app/bots/${id}`)}
            className="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateBotMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            {updateBotMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {updateBotMutation.isError && (
          <div className="alert alert-error">
            <span>
              Failed to update bot:{" "}
              {updateBotMutation.error instanceof Error
                ? updateBotMutation.error.message
                : "Unknown error"}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
