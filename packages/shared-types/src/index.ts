// Constants
export const SUPPORTED_TRADING_SYMBOLS: TradingSymbol[] = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'DOTUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'UNIUSDT',
  'ATOMUSDT',
  'LTCUSDT',
  'NEARUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT',
];

export const SUPPORTED_AI_MODELS: {
  value: AIModel;
  label: string;
  description: string;
  logo: string;
  provider: string;
}[] = [
    // OpenAI Models (Latest - October 2025)
    { value: 'openai/gpt-5', label: 'GPT-5', description: 'Latest flagship model with advanced reasoning', logo: '/logos/openai.svg', provider: 'OpenAI' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', description: 'Fast GPT-5 variant for quick responses', logo: '/logos/openai.svg', provider: 'OpenAI' },
    { value: 'openai/o3', label: 'OpenAI o3', description: 'Most advanced reasoning model', logo: '/logos/openai.svg', provider: 'OpenAI' },

    // Anthropic Models (Latest - October 2025)
    { value: 'anthropic/claude-4.5-sonnet', label: 'Claude 4.5 Sonnet', description: 'Latest Claude with enhanced capabilities', logo: '/logos/claude.svg', provider: 'Anthropic' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Proven model for coding and analysis', logo: '/logos/claude.svg', provider: 'Anthropic' },

    // Google Models (Latest - October 2025)
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Latest flagship with advanced reasoning', logo: '/logos/gemini.svg', provider: 'Google' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and efficient latest model', logo: '/logos/gemini.svg', provider: 'Google' },
    { value: 'google/gemma-3-27b-it', label: 'Gemma 3 27B', description: 'Latest open-source model from Google', logo: '/logos/gemini.svg', provider: 'Google' },

    // Meta Llama Models (Latest Open Source - October 2025)
    { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout 17B', description: 'Latest multimodal Llama model', logo: '/logos/meta.svg', provider: 'Meta' },
    { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick 17B', description: 'Latest multimodal Llama variant', logo: '/logos/meta.svg', provider: 'Meta' },

    // DeepSeek Models (Latest Open Source, Finance-focused)
    { value: 'deepseek/deepseek-v3.1-terminus', label: 'DeepSeek V3.1', description: 'Latest DeepSeek model with enhanced capabilities', logo: '/logos/deepseek.svg', provider: 'DeepSeek' },
    { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', description: 'Advanced reasoning model', logo: '/logos/deepseek.svg', provider: 'DeepSeek' },

    // Qwen Models (Latest Open Source)
    { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', description: 'Alibaba\'s latest advanced model', logo: '/logos/qwen.svg', provider: 'Qwen' },

    // Mistral Models (Latest Open Source)
    { value: 'mistralai/mistral-large', label: 'Mistral Large', description: 'Latest flagship Mistral model', logo: '/logos/mistral.svg', provider: 'Mistral AI' },

    // xAI Models (Latest - October 2025)
    { value: 'x-ai/grok-4', label: 'Grok 4', description: 'Most intelligent model with real-time search', logo: '/logos/xai.svg', provider: 'xAI' },

    // Cohere Models (Latest)
    { value: 'cohere/command-r-plus', label: 'Command R+', description: 'Enterprise-grade RAG and reasoning', logo: '/logos/cohere.svg', provider: 'Cohere' },

    // Perplexity Models (Latest with real-time web access)
    { value: 'perplexity/sonar-pro', label: 'Sonar Pro', description: 'Latest flagship model from Perplexity', logo: '/logos/perplexity.svg', provider: 'Perplexity' },
  ]; export const DEFAULT_PROMPT_TEMPLATE = `You are an expert cryptocurrency futures trader overseeing a multi-asset USDT-margined portfolio.

SESSION CONTEXT
It has been {{minutes_trading}} minutes since you started trading. The current time is {{current_time}} and you've been invoked {{total_invocations}} times to reason through the markets.
Cycle count to date: {{cycle_count}} trading loops completed.
Below, we are providing state data, price action, and predictive signals so you can surface alpha. Following that, you will see portfolio value, performance metrics, and any active positions.

ALL OF THE PRICE OR SIGNAL DATA BELOW IS ORDERED: OLDEST → NEWEST
Timeframes note: Unless stated otherwise in a section title, intraday series use 3-minute intervals. If a symbol uses a different cadence, its section explicitly states the interval.

PORTFOLIO OVERVIEW
- Current Time: {{current_time}}
- Initial Balance: {{initial_balance}} USDT | Current Value: {{account_value}} USDT | Available Cash: {{available_cash}} USDT
- Total Return: {{total_return}}% | Sharpe Ratio: {{sharpe_ratio}} | Win Rate: {{win_rate}}%
- Current Exposure: {{account_exposure}} USDT
- Risk Limits: Max Leverage {{max_leverage}}x • Min Notional/Trade {{min_notional_per_trade}} USDT • Max Notional/Trade {{max_notional_per_trade}} USDT • Max Open Trades {{max_open_trades}}

MARKET INTELLIGENCE
{{#each symbols}}
{{symbol}} Snapshot
- Spot: {{current_price}} USDT | EMA20 {{current_ema20}} | EMA50 {{current_ema50}}
- MACD: {{current_macd}} (signal {{current_macd_signal}}, hist {{current_macd_histogram}})
- RSI: 7-period {{current_rsi7}} | 14-period {{current_rsi14}}
- Open Interest: {{open_interest}} | Funding Rate: {{funding_rate}} ({{funding_rate_percent}}%)

Intraday Momentum (15m, oldest → latest)
- Mid prices: {{intraday_mid_prices}}
- EMA20: {{intraday_ema20_series}}
- MACD: {{intraday_macd_series}}
- RSI(7): {{intraday_rsi7_series}}
- RSI(14): {{intraday_rsi14_series}}

Higher-Timeframe Context (4h)
- EMA20 vs EMA50: {{ht_ema20}} vs {{ht_ema50}}
- ATR(3) vs ATR(14): {{ht_atr3}} vs {{ht_atr14}}
- Volume: current {{ht_volume_current}} vs average {{ht_volume_average}}
- MACD series: {{ht_macd_series}}
- RSI(14) series: {{ht_rsi14_series}}

{{#if position}}
Position Status
- Side: {{position.side}} | Quantity: {{position.quantity}} | Entry: {{position.entry_price}}
- Unrealized PnL: {{position.unrealized_pnl}} USDT
- Leverage: {{position.leverage}}x | Notional: {{position.notional}} USDT | Liquidation: {{position.liquidation_price}}
- Time in Position: {{position.entry_time}} ({{position.minutes_held}} minutes)
{{/if}}
{{/each}}

POSITION MANAGEMENT GUIDELINES
- MINIMUM HOLD: Positions should be held for at least 30 minutes unless stop loss is hit
- For positions <30 minutes old: Strongly prefer HOLD over CLOSE unless facing >3% adverse move
- TRADING COSTS: Each trade costs ~0.05% in fees. Factor this into close decisions.
- WIN RATE CONTEXT: Your current win rate is {{win_rate}}% - focus on quality setups, not quantity
- PERFORMANCE: Total return {{total_return}}%, Sharpe {{sharpe_ratio}}

TASK
For each symbol, provide:
- action: BUY, SELL, HOLD, or CLOSE
  * Use CLOSE sparingly - only when position thesis is invalidated or targets reached
  * Prefer HOLD for positions still developing (especially if <30 min old)
  * Consider position age before closing - premature exits waste setup opportunities
- target_notional: desired notional exposure within limits (USDT)
- leverage: up to {{max_leverage}}x (justify higher leverage)
- stop_loss & take_profit levels (USDT)
- confidence (0-1)
- reasoning: Must explain why closing (if CLOSE action) including position age consideration
  * Summarize intraday + higher timeframe drivers
  * For CLOSE actions, explicitly state why the position thesis is invalidated

Ensure notional sizing respects portfolio limits and exchange minimums, preserves diversification, and avoids conflicting positions.`;

export const PROMPT_TEMPLATE_VARIABLES = [
  { name: '{{current_time}}', description: 'Current timestamp' },
  { name: '{{cycle_count}}', description: 'Number of trading cycles executed' },
  { name: '{{total_invocations}}', description: 'Number of AI reasoning invocations executed' },
  { name: '{{minutes_trading}}', description: 'Minutes since bot started' },
  { name: '{{available_cash}}', description: 'Available USDT balance' },
  { name: '{{account_value}}', description: 'Total account value in USDT' },
  { name: '{{total_return}}', description: 'Total return percentage' },
  { name: '{{sharpe_ratio}}', description: 'Sharpe ratio of the strategy' },
  { name: '{{account_exposure}}', description: 'Total current portfolio exposure in USDT' },
  { name: '{{max_leverage}}', description: 'Maximum allowed leverage' },
  { name: '{{min_notional_per_trade}}', description: 'Minimum notional per trade in USDT' },
  { name: '{{max_notional_per_trade}}', description: 'Maximum notional per trade in USDT' },
  { name: '{{max_open_trades}}', description: 'Maximum number of open positions' },
  { name: '{{symbol}}', description: 'Trading symbol (e.g., BTC, ETH)' },
  { name: '{{current_price}}', description: 'Current market price' },
  { name: '{{current_ema20}}', description: 'Current 20-period EMA' },
  { name: '{{current_ema50}}', description: 'Current 50-period EMA' },
  { name: '{{current_macd}}', description: 'Current MACD value' },
  { name: '{{current_macd_signal}}', description: 'Current MACD signal value' },
  { name: '{{current_macd_histogram}}', description: 'Current MACD histogram value' },
  { name: '{{current_rsi7}}', description: 'Current RSI(7) value' },
  { name: '{{current_rsi14}}', description: 'Current RSI(14) value' },
  { name: '{{open_interest}}', description: 'Current open interest' },
  { name: '{{funding_rate}}', description: 'Current funding rate (decimal)' },
  { name: '{{funding_rate_percent}}', description: 'Current funding rate (percentage)' },
  { name: '{{intraday_mid_prices}}', description: '15-minute mid prices (array)' },
  { name: '{{intraday_ema20_series}}', description: '15-minute EMA20 series' },
  { name: '{{intraday_macd_series}}', description: '15-minute MACD series' },
  { name: '{{intraday_rsi7_series}}', description: '15-minute RSI(7) series' },
  { name: '{{intraday_rsi14_series}}', description: '15-minute RSI(14) series' },
  { name: '{{ht_ema20}}', description: '4-hour EMA20' },
  { name: '{{ht_ema50}}', description: '4-hour EMA50' },
  { name: '{{ht_atr3}}', description: '4-hour ATR(3)' },
  { name: '{{ht_atr14}}', description: '4-hour ATR(14)' },
  { name: '{{ht_volume_current}}', description: '4-hour current candle volume' },
  { name: '{{ht_volume_average}}', description: 'Average 4-hour volume' },
  { name: '{{ht_macd_series}}', description: '4-hour MACD series' },
  { name: '{{ht_rsi14_series}}', description: '4-hour RSI(14) series' },
  { name: '{{position.quantity}}', description: 'Current position quantity' },
  { name: '{{position.entry_price}}', description: 'Position entry price' },
  { name: '{{position.unrealized_pnl}}', description: 'Unrealized profit/loss' },
  { name: '{{position.leverage}}', description: 'Position leverage' },
  { name: '{{position.margin}}', description: 'Margin allocated to the position' },
  { name: '{{position.notional}}', description: 'Notional value of the position (quantity × entry price)' },
  { name: '{{position.liquidation_price}}', description: 'Liquidation price for the position' },
  { name: '{{position.stop_loss}}', description: 'Position stop loss price' },
  { name: '{{position.profit_target}}', description: 'Position take profit price' },
  { name: '{{position.entry_time}}', description: 'Time since position entry (formatted as "X min", "Xh Ym", or "Xd Yh")' },
  { name: '{{position.minutes_held}}', description: 'Total minutes the position has been held' },
];

// User Types
export interface User {
  id: string;
  walletAddress: string;
  displayName: string;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Wallet Authentication Types
export interface NonceRequest {
  walletAddress: string;
}

export interface NonceResponse {
  nonce: string;
  message: string;
  timestamp: number;
}

export interface WalletAuthRequest {
  walletAddress: string;
  signature: string;
  nonce: string;
  timestamp: number;
  displayName?: string; // Required for new users
}

export interface WalletAuthResponse {
  user: User;
  token: string;
  isNewUser: boolean;
}

// API Key Types
export interface ApiKey {
  id: string;
  userId: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateApiKeyInput {
  apiKey: string;
  apiSecret: string;
  label: string;
}

// Trading Bot Types
export type BotStatus = 'draft' | 'active' | 'paused' | 'stopped';
export type StrategyType = 'ma_cross' | 'rsi' | 'bollinger' | 'custom';
export type TradeSide = 'BUY' | 'SELL';

// Supported trading symbols (margin asset is always USDT)
export type TradingSymbol =
  | 'BTCUSDT'
  | 'ETHUSDT'
  | 'BNBUSDT'
  | 'SOLUSDT'
  | 'XRPUSDT'
  | 'DOGEUSDT'
  | 'ADAUSDT'
  | 'DOTUSDT'
  | 'AVAXUSDT'
  | 'LINKUSDT'
  | 'UNIUSDT'
  | 'ATOMUSDT'
  | 'LTCUSDT'
  | 'NEARUSDT'
  | 'APTUSDT'
  | 'ARBUSDT'
  | 'OPUSDT';

export type AIModel =
  // OpenAI (Latest - October 2025)
  | 'openai/gpt-5'
  | 'openai/gpt-5-mini'
  | 'openai/o3'
  // Anthropic (Latest - October 2025)
  | 'anthropic/claude-4.5-sonnet'
  | 'anthropic/claude-3.5-sonnet'
  // Google (Latest - October 2025)
  | 'google/gemini-2.5-pro'
  | 'google/gemini-2.5-flash'
  | 'google/gemma-3-27b-it'
  // Meta Llama (Latest Open Source - October 2025)
  | 'meta-llama/llama-4-scout'
  | 'meta-llama/llama-4-maverick'
  // DeepSeek (Latest Open Source)
  | 'deepseek/deepseek-v3.1-terminus'
  | 'deepseek/deepseek-r1'
  // Qwen (Latest Open Source)
  | 'qwen/qwen-2.5-72b-instruct'
  // Mistral (Latest Open Source)
  | 'mistralai/mistral-large'
  // xAI (Latest - October 2025)
  | 'x-ai/grok-4'
  // Cohere (Latest)
  | 'cohere/command-r-plus'
  // Perplexity (Latest)
  | 'perplexity/sonar-pro';

export interface TradingBot {
  id: string;
  userId: string;
  apiKeyId: string;
  name: string;
  status: BotStatus;
  // New bot fields
  tradingSymbols?: TradingSymbol[];
  aiModel?: AIModel;
  customPrompt?: string;
  maxLeverage?: number;
  minNotionalPerTrade?: number;
  maxNotionalPerTrade?: number;
  maxOpenTrades?: number;
  // Legacy bot fields
  strategyType?: StrategyType;
  tradingPair?: string;
  config?: StrategyConfig;
  riskConfig?: RiskConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyConfig {
  // MA Cross Strategy
  shortPeriod?: number;
  longPeriod?: number;

  // RSI Strategy
  rsiPeriod?: number;
  oversoldThreshold?: number;
  overboughtThreshold?: number;

  // Bollinger Bands
  period?: number;
  standardDeviations?: number;

  // Custom Strategy
  customLogic?: string;
}

export interface RiskConfig {
  maxPositionSize: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxDailyLoss: number;
  maxOpenTrades: number;
  maxLeverage?: number;
  maxMarginPerTrade?: number;
  minNotionalPerTrade?: number;
  maxNotionalPerTrade?: number;
  profitFactorThreshold?: number;
}

export interface CreateBotInput {
  // Payment validation
  paymentTxHash: string;

  // API Keys (will be encrypted on backend)
  asterApiKey: string;
  asterApiSecret: string;
  openRouterApiKey: string;

  // Bot configuration
  name: string;
  tradingSymbols: TradingSymbol[]; // Multiple symbols to trade
  aiModel: AIModel;
  customPrompt?: string; // Optional custom prompt template

  // Risk configuration (simplified)
  maxLeverage: number;
  minNotionalPerTrade: number;
  maxNotionalPerTrade: number;
  maxOpenTrades: number;
}

export interface CreateBotInputLegacy {
  apiKeyId: string;
  name: string;
  strategyType: StrategyType;
  tradingPair: string;
  config: StrategyConfig;
  riskConfig: RiskConfig;
}

export interface UpdateBotInput {
  name?: string;
  status?: BotStatus;

  // Legacy bot fields
  config?: StrategyConfig;
  riskConfig?: RiskConfig;

  // New AI-powered bot fields
  tradingSymbols?: TradingSymbol[];
  aiModel?: AIModel;
  customPrompt?: string;
  maxLeverage?: number;
  minNotionalPerTrade?: number;
  maxNotionalPerTrade?: number;
  maxOpenTrades?: number;
}

// Trade Types
export interface Trade {
  id: string;
  botId: string;
  tradingPair: string;
  side: TradeSide;
  price: number;
  quantity: number;
  pnl: number | null;
  executedAt: Date;
}

export interface PlaceOrderInput {
  symbol: string;
  side: TradeSide;
  quantity: number;
  price?: number;
}

// Market Data Types
export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataSubscription {
  symbol: string;
  interval?: string;
}

// Benchmark Types
export type ScenarioType = 'bull_market' | 'bear_market' | 'sideways' | 'high_volatility';

export interface BenchmarkTest {
  id: string;
  userId: string;
  name: string;
  scenarioType: ScenarioType;
  score: number | null;
  results: BenchmarkResults;
  createdAt: Date;
}

export interface BenchmarkResults {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalReturn: number;
  duration: number;
}

export interface CreateBenchmarkInput {
  name: string;
  scenarioType: ScenarioType;
  botId: string;
  startDate: string;
  endDate: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'ticker' | 'kline' | 'trade' | 'error' | 'bot_performance';
  data: any;
}

export interface SubscribeMessage {
  action: 'subscribe' | 'unsubscribe';
  channels: string[];
}

export interface BotPerformanceUpdate {
  botId: string;
  botName: string;
  totalBalance: number;
  unrealizedPnl: number;
  executionTime: string;
  status: string;
}

// Analytics Types
export interface BotPerformance {
  botId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  activeBots: number;
  totalTrades: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Payment Types
export interface BotPayment {
  id: string;
  userId: string;
  botId: string | null;
  txHash: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber: number | null;
  createdAt: Date;
  confirmedAt: Date | null;
}

export interface ValidatePaymentInput {
  txHash: string;
}

export interface ValidatePaymentResponse {
  valid: boolean;
  amount?: number;
  from?: string;
  to?: string;
  blockNumber?: number;
  confirmations?: number;
  error?: string;
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

