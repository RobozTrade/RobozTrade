-- Migration: Add trading execution and monitoring tables
-- Date: 2025-01-XX

-- Trading execution history table
CREATE TABLE IF NOT EXISTS trade_history (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL,
  leverage INTEGER NOT NULL,
  margin REAL NOT NULL,
  realized_pnl REAL,
  fees REAL,
  order_id TEXT,
  stop_loss_order_id TEXT,
  take_profit_order_id TEXT,
  ai_reasoning TEXT,
  status TEXT NOT NULL,
  opened_at INTEGER DEFAULT (unixepoch()),
  closed_at INTEGER
);

-- Bot execution logs table
CREATE TABLE IF NOT EXISTS bot_executions (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  execution_time INTEGER DEFAULT (unixepoch()),
  symbols_processed TEXT,
  market_data TEXT,
  ai_decisions TEXT,
  trades_executed INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  execution_duration INTEGER,
  status TEXT NOT NULL
);

-- Position snapshots table
CREATE TABLE IF NOT EXISTS position_snapshots (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  trade_id TEXT REFERENCES trade_history(id),
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  current_price REAL NOT NULL,
  liquidation_price REAL,
  unrealized_pnl REAL NOT NULL,
  leverage INTEGER NOT NULL,
  margin REAL NOT NULL,
  stop_loss REAL,
  take_profit REAL,
  snapshot_time INTEGER DEFAULT (unixepoch())
);

-- Bot performance metrics table
CREATE TABLE IF NOT EXISTS bot_metrics (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL UNIQUE REFERENCES trading_bots(id) ON DELETE CASCADE,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  total_return REAL NOT NULL DEFAULT 0,
  total_pnl REAL NOT NULL DEFAULT 0,
  sharpe_ratio REAL,
  max_drawdown REAL,
  win_rate REAL,
  average_win REAL,
  average_loss REAL,
  profit_factor REAL,
  last_updated INTEGER DEFAULT (unixepoch())
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_trade_history_bot_id ON trade_history(bot_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_symbol ON trade_history(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_history_status ON trade_history(status);
CREATE INDEX IF NOT EXISTS idx_bot_executions_bot_id ON bot_executions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_executions_time ON bot_executions(execution_time);
CREATE INDEX IF NOT EXISTS idx_position_snapshots_bot_id ON position_snapshots(bot_id);
CREATE INDEX IF NOT EXISTS idx_position_snapshots_symbol ON position_snapshots(symbol);

