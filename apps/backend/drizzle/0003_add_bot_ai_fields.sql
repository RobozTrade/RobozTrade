-- Migration: Add AI model and simplified bot configuration fields
-- Date: 2025-01-XX

-- Add new fields for simplified bot configuration
ALTER TABLE trading_bots ADD COLUMN trading_symbols TEXT;
ALTER TABLE trading_bots ADD COLUMN ai_model TEXT;
ALTER TABLE trading_bots ADD COLUMN custom_prompt TEXT;
ALTER TABLE trading_bots ADD COLUMN max_leverage INTEGER;
ALTER TABLE trading_bots ADD COLUMN max_margin_per_trade REAL;
ALTER TABLE trading_bots ADD COLUMN max_open_trades INTEGER;

-- Make legacy fields nullable for backward compatibility
-- (SQLite doesn't support ALTER COLUMN, so we keep them as is)
-- strategy_type and trading_pair remain for legacy bots

