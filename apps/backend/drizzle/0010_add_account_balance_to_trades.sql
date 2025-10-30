-- Migration: Add account balance tracking to trade history
-- Date: 2025-01-30
-- Purpose: Track account balance at the time of each trade for performance charting

ALTER TABLE trade_history ADD COLUMN account_balance REAL;

-- Create index for efficient querying by bot and time
CREATE INDEX IF NOT EXISTS idx_trade_history_bot_opened ON trade_history(bot_id, opened_at ASC);

