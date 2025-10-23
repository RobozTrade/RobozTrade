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
  maxMarginPerTrade: real('max_margin_per_trade'),
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

