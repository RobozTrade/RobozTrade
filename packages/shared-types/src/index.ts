// Constants
export const SUPPORTED_TRADING_SYMBOLS: TradingSymbol[] = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'MATICUSDT',
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

export const SUPPORTED_AI_MODELS: { value: AIModel; label: string; description: string }[] = [
  { value: 'openai/gpt-4o', label: 'GPT-4o', description: 'Latest OpenAI model, fast and capable' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', description: 'Faster, more affordable GPT-4o' },
  { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Previous generation flagship' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', description: 'Best for complex reasoning' },
  { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus', description: 'Most capable Claude model' },
  { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fast and affordable' },
  { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5', description: 'Google\'s advanced model' },
  { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5', description: 'Fast Google model' },
  { value: 'meta-llama/llama-3.1-405b', label: 'Llama 3.1 405B', description: 'Largest open-source model' },
  { value: 'meta-llama/llama-3.1-70b', label: 'Llama 3.1 70B', description: 'Balanced open-source model' },
  { value: 'x-ai/grok-beta', label: 'Grok Beta', description: 'xAI\'s conversational model' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', description: 'Efficient reasoning model' },
  { value: 'qwen/qwen-2.5-72b', label: 'Qwen 2.5 72B', description: 'Alibaba\'s advanced model' },
];

export const DEFAULT_PROMPT_TEMPLATE = `You are an expert cryptocurrency futures trader managing a portfolio with {{available_cash}} USDT available.

Current Time: {{current_time}}
Trading Session: {{cycle_count}} cycles, {{minutes_trading}} minutes active
Account Performance: {{total_return}}% return, Sharpe Ratio: {{sharpe_ratio}}

MARKET DATA:
{{#each symbols}}
{{symbol}}:
- Price: {{current_price}} (EMA20: {{current_ema20}})
- MACD: {{current_macd}} | RSI(7): {{current_rsi}}
- Open Interest: {{open_interest}} | Funding Rate: {{funding_rate}}
{{#if position}}
- Current Position: {{position.quantity}} @ {{position.entry_price}} (PnL: {{position.unrealized_pnl}} USDT)
- Leverage: {{position.leverage}}x | Stop Loss: {{position.stop_loss}} | Take Profit: {{position.profit_target}}
{{/if}}
{{/each}}

INSTRUCTIONS:
Analyze the market data and provide trading signals for each symbol.
For each symbol, respond with:
- signal: "buy", "sell", or "hold"
- quantity: position size
- leverage: 1-{{max_leverage}}
- stop_loss: stop loss price
- profit_target: take profit price
- confidence: 0-1 confidence score
- justification: brief reasoning

Risk Limits:
- Max Leverage: {{max_leverage}}x
- Max Margin Per Trade: {{max_margin_per_trade}} USDT
- Max Open Trades: {{max_open_trades}}`;

export const PROMPT_TEMPLATE_VARIABLES = [
  { name: '{{current_time}}', description: 'Current timestamp' },
  { name: '{{cycle_count}}', description: 'Number of trading cycles executed' },
  { name: '{{minutes_trading}}', description: 'Minutes since bot started' },
  { name: '{{available_cash}}', description: 'Available USDT balance' },
  { name: '{{account_value}}', description: 'Total account value in USDT' },
  { name: '{{total_return}}', description: 'Total return percentage' },
  { name: '{{sharpe_ratio}}', description: 'Sharpe ratio of the strategy' },
  { name: '{{max_leverage}}', description: 'Maximum allowed leverage' },
  { name: '{{max_margin_per_trade}}', description: 'Maximum margin per trade in USDT' },
  { name: '{{max_open_trades}}', description: 'Maximum number of open positions' },
  { name: '{{symbol}}', description: 'Trading symbol (e.g., BTC, ETH)' },
  { name: '{{current_price}}', description: 'Current market price' },
  { name: '{{current_ema20}}', description: 'Current 20-period EMA' },
  { name: '{{current_macd}}', description: 'Current MACD value' },
  { name: '{{current_rsi}}', description: 'Current RSI(7) value' },
  { name: '{{open_interest}}', description: 'Current open interest' },
  { name: '{{funding_rate}}', description: 'Current funding rate' },
  { name: '{{position.quantity}}', description: 'Current position quantity' },
  { name: '{{position.entry_price}}', description: 'Position entry price' },
  { name: '{{position.unrealized_pnl}}', description: 'Unrealized profit/loss' },
  { name: '{{position.leverage}}', description: 'Position leverage' },
  { name: '{{position.stop_loss}}', description: 'Position stop loss price' },
  { name: '{{position.profit_target}}', description: 'Position take profit price' },
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
  | 'MATICUSDT'
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
  | 'openai/gpt-4-turbo'
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'anthropic/claude-3.5-sonnet'
  | 'anthropic/claude-3-opus'
  | 'anthropic/claude-3-haiku'
  | 'google/gemini-pro-1.5'
  | 'google/gemini-flash-1.5'
  | 'meta-llama/llama-3.1-405b'
  | 'meta-llama/llama-3.1-70b'
  | 'x-ai/grok-beta'
  | 'deepseek/deepseek-chat'
  | 'qwen/qwen-2.5-72b';

export interface TradingBot {
  id: string;
  userId: string;
  apiKeyId: string;
  name: string;
  status: BotStatus;
  strategyType: StrategyType;
  tradingPair: string;
  config: StrategyConfig;
  riskConfig: RiskConfig;
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
  maxMarginPerTrade: number;
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
  config?: StrategyConfig;
  riskConfig?: RiskConfig;
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
  type: 'ticker' | 'kline' | 'trade' | 'error';
  data: any;
}

export interface SubscribeMessage {
  action: 'subscribe' | 'unsubscribe';
  channels: string[];
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

