import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { WalletConnect } from "@/components/web3/WalletConnect";
import { PaymentFlow } from "@/components/web3/PaymentFlow";
import type {
  CreateBotInput,
  TradingSymbol,
  AIModel,
} from "@roboz-trade/shared-types";
import {
  SUPPORTED_TRADING_SYMBOLS,
  SUPPORTED_AI_MODELS,
  DEFAULT_PROMPT_TEMPLATE,
  PROMPT_TEMPLATE_VARIABLES,
} from "@roboz-trade/shared-types";

type Step = "wallet" | "payment" | "config" | "review";

export default function CreateBotPageNew() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const [currentStep, setCurrentStep] = useState<Step>("wallet");
  const [paymentTxHash, setPaymentTxHash] = useState("");
  const [paymentValidated, setPaymentValidated] = useState(false);

  // Form state
  const [asterApiKey, setAsterApiKey] = useState("");
  const [asterApiSecret, setAsterApiSecret] = useState("");
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
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

  const validatePaymentMutation = useMutation({
    mutationFn: async (txHash: string) => {
      // Add a delay to allow transaction to propagate to RPC nodes
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return api.validatePayment(txHash);
    },
    onSuccess: (response) => {
      if (response.success && response.data?.valid) {
        setPaymentValidated(true);
        setCurrentStep("config");
      }
    },
    retry: 3,
    retryDelay: 5000, // Wait 5 seconds between retries
  });

  const createBotMutation = useMutation({
    mutationFn: (input: CreateBotInput) => api.createBot(input),
    onSuccess: () => {
      navigate("/app/bots");
    },
  });

  const handlePaymentComplete = useCallback((txHash: string) => {
    setPaymentTxHash(txHash);
    // Validate payment with backend - mutation is stable, safe to use here
    validatePaymentMutation.mutate(txHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const input: CreateBotInput = {
      paymentTxHash,
      asterApiKey,
      asterApiSecret,
      openRouterApiKey,
      name,
      tradingSymbols,
      aiModel,
      customPrompt:
        customPrompt !== DEFAULT_PROMPT_TEMPLATE ? customPrompt : undefined,
      maxLeverage,
      minNotionalPerTrade,
      maxNotionalPerTrade,
      maxOpenTrades,
    };

    createBotMutation.mutate(input);
  };

  const canProceedToReview =
    name &&
    asterApiKey &&
    asterApiSecret &&
    openRouterApiKey &&
    tradingSymbols.length > 0 &&
    tradingSymbols.length <= 5 &&
    aiModel &&
    maxLeverage >= 1 &&
    maxLeverage <= 20 &&
    minNotionalPerTrade >= 150 &&
    maxNotionalPerTrade >= minNotionalPerTrade &&
    maxOpenTrades >= 1 &&
    maxOpenTrades <= 5;

  const steps = [
    { id: "wallet", label: "Connect Wallet", completed: isConnected },
    { id: "payment", label: "Payment", completed: paymentValidated },
    { id: "config", label: "Configuration", completed: canProceedToReview },
    { id: "review", label: "Review & Create", completed: false },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => navigate("/app/bots")}
          className="btn btn-secondary p-2 sm:px-4"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary">
            Create Trading Bot
          </h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Set up your AI-powered trading bot
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="card">
        <div className="flex items-center justify-between overflow-x-auto pb-2 sm:pb-0">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 px-1">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 ${
                    step.completed
                      ? "bg-success border-success text-white"
                      : currentStep === step.id
                      ? "bg-primary border-primary text-white"
                      : "bg-surface border-border text-text-secondary"
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <span className="text-xs sm:text-base">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs sm:text-sm mt-1 sm:mt-2 text-center ${
                    currentStep === step.id
                      ? "text-text-primary font-medium"
                      : "text-text-secondary"
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.label.split(" ")[0]}</span>
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 sm:mx-2 ${
                    step.completed ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === "wallet" && (
        <div className="space-y-6">
          <WalletConnect />
          {isConnected && (
            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep("payment")}
                className="btn btn-primary flex items-center gap-2"
              >
                Continue to Payment
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === "payment" && (
        <div className="space-y-6">
          <PaymentFlow onPaymentComplete={handlePaymentComplete} />

          {validatePaymentMutation.isPending && (
            <div className="card flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-text-primary font-medium">
                  Validating payment...
                </p>
                <p className="text-text-secondary text-sm mt-1">
                  This may take a few moments as we verify your transaction on
                  the BSC network
                </p>
              </div>
            </div>
          )}

          {validatePaymentMutation.isError && (
            <div className="card bg-error/10 border-error space-y-4">
              <div>
                <p className="text-error font-semibold mb-2">
                  Payment Validation Failed
                </p>
                <p className="text-text-secondary text-sm">
                  {validatePaymentMutation.error instanceof Error
                    ? validatePaymentMutation.error.message
                    : "Unable to validate your payment. This can happen if the transaction hasn't fully propagated to all BSC nodes yet."}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => validatePaymentMutation.mutate(paymentTxHash)}
                  className="btn btn-primary text-sm"
                  disabled={validatePaymentMutation.isPending}
                >
                  {validatePaymentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    "Retry Validation"
                  )}
                </button>
                <a
                  href={`https://bscscan.com/tx/${paymentTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-sm"
                >
                  View on BscScan
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === "config" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCurrentStep("review");
          }}
          className="space-y-6"
        >
          <div className="card space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-text-primary">
                Bot Configuration
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Set up your AI-powered trading bot with secure payment
              </p>
            </div>

            <div>
              <label className="label">Bot Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="My Trading Bot"
                required
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Aster DEX API Key *</label>
                <input
                  type="password"
                  value={asterApiKey}
                  onChange={(e) => setAsterApiKey(e.target.value)}
                  className="input"
                  placeholder="Enter your Aster API key"
                  required
                />
              </div>

              <div>
                <label className="label">Aster DEX API Secret *</label>
                <input
                  type="password"
                  value={asterApiSecret}
                  onChange={(e) => setAsterApiSecret(e.target.value)}
                  className="input"
                  placeholder="Enter your Aster API secret"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">OpenRouter API Key *</label>
              <input
                type="password"
                value={openRouterApiKey}
                onChange={(e) => setOpenRouterApiKey(e.target.value)}
                className="input"
                placeholder="Enter your OpenRouter API key"
                required
              />
              <p className="text-xs text-text-secondary mt-1">
                Get your API key from{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai
                </a>
              </p>
            </div>

            <div>
              <label className="label">Trading Symbols * (Margin: USDT)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                {SUPPORTED_TRADING_SYMBOLS.map((symbol) => {
                  const isSelected = tradingSymbols.includes(symbol);
                  const isDisabled = !isSelected && tradingSymbols.length >= 5;

                  return (
                    <label
                      key={symbol}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 cursor-pointer"
                          : isDisabled
                          ? "border-border bg-surface-light cursor-not-allowed opacity-50"
                          : "border-border hover:border-primary/50 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (tradingSymbols.length < 5) {
                              setTradingSymbols([...tradingSymbols, symbol]);
                            }
                          } else {
                            setTradingSymbols(
                              tradingSymbols.filter((s) => s !== symbol)
                            );
                          }
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm font-medium">
                        {symbol.replace("USDT", "")}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Select up to 5 trading symbols ({tradingSymbols.length}/5
                selected). All trades use USDT as margin.
              </p>
            </div>

            <div>
              <label className="label">AI Model *</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {SUPPORTED_AI_MODELS.map((model) => (
                  <button
                    key={model.value}
                    type="button"
                    onClick={() => setAiModel(model.value)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      aiModel === model.value
                        ? "border-accent-blue bg-accent-blue/10"
                        : "border-light-border dark:border-dark-border hover:border-accent-blue/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={model.logo}
                        alt={model.provider}
                        className="w-10 h-10 rounded-lg object-contain bg-white dark:bg-gray-800 p-1.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-light-text-primary dark:text-dark-text-primary">
                          {model.label}
                        </div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                          {model.provider}
                        </div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 line-clamp-2">
                          {model.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Choose the AI model to power your trading decisions
              </p>
            </div>
          </div>

          <div className="card space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-text-primary">
                Risk Management
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Configure trading limits and risk parameters
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Max Leverage *</label>
                <input
                  type="number"
                  value={maxLeverage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= 20) {
                      setMaxLeverage(val);
                    }
                  }}
                  className="input"
                  min="1"
                  max="20"
                  required
                />
                <p className="text-xs text-text-secondary mt-1">
                  1x - 20x leverage
                </p>
              </div>

              <div>
                <label className="label">Min Notional Per Trade (USDT) *</label>
                <input
                  type="number"
                  value={minNotionalPerTrade}
                  onChange={(e) =>
                    setMinNotionalPerTrade(Number(e.target.value))
                  }
                  className="input"
                  min="150"
                  max="100000"
                  step="1"
                  required
                />
                <p className="text-xs text-text-secondary mt-1">
                  Minimum 150 USDT per trade
                </p>
              </div>

              <div>
                <label className="label">Max Notional Per Trade (USDT) *</label>
                <input
                  type="number"
                  value={maxNotionalPerTrade}
                  onChange={(e) =>
                    setMaxNotionalPerTrade(Number(e.target.value))
                  }
                  className="input"
                  min={minNotionalPerTrade}
                  max="100000"
                  step="1"
                  required
                />
                <p className="text-xs text-text-secondary mt-1">
                  Must be greater than or equal to minimum notional
                </p>
              </div>

              <div>
                <label className="label">Max Open Trades *</label>
                <input
                  type="number"
                  value={maxOpenTrades}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= 5) {
                      setMaxOpenTrades(val);
                    }
                  }}
                  className="input"
                  min="1"
                  max="5"
                  required
                />
                <p className="text-xs text-text-secondary mt-1">
                  Maximum 5 concurrent positions
                </p>
              </div>
            </div>
          </div>

          <div className="card space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-text-primary">
                  AI Prompt Template
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Customize the AI trading instructions (optional)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPromptVariables(!showPromptVariables)}
                className="btn btn-secondary text-sm flex items-center gap-2"
              >
                <Info className="w-4 h-4" />
                {showPromptVariables ? "Hide" : "Show"} Variables
              </button>
            </div>

            {showPromptVariables && (
              <div className="bg-surface-light rounded-lg p-4 border border-border">
                <h4 className="text-sm font-semibold text-text-primary mb-3">
                  Available Template Variables
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {PROMPT_TEMPLATE_VARIABLES.map((variable) => (
                    <div key={variable.name} className="flex gap-2">
                      <code className="text-primary font-mono bg-surface px-2 py-1 rounded">
                        {variable.name}
                      </code>
                      <span className="text-text-secondary">
                        {variable.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="input font-mono text-sm"
                rows={12}
                placeholder="Enter custom prompt template..."
                maxLength={10000}
              />
              <p className="text-xs text-text-secondary mt-1">
                Use variables like {"{"}
                {"{"} current_price {"}"}
                {"}"} to insert dynamic data. Leave default for standard trading
                logic.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep("payment")}
              className="btn btn-secondary flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              type="submit"
              disabled={!canProceedToReview}
              className="btn btn-primary flex-1"
            >
              Continue to Review
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </form>
      )}

      {currentStep === "review" && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <h3 className="text-xl font-semibold text-text-primary">
              Review Your Bot Configuration
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Bot Name:</span>
                <span className="text-text-primary font-medium">{name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Trading Symbols:</span>
                <span className="text-text-primary font-medium">
                  {tradingSymbols.map((s) => s.replace("USDT", "")).join(", ")}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Margin Asset:</span>
                <span className="text-text-primary font-medium">USDT</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-text-secondary">AI Model:</span>
                <div className="flex items-center gap-2">
                  <img
                    src={
                      SUPPORTED_AI_MODELS.find((m) => m.value === aiModel)?.logo
                    }
                    alt={
                      SUPPORTED_AI_MODELS.find((m) => m.value === aiModel)
                        ?.provider
                    }
                    className="w-6 h-6 rounded object-contain bg-white dark:bg-gray-800 p-0.5"
                  />
                  <span className="text-text-primary font-medium">
                    {
                      SUPPORTED_AI_MODELS.find((m) => m.value === aiModel)
                        ?.label
                    }
                  </span>
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Max Leverage:</span>
                <span className="text-text-primary font-medium">
                  {maxLeverage}x
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">
                  Min Notional Per Trade:
                </span>
                <span className="text-text-primary font-medium">
                  {minNotionalPerTrade} USDT
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">
                  Max Notional Per Trade:
                </span>
                <span className="text-text-primary font-medium">
                  {maxNotionalPerTrade} USDT
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Max Open Trades:</span>
                <span className="text-text-primary font-medium">
                  {maxOpenTrades}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Custom Prompt:</span>
                <span className="text-text-primary font-medium">
                  {customPrompt === DEFAULT_PROMPT_TEMPLATE
                    ? "Default"
                    : "Custom"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">
                  Payment Transaction:
                </span>
                <span className="text-text-primary font-mono text-sm">
                  {paymentTxHash.slice(0, 10)}...{paymentTxHash.slice(-8)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep("config")}
              className="btn btn-secondary flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={createBotMutation.isPending}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {createBotMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Bot...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create Bot
                </>
              )}
            </button>
          </div>

          {createBotMutation.isError && (
            <div className="card bg-error/10 border-error">
              <p className="text-error">
                Failed to create bot. Please try again or contact support.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
