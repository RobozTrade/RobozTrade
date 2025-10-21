import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
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
    .notNull()
    .references(() => apiKeys.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  strategyType: text('strategy_type').notNull(),
  tradingPair: text('trading_pair').notNull(),
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

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type TradingBot = typeof tradingBots.$inferSelect;
export type NewTradingBot = typeof tradingBots.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type BenchmarkTest = typeof benchmarkTests.$inferSelect;
export type NewBenchmarkTest = typeof benchmarkTests.$inferInsert;

