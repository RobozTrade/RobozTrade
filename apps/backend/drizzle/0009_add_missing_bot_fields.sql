-- Migration: Add missing bot configuration fields
-- Date: 2025-10-26

ALTER TABLE trading_bots ADD COLUMN min_hold_minutes INTEGER DEFAULT 30;
ALTER TABLE trading_bots ADD COLUMN max_trades_per_hour INTEGER DEFAULT 6;