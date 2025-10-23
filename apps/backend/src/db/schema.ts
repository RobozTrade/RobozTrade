import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  walletAddress: text('wallet_address').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const nonces = sqliteTable('nonces', {
  id: text('id').primaryKey(),
  walletAddress: text('wallet_address').notNull(),
  nonce: text('nonce').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  apiKey: text('api_key').notNull(),
  apiSecret: text('api_secret').notNull(),
  label: text('label').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const tradingBots = sqliteTable('trading_bots', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  apiKeyId: text('api_key_id')
    .references(() => apiKeys.id, { onDelete: 'cascade' }),
  // Encrypted API keys stored directly on bot
  asterApiKey: text('aster_api_key'),
  asterApiSecret: text('aster_api_secret'),
  openRouterApiKey: text('openrouter_api_key'),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  // New fields for simplified bot configuration
  tradingSymbols: text('trading_symbols', { mode: 'json' }), // Array of trading symbols
  aiModel: text('ai_model'), // AI model to use
  customPrompt: text('custom_prompt'), // Custom prompt template
  maxLeverage: integer('max_leverage'),
  minNotionalPerTrade: real('min_notional_per_trade'),
  maxNotionalPerTrade: real('max_notional_per_trade'),
  maxOpenTrades: integer('max_open_trades'),
  // Legacy fields (kept for backward compatibility)
  strategyType: text('strategy_type'),
  tradingPair: text('trading_pair'),
  config: text('config', { mode: 'json' }),
  riskConfig: text('risk_config', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const trades = sqliteTable('trades', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => tradingBots.id, { onDelete: 'cascade' }),
  tradingPair: text('trading_pair').notNull(),
  side: text('side').notNull(),
  price: real('price').notNull(),
  quantity: real('quantity').notNull(),
  pnl: real('pnl'),
  executedAt: integer('executed_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const benchmarkTests = sqliteTable('benchmark_tests', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  scenarioType: text('scenario_type').notNull(),
  score: real('score'),
  results: text('results', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const botPayments = sqliteTable('bot_payments', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  botId: text('bot_id')
    .references(() => tradingBots.id, { onDelete: 'set null' }),
  txHash: text('tx_hash').notNull().unique(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USDT'),
  status: text('status').notNull().default('pending'),
  blockNumber: integer('block_number'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
});

// Trading execution history
export const tradeHistory = sqliteTable('trade_history', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => tradingBots.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(), // 'BUY', 'SELL'
  orderType: text('order_type').notNull(), // 'MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT'
  quantity: real('quantity').notNull(),
  entryPrice: real('entry_price').notNull(),
  exitPrice: real('exit_price'),
  leverage: integer('leverage').notNull(),
  margin: real('margin').notNull(),
  realizedPnl: real('realized_pnl'),
  fees: real('fees'),
  orderId: text('order_id'),
  stopLossOrderId: text('stop_loss_order_id'),
  takeProfitOrderId: text('take_profit_order_id'),
  aiReasoning: text('ai_reasoning'),
  status: text('status').notNull(), // 'OPEN', 'CLOSED', 'CANCELLED'
  openedAt: integer('opened_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
});

// Bot execution logs
export const botExecutions = sqliteTable('bot_executions', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => tradingBots.id, { onDelete: 'cascade' }),
  executionTime: integer('execution_time', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  symbolsProcessed: text('symbols_processed', { mode: 'json' }), // array of symbols
  marketData: text('market_data', { mode: 'json' }), // snapshot of market data
  aiDecisions: text('ai_decisions', { mode: 'json' }), // AI decisions for each symbol
  aiPrompt: text('ai_prompt'),
  aiResponse: text('ai_response'),
  aiThinking: text('ai_thinking'),
  aiRuntimeMs: integer('ai_runtime_ms'),
  aiInvocations: integer('ai_invocations'),
  accountBalance: real('account_balance'),
  accountExposure: real('account_exposure'),
  tradesExecuted: integer('trades_executed').notNull().default(0),
  errors: text('errors', { mode: 'json' }), // any errors encountered
  executionDuration: integer('execution_duration'), // milliseconds
  status: text('status').notNull(), // 'SUCCESS', 'PARTIAL', 'FAILED'
});

// Position snapshots for tracking
export const positionSnapshots = sqliteTable('position_snapshots', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => tradingBots.id, { onDelete: 'cascade' }),
  tradeId: text('trade_id').references(() => tradeHistory.id),
  symbol: text('symbol').notNull(),
  quantity: real('quantity').notNull(),
  entryPrice: real('entry_price').notNull(),
  currentPrice: real('current_price').notNull(),
  liquidationPrice: real('liquidation_price'),
  unrealizedPnl: real('unrealized_pnl').notNull(),
  leverage: integer('leverage').notNull(),
  margin: real('margin').notNull(),
  stopLoss: real('stop_loss'),
  takeProfit: real('take_profit'),
  snapshotTime: integer('snapshot_time', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Bot performance metrics
export const botMetrics = sqliteTable('bot_metrics', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => tradingBots.id, { onDelete: 'cascade' })
    .unique(),
  totalTrades: integer('total_trades').notNull().default(0),
  winningTrades: integer('winning_trades').notNull().default(0),
  losingTrades: integer('losing_trades').notNull().default(0),
  totalReturn: real('total_return').notNull().default(0),
  totalPnl: real('total_pnl').notNull().default(0),
  sharpeRatio: real('sharpe_ratio'),
  maxDrawdown: real('max_drawdown'),
  winRate: real('win_rate'),
  averageWin: real('average_win'),
  averageLoss: real('average_loss'),
  profitFactor: real('profit_factor'),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Nonce = typeof nonces.$inferSelect;
export type NewNonce = typeof nonces.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type TradingBot = typeof tradingBots.$inferSelect;
export type NewTradingBot = typeof tradingBots.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type BenchmarkTest = typeof benchmarkTests.$inferSelect;
export type NewBenchmarkTest = typeof benchmarkTests.$inferInsert;

export type BotPayment = typeof botPayments.$inferSelect;
export type NewBotPayment = typeof botPayments.$inferInsert;

