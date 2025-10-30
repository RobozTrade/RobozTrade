-- Migration: Add bot_performance_snapshots table
-- Date: 2025-01-30
-- Description: Create table to store bot account value snapshots at each execution

CREATE TABLE IF NOT EXISTS bot_performance_snapshots (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  total_balance REAL NOT NULL,
  snapshot_time INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Create index for efficient queries by bot_id and time
CREATE INDEX IF NOT EXISTS idx_bot_performance_snapshots_bot_id ON bot_performance_snapshots(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_performance_snapshots_time ON bot_performance_snapshots(snapshot_time);
CREATE INDEX IF NOT EXISTS idx_bot_performance_snapshots_bot_time ON bot_performance_snapshots(bot_id, snapshot_time);

