-- Migration: Add performance tracking metrics to bot_executions table
-- Add total_balance and unrealized_pnl columns for performance tracking

ALTER TABLE bot_executions ADD COLUMN total_balance REAL;
ALTER TABLE bot_executions ADD COLUMN unrealized_pnl REAL;

