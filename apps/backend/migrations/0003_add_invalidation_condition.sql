-- Migration: Add invalidation_condition column to trade_history table
-- This field stores the market conditions that would invalidate the position thesis

ALTER TABLE trade_history ADD COLUMN invalidation_condition TEXT;

