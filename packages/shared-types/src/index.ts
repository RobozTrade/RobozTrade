// User Types
export interface User {
  id: string;
  email: string;
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
}

export interface CreateBotInput {
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

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

