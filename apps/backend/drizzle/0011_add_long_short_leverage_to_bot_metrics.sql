-- Migration: Add long/short trade statistics and average leverage to bot_metrics
-- Created: 2025-01-XX

-- Add new columns to bot_metrics table
ALTER TABLE bot_metrics ADD COLUMN long_trades INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bot_metrics ADD COLUMN short_trades INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bot_metrics ADD COLUMN average_leverage REAL;

