ALTER TABLE trading_bots
ADD COLUMN min_notional_per_trade REAL;

ALTER TABLE trading_bots
ADD COLUMN max_notional_per_trade REAL;

UPDATE trading_bots
SET min_notional_per_trade = COALESCE(min_notional_per_trade, 5);

UPDATE trading_bots
SET max_notional_per_trade = COALESCE(
  max_notional_per_trade,
  CASE
    WHEN max_margin_per_trade IS NOT NULL THEN max_margin_per_trade
    ELSE 500
  END
);
