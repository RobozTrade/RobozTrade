import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { WalletConnect } from '@/components/web3/WalletConnect';
import { PaymentFlow } from '@/components/web3/PaymentFlow';
import type { StrategyType, CreateBotInput } from '@roboz-trade/shared-types';

type Step = 'wallet' | 'payment' | 'config' | 'review';

export default function CreateBotPageNew() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  
  const [currentStep, setCurrentStep] = useState<Step>('wallet');
  const [paymentTxHash, setPaymentTxHash] = useState('');
  const [paymentValidated, setPaymentValidated] = useState(false);
  
  // Form state
  const [asterApiKey, setAsterApiKey] = useState('');
  const [asterApiSecret, setAsterApiSecret] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [name, setName] = useState('');
  const [strategyType, setStrategyType] = useState<StrategyType>('ma_cross');
  const [tradingPair, setTradingPair] = useState('BTCUSDT');
  const [maxLeverage, setMaxLeverage] = useState(10);
  const [maxMarginPerTrade, setMaxMarginPerTrade] = useState(100);
  const [profitFactorThreshold, setProfitFactorThreshold] = useState(1.5);
  const [maxPositionSize, setMaxPositionSize] = useState(1000);
  const [stopLossPercentage, setStopLossPercentage] = useState(2);
  const [takeProfitPercentage, setTakeProfitPercentage] = useState(5);
  const [maxDailyLoss, setMaxDailyLoss] = useState(500);
  const [maxOpenTrades, setMaxOpenTrades] = useState(3);

  const validatePaymentMutation = useMutation({
    mutationFn: (txHash: string) => api.validatePayment(txHash),
    onSuccess: (response) => {
      if (response.success && response.data?.valid) {
        setPaymentValidated(true);
        setCurrentStep('config');
      }
    },
  });

  const createBotMutation = useMutation({
    mutationFn: (input: CreateBotInput) => api.createBot(input),
    onSuccess: () => {
      navigate('/app/bots');
    },
  });

  const handlePaymentComplete = (txHash: string) => {
    setPaymentTxHash(txHash);
    // Validate payment with backend
    validatePaymentMutation.mutate(txHash);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const input: CreateBotInput = {
      paymentTxHash,
      asterApiKey,
      asterApiSecret,
      openRouterApiKey,
      name,
      strategyType,
      tradingPair,
      config: {
        shortPeriod: 10,
        longPeriod: 20,
      },
      riskConfig: {
        maxPositionSize,
        stopLossPercentage,
        takeProfitPercentage,
        maxDailyLoss,
        maxOpenTrades,
        maxLeverage,
        maxMarginPerTrade,
        profitFactorThreshold,
      },
    };

    createBotMutation.mutate(input);
  };

  const canProceedToReview = name && asterApiKey && asterApiSecret && openRouterApiKey && tradingPair;

  const steps = [
    { id: 'wallet', label: 'Connect Wallet', completed: isConnected },
    { id: 'payment', label: 'Payment', completed: paymentValidated },
    { id: 'config', label: 'Configuration', completed: canProceedToReview },
    { id: 'review', label: 'Review & Create', completed: false },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/app/bots')}
          className="btn btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Create Trading Bot</h1>
          <p className="text-text-secondary mt-1">
            Set up your AI-powered trading bot with secure payment
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="card">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    step.completed
                      ? 'bg-success border-success text-white'
                      : currentStep === step.id
                      ? 'bg-primary border-primary text-white'
                      : 'bg-surface border-border text-text-secondary'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-sm mt-2 ${
                    currentStep === step.id ? 'text-text-primary font-medium' : 'text-text-secondary'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 ${
                    step.completed ? 'bg-success' : 'bg-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 'wallet' && (
        <div className="space-y-6">
          <WalletConnect />
          {isConnected && (
            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep('payment')}
                className="btn btn-primary flex items-center gap-2"
              >
                Continue to Payment
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === 'payment' && (
        <div className="space-y-6">
          <PaymentFlow onPaymentComplete={handlePaymentComplete} />
          
          {validatePaymentMutation.isPending && (
            <div className="card flex items-center justify-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-text-primary">Validating payment...</span>
            </div>
          )}

          {validatePaymentMutation.isError && (
            <div className="card bg-error/10 border-error">
              <p className="text-error">
                Payment validation failed. Please try again or contact support.
              </p>
            </div>
          )}
        </div>
      )}

      {currentStep === 'config' && (
        <form onSubmit={(e) => { e.preventDefault(); setCurrentStep('review'); }} className="space-y-6">
          <div className="card space-y-6">
            <h3 className="text-xl font-semibold text-text-primary">Bot Configuration</h3>

            <div>
              <label className="label">Bot Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="My Trading Bot"
                required
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
                Get your API key from{' '}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Trading Pair *</label>
                <input
                  type="text"
                  value={tradingPair}
                  onChange={(e) => setTradingPair(e.target.value)}
                  className="input"
                  placeholder="BTCUSDT"
                  required
                />
              </div>

              <div>
                <label className="label">Strategy Type</label>
                <select
                  value={strategyType}
                  onChange={(e) => setStrategyType(e.target.value as StrategyType)}
                  className="input"
                >
                  <option value="ma_cross">Moving Average Cross</option>
                  <option value="rsi">RSI</option>
                  <option value="bollinger">Bollinger Bands</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card space-y-6">
            <h3 className="text-xl font-semibold text-text-primary">Risk Management</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Max Leverage</label>
                <input
                  type="number"
                  value={maxLeverage}
                  onChange={(e) => setMaxLeverage(Number(e.target.value))}
                  className="input"
                  min="1"
                  max="125"
                />
              </div>

              <div>
                <label className="label">Max Margin Per Trade (USDT)</label>
                <input
                  type="number"
                  value={maxMarginPerTrade}
                  onChange={(e) => setMaxMarginPerTrade(Number(e.target.value))}
                  className="input"
                  min="1"
                />
              </div>

              <div>
                <label className="label">Profit Factor Threshold</label>
                <input
                  type="number"
                  step="0.1"
                  value={profitFactorThreshold}
                  onChange={(e) => setProfitFactorThreshold(Number(e.target.value))}
                  className="input"
                  min="0.1"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Bot stops when PF falls below this value
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Max Position Size (USDT)</label>
                <input
                  type="number"
                  value={maxPositionSize}
                  onChange={(e) => setMaxPositionSize(Number(e.target.value))}
                  className="input"
                  min="1"
                />
              </div>

              <div>
                <label className="label">Max Open Trades</label>
                <input
                  type="number"
                  value={maxOpenTrades}
                  onChange={(e) => setMaxOpenTrades(Number(e.target.value))}
                  className="input"
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Stop Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={stopLossPercentage}
                  onChange={(e) => setStopLossPercentage(Number(e.target.value))}
                  className="input"
                  min="0.1"
                />
              </div>

              <div>
                <label className="label">Take Profit (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={takeProfitPercentage}
                  onChange={(e) => setTakeProfitPercentage(Number(e.target.value))}
                  className="input"
                  min="0.1"
                />
              </div>

              <div>
                <label className="label">Max Daily Loss (USDT)</label>
                <input
                  type="number"
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                  className="input"
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep('payment')}
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

      {currentStep === 'review' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <h3 className="text-xl font-semibold text-text-primary">Review Your Bot</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Bot Name:</span>
                <span className="text-text-primary font-medium">{name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Trading Pair:</span>
                <span className="text-text-primary font-medium">{tradingPair}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Strategy:</span>
                <span className="text-text-primary font-medium">
                  {strategyType.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Max Leverage:</span>
                <span className="text-text-primary font-medium">{maxLeverage}x</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Max Margin Per Trade:</span>
                <span className="text-text-primary font-medium">{maxMarginPerTrade} USDT</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Profit Factor Threshold:</span>
                <span className="text-text-primary font-medium">{profitFactorThreshold}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Payment Transaction:</span>
                <span className="text-text-primary font-mono text-sm">
                  {paymentTxHash.slice(0, 10)}...{paymentTxHash.slice(-8)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep('config')}
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

