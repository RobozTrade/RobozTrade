-- Migration: Add composite indexes for query optimization
-- Date: 2025-01-XX
-- Purpose: Reduce D1 row reads by adding indexes for common query patterns

-- Composite index for filtering trades by bot and status
-- Used in queries like: WHERE bot_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_trade_history_bot_status ON trade_history(bot_id, status);

-- Composite index for filtering trades by bot and ordering by opened_at
-- Used in queries like: WHERE bot_id = ? ORDER BY opened_at DESC
CREATE INDEX IF NOT EXISTS idx_trade_history_bot_opened ON trade_history(bot_id, opened_at DESC);

-- Index on closed_at for queries filtering closed trades
-- Used in public endpoints that fetch recent closed trades
CREATE INDEX IF NOT EXISTS idx_trade_history_closed_at ON trade_history(closed_at DESC);

-- Composite index for status and closed_at
-- Used in queries like: WHERE status = 'CLOSED' ORDER BY closed_at DESC
CREATE INDEX IF NOT EXISTS idx_trade_history_status_closed ON trade_history(status, closed_at DESC);

-- Index on user_id for trading_bots to speed up user bot lookups
-- Used when fetching all bots for a user
CREATE INDEX IF NOT EXISTS idx_trading_bots_user_id ON trading_bots(user_id);

-- Composite index for bot_executions by bot and time
-- Used for performance history queries
CREATE INDEX IF NOT EXISTS idx_bot_executions_bot_time ON bot_executions(bot_id, execution_time DESC);

