# Trading Bot Automation System

## Overview

The RobozTrade automated trading bot execution system runs AI-powered trading strategies on Aster DEX futures markets. The system executes every 2 minutes via Cloudflare Workers scheduled events (cron triggers).

## Architecture

### Core Components

1. **Scheduled Executor** (`src/scheduled.ts`)

   - Runs every 2 minutes via Cloudflare Workers cron
   - Fetches all active bots from database
   - Executes bots in parallel with error handling
   - Logs execution results

2. **Bot Executor** (`src/services/bot-executor.ts`)

   - Main orchestrator for individual bot execution
   - Fetches market data for all configured symbols
   - Calculates technical indicators
   - Calls AI for trading decisions
   - Executes trades via Aster DEX API
   - Updates database with results

3. **Market Data Service** (`src/services/aster-api.ts`)

   - Fetches real-time market data from Aster DEX
   - Gets candlestick data for technical analysis
   - Manages positions and account info
   - Places and cancels orders
   - HMAC SHA256 authentication

4. **Technical Indicators** (`src/services/indicators.ts`)

   - EMA (Exponential Moving Average)
   - MACD (Moving Average Convergence Divergence)
   - RSI (Relative Strength Index)
   - Sharpe Ratio calculation
   - Maximum Drawdown calculation
   - Profit Factor calculation

5. **AI Trading Service** (`src/services/ai-trader.ts`)
   - Uses Vercel AI SDK with OpenRouter
   - Populates custom prompt templates with real-time data
   - Parses AI responses for trading decisions
   - Calculates position sizes based on risk parameters
   - Determines stop-loss and take-profit levels

## Execution Flow

### 1. Scheduled Trigger (Every 2 Minutes)

```
Cloudflare Workers Cron → handleScheduled() → Execute All Active Bots
```

### 2. Bot Execution Cycle

```
For each active bot:
  1. Decrypt API keys (Aster, OpenRouter)
  2. Fetch account information
  3. Get current positions
  4. For each trading symbol:
     a. Fetch market data (price, OI, funding rate)
     b. Fetch candlestick data (50 candles, 15m interval)
     c. Calculate technical indicators (EMA20, MACD, RSI7)
     d. Build trading context
  5. Call AI model with populated prompt
  6. Parse AI decisions (BUY, SELL, HOLD, CLOSE)
  7. Execute trades based on decisions:
     - Check risk limits (max leverage, margin, open trades)
     - Place market orders
     - Set stop-loss and take-profit orders
     - Record trades in database
  8. Update position snapshots
  9. Update bot metrics
  10. Log execution results
```

### 3. Trade Execution

```
BUY/SELL Decision:
  1. Calculate position size based on:
     - Current price
     - Max leverage (1-10x)
     - Max margin per trade
     - Available balance
  2. Place market order with leverage
  3. Calculate risk levels (2% SL, 4% TP)
  4. Place stop-loss order
  5. Place take-profit order
  6. Record trade in database

CLOSE Decision:
  1. Find open position for symbol
  2. Place market order in opposite direction
  3. Calculate realized PnL
  4. Update trade record
  5. Update bot metrics

HOLD Decision:
  - No action taken
  - Continue monitoring
```

## Database Schema

### New Tables

#### `trade_history`

Stores all executed trades with full details:

- Entry/exit prices
- Leverage and margin
- Realized PnL
- Order IDs (entry, stop-loss, take-profit)
- AI reasoning
- Status (OPEN, CLOSED, CANCELLED)

#### `bot_executions`

Logs each bot execution cycle:

- Execution timestamp
- Symbols processed
- Market data snapshot
- AI decisions
- Trades executed
- Errors encountered
- Execution duration
- Status (SUCCESS, PARTIAL, FAILED)

#### `position_snapshots`

Tracks position state over time:

- Current price and PnL
- Liquidation price
- Stop-loss and take-profit levels
- Snapshot timestamp

#### `bot_metrics`

Aggregated performance metrics:

- Total trades (winning/losing)
- Total PnL and return
- Sharpe ratio
- Max drawdown
- Win rate
- Average win/loss
- Profit factor

## API Endpoints

### Manual Execution

```
POST /api/bot-execution/:botId/execute
```

Manually trigger bot execution (useful for testing)

### Execution History

```
GET /api/bot-execution/:botId/history?limit=50
```

Get bot execution logs

### Trade History

```
GET /api/bot-execution/:botId/trades?limit=100&status=OPEN
```

Get trade history (filter by status: OPEN, CLOSED, CANCELLED)

### Performance Metrics

```
GET /api/bot-execution/:botId/metrics
```

Get aggregated performance metrics

### Current Positions

```
GET /api/bot-execution/:botId/positions
```

Get latest position snapshots

### Rate Limit Status

```
GET /api/bot-execution/rate-limit-status
```

Get current Aster DEX API rate limit usage and status

## AI Prompt Template

### Template Variables

The system populates the following variables in custom prompts:

**Account Metrics:**

- `{{current_time}}` - Current timestamp
- `{{cycle_count}}` - Number of trading cycles
- `{{minutes_trading}}` - Minutes since bot started
- `{{available_cash}}` - Available USDT balance
- `{{account_value}}` - Total account value
- `{{total_return}}` - Total return percentage
- `{{sharpe_ratio}}` - Sharpe ratio

**Risk Parameters:**

- `{{max_leverage}}` - Maximum leverage (1-10x)
- `{{max_margin_per_trade}}` - Max margin per trade (USDT)
- `{{max_open_trades}}` - Max concurrent positions (1-5)

**Market Data (per symbol):**

- `{{symbol}}` - Trading symbol (BTC, ETH, etc.)
- `{{current_price}}` - Current market price
- `{{current_ema20}}` - 20-period EMA
- `{{current_macd}}` - MACD value
- `{{current_rsi}}` - RSI(7) value
- `{{open_interest}}` - Current open interest
- `{{funding_rate}}` - Current funding rate

**Position Data (if exists):**

- `{{position.quantity}}` - Position size
- `{{position.entry_price}}` - Entry price
- `{{position.unrealized_pnl}}` - Unrealized PnL
- `{{position.leverage}}` - Position leverage
- `{{position.liquidation_price}}` - Liquidation price

### AI Response Format

Expected JSON response from AI:

```json
{
  "decisions": [
    {
      "action": "BUY",
      "symbol": "BTCUSDT",
      "reasoning": "Strong bullish momentum with RSI at 45 and MACD crossing above signal line",
      "confidence": 0.75,
      "suggestedLeverage": 5,
      "suggestedStopLoss": 42500,
      "suggestedTakeProfit": 45000
    },
    {
      "action": "HOLD",
      "symbol": "ETHUSDT",
      "reasoning": "Neutral market conditions, waiting for clearer signal",
      "confidence": 0.5
    }
  ]
}
```

## Risk Management

### Position Sizing

```typescript
Position Size = (Max Margin × Leverage) / Current Price
```

### Risk Limits

- **Max Leverage**: 1-10x (conservative)
- **Max Margin Per Trade**: 1-100,000 USDT
- **Max Open Trades**: 1-5 concurrent positions
- **Stop Loss**: 2% from entry
- **Take Profit**: 4% from entry

### Safety Features

- Minimum confidence threshold: 0.4 (40%)
- Automatic stop-loss on all positions
- Automatic take-profit on all positions
- Position limit enforcement
- Balance checks before trading
- Error handling and logging

## Deployment

### 1. Install Dependencies

```bash
cd apps/backend
bun install
```

### 2. Run Database Migrations

```bash
bun run db:migrate:prod
```

### 3. Set Secrets

```bash
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
```

### 4. Deploy to Cloudflare Workers

```bash
bun run deploy
```

### 5. Verify Cron Trigger

Check Cloudflare dashboard → Workers → Triggers → Cron Triggers
Should show: `*/2 * * * *` (every 2 minutes)

## Monitoring

### Logs

View execution logs in Cloudflare dashboard:

```
Workers → roboz-trade → Logs
```

### Metrics

Monitor via API endpoints:

- Execution success rate
- Trades per cycle
- Average execution duration
- Error frequency

### Alerts

Set up alerts for:

- Failed executions
- High error rates
- Unusual trading activity
- Low account balance
- Rate limit approaching (>70% usage)

## Rate Limiting

### Aster DEX API Limits

The system implements comprehensive rate limiting to respect Aster DEX API constraints:

**Official Limits:**

- **REQUEST_WEIGHT**: 2400 requests per minute
- **ORDERS**: 1200 orders per minute
- **ORDERS**: 300 orders per 10 seconds

**Safety Margins:**

- System uses 80% of official limits to prevent hitting hard limits
- Effective limits: 1920 requests/min, 960 orders/min, 240 orders/10s

### Rate Limiter Features

1. **Automatic Throttling**

   - Waits for available slots before making requests
   - Separate tracking for regular requests vs order requests
   - Rolling time windows (1 minute and 10 seconds)

2. **Request Classification**

   - Market data requests: Regular rate limit
   - Order placement/cancellation: Stricter order rate limit
   - Automatic detection and appropriate limiting

3. **Monitoring**

   - Real-time rate limit status via `/api/bot-execution/rate-limit-status`
   - Logged after each scheduled execution
   - Percentage usage tracking

4. **Error Handling**
   - Detects 429 (rate limit) errors
   - Automatic reset and retry logic
   - Prevents cascading failures

### Best Practices

1. **Bot Configuration**

   - Limit number of active bots to prevent rate limit exhaustion
   - Each symbol requires 2-3 API calls per execution
   - 5 symbols × 10 bots = 100-150 requests per cycle

2. **Order Management**

   - Each trade requires 3-4 order API calls (entry, SL, TP)
   - Conservative: Max 50-100 trades per minute across all bots
   - System automatically queues orders if limits approached

3. **Monitoring**
   - Check rate limit status regularly
   - Alert if usage exceeds 70%
   - Consider increasing cron interval if hitting limits

## Testing

### Manual Execution

```bash
curl -X POST https://roboz.trade/api/bot-execution/{botId}/execute \
  -H "Authorization: Bearer {token}"
```

### Local Development

```bash
# Run locally with wrangler
bun run dev

# Trigger scheduled event manually
curl http://localhost:8787/__scheduled
```

## Performance Optimization

### Parallel Execution

- All active bots execute in parallel
- Market data fetched concurrently
- Independent error handling per bot

### Caching

- Consider caching market data for 1-2 minutes
- Reuse technical indicator calculations

### Rate Limiting

- Respect Aster DEX API rate limits
- Implement exponential backoff on errors
- Queue trades if needed

## Troubleshooting

### Bot Not Executing

1. Check bot status is 'active'
2. Verify cron trigger is configured
3. Check Cloudflare Workers logs
4. Verify API keys are encrypted correctly

### Trades Not Executing

1. Check AI confidence threshold (>0.4)
2. Verify risk limits not exceeded
3. Check account balance
4. Review Aster DEX API errors

### AI Errors

1. Verify OpenRouter API key
2. Check AI model availability
3. Review prompt template syntax
4. Check token limits

## Future Enhancements

- [ ] Backtesting engine
- [ ] Paper trading mode
- [ ] Advanced risk management strategies
- [ ] Multi-timeframe analysis
- [ ] Sentiment analysis integration
- [ ] Portfolio rebalancing
- [ ] Telegram/Discord notifications
- [ ] Performance dashboards
- [ ] A/B testing different AI models
- [ ] Custom indicator plugins
