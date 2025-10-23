# Trading Bot Form Improvements

## Summary of Changes

This document outlines the improvements made to the Create Trading Bot form, including enhanced styling, comprehensive validations, and new AI-powered features.

## 1. Form Structure Changes

### Removed Fields
- ❌ **Trading Pair** (text input) - Replaced with multi-select trading symbols
- ❌ **Strategy Type** (dropdown) - Removed as AI handles strategy
- ❌ **Profit Factor Threshold** - Simplified risk management
- ❌ **Max Position Size** - Consolidated into margin per trade
- ❌ **Stop Loss %** - AI determines dynamically
- ❌ **Take Profit %** - AI determines dynamically
- ❌ **Max Daily Loss** - Simplified to per-trade limits

### New Fields
- ✅ **Trading Symbols** (multi-select checkboxes) - Select 1-10 symbols from supported list
- ✅ **AI Model** (dropdown) - Choose from 13 supported AI models
- ✅ **Custom Prompt Template** (textarea) - Customize AI trading instructions with template variables
- ✅ **Max Leverage** (1-125x) - Enhanced with validation
- ✅ **Max Margin Per Trade** (USDT) - Clearer naming and validation
- ✅ **Max Open Trades** (1-50) - Enhanced with validation

## 2. Supported Trading Symbols

All symbols use **USDT as margin asset**:

- BTCUSDT (Bitcoin)
- ETHUSDT (Ethereum)
- BNBUSDT (Binance Coin)
- SOLUSDT (Solana)
- XRPUSDT (Ripple)
- DOGEUSDT (Dogecoin)
- ADAUSDT (Cardano)
- MATICUSDT (Polygon)
- DOTUSDT (Polkadot)
- AVAXUSDT (Avalanche)
- LINKUSDT (Chainlink)
- UNIUSDT (Uniswap)
- ATOMUSDT (Cosmos)
- LTCUSDT (Litecoin)
- NEARUSDT (NEAR Protocol)
- APTUSDT (Aptos)
- ARBUSDT (Arbitrum)
- OPUSDT (Optimism)

## 3. Supported AI Models

### OpenAI Models
- **GPT-4o** - Latest OpenAI model, fast and capable
- **GPT-4o Mini** - Faster, more affordable GPT-4o
- **GPT-4 Turbo** - Previous generation flagship

### Anthropic Models
- **Claude 3.5 Sonnet** - Best for complex reasoning (default)
- **Claude 3 Opus** - Most capable Claude model
- **Claude 3 Haiku** - Fast and affordable

### Google Models
- **Gemini Pro 1.5** - Google's advanced model
- **Gemini Flash 1.5** - Fast Google model

### Open Source Models
- **Llama 3.1 405B** - Largest open-source model
- **Llama 3.1 70B** - Balanced open-source model

### Other Models
- **Grok Beta** - xAI's conversational model
- **DeepSeek Chat** - Efficient reasoning model
- **Qwen 2.5 72B** - Alibaba's advanced model

## 4. Custom Prompt Template

### Default Template Structure
The default prompt includes:
- Current time and trading session info
- Account performance metrics
- Market data for each symbol (price, indicators, positions)
- Trading instructions and risk limits

### Available Template Variables

#### Account & Performance
- `{{current_time}}` - Current timestamp
- `{{cycle_count}}` - Number of trading cycles executed
- `{{minutes_trading}}` - Minutes since bot started
- `{{available_cash}}` - Available USDT balance
- `{{account_value}}` - Total account value in USDT
- `{{total_return}}` - Total return percentage
- `{{sharpe_ratio}}` - Sharpe ratio of the strategy

#### Risk Parameters
- `{{max_leverage}}` - Maximum allowed leverage
- `{{max_margin_per_trade}}` - Maximum margin per trade in USDT
- `{{max_open_trades}}` - Maximum number of open positions

#### Market Data (per symbol)
- `{{symbol}}` - Trading symbol (e.g., BTC, ETH)
- `{{current_price}}` - Current market price
- `{{current_ema20}}` - Current 20-period EMA
- `{{current_macd}}` - Current MACD value
- `{{current_rsi}}` - Current RSI(7) value
- `{{open_interest}}` - Current open interest
- `{{funding_rate}}` - Current funding rate

#### Position Data (if position exists)
- `{{position.quantity}}` - Current position quantity
- `{{position.entry_price}}` - Position entry price
- `{{position.unrealized_pnl}}` - Unrealized profit/loss
- `{{position.leverage}}` - Position leverage
- `{{position.stop_loss}}` - Position stop loss price
- `{{position.profit_target}}` - Position take profit price

## 5. Frontend Validations

### Bot Name
- Required field
- Maximum 100 characters
- Real-time validation

### API Keys
- All three API keys required (Aster API Key, Aster API Secret, OpenRouter API Key)
- Password input type for security
- Link to OpenRouter for API key generation

### Trading Symbols
- Minimum 1 symbol required
- Maximum 10 symbols allowed
- Visual checkbox grid with hover effects
- Shows selected count

### AI Model
- Required field
- Dropdown with model descriptions
- Default: Claude 3.5 Sonnet

### Risk Management
- **Max Leverage**: 1-125, required
- **Max Margin Per Trade**: 1-100,000 USDT, required
- **Max Open Trades**: 1-50, required
- Real-time validation on input

### Custom Prompt
- Optional field
- Maximum 10,000 characters
- Collapsible variable reference panel
- Monospace font for better readability

## 6. Backend Validations

### Schema Validation (Zod)
```typescript
{
  paymentTxHash: /^0x[a-fA-F0-9]{64}$/,
  asterApiKey: min 1 char,
  asterApiSecret: min 1 char,
  openRouterApiKey: min 1 char,
  name: 1-100 chars,
  tradingSymbols: 1-10 symbols from supported list,
  aiModel: must be from supported models list,
  customPrompt: max 10,000 chars (optional),
  maxLeverage: 1-125,
  maxMarginPerTrade: 1-100,000,
  maxOpenTrades: 1-50
}
```

### Error Messages
- Clear, user-friendly error messages
- Field-specific validation errors
- Payment verification before bot creation

## 7. Database Schema Updates

### New Columns in `trading_bots` table
- `trading_symbols` (TEXT, JSON) - Array of trading symbols
- `ai_model` (TEXT) - Selected AI model
- `custom_prompt` (TEXT) - Custom prompt template
- `max_leverage` (INTEGER) - Maximum leverage
- `max_margin_per_trade` (REAL) - Maximum margin per trade
- `max_open_trades` (INTEGER) - Maximum open trades

### Legacy Columns (kept for backward compatibility)
- `strategy_type` - Now nullable
- `trading_pair` - Now nullable
- `config` - Now nullable
- `risk_config` - Now nullable

## 8. UI/UX Improvements

### Visual Enhancements
- ✨ Card-based layout with clear sections
- 🎨 Improved color scheme and contrast
- 📱 Responsive grid layouts
- 🔘 Interactive checkbox grid for symbols
- 💡 Helpful tooltips and descriptions
- 📊 Clean review summary before creation

### User Experience
- Step-by-step wizard (Wallet → Payment → Config → Review)
- Progress indicators
- Clear validation feedback
- Collapsible sections for advanced options
- Variable reference panel for prompt customization
- Loading states and error handling

### Accessibility
- Proper label associations
- Required field indicators (*)
- Descriptive placeholder text
- Keyboard navigation support
- Screen reader friendly

## 9. Migration Guide

### For Existing Bots
- Legacy bots continue to work with old schema
- New bots use simplified configuration
- Both schemas supported simultaneously

### For Developers
1. Run database migration: `0003_add_bot_ai_fields.sql`
2. Update shared types package
3. Deploy backend changes
4. Deploy frontend changes

## 10. Testing Checklist

- [ ] Form validation (all fields)
- [ ] Symbol selection (min/max limits)
- [ ] AI model selection
- [ ] Custom prompt with variables
- [ ] Risk parameter validation
- [ ] Payment verification
- [ ] Bot creation success
- [ ] Error handling
- [ ] Responsive design
- [ ] Cross-browser compatibility

## 11. Future Enhancements

- [ ] Prompt template library
- [ ] Backtesting with selected symbols
- [ ] Performance comparison between AI models
- [ ] Symbol recommendation based on market conditions
- [ ] Advanced risk management presets
- [ ] Multi-language support for prompts

