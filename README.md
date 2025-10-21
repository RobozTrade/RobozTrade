# ROBOZ TRADE - AI Trading Platform

A comprehensive AI-powered trading platform with Aster DEX API integration, built with modern web technologies.

## 🚀 Features

- **User Authentication**: Secure email/password authentication with JWT
- **Trading Bots**: Create and manage automated trading bots with multiple strategies
  - Moving Average Cross
  - RSI (Relative Strength Index)
  - Bollinger Bands
  - Custom strategies
- **Real-time Market Data**: Live price updates via WebSocket
- **Trading Charts**: Interactive candlestick charts with Lightweight Charts
- **Performance Analytics**: Comprehensive trading performance metrics
- **Benchmark Testing**: Test strategies against different market scenarios
- **API Key Management**: Secure encrypted storage of exchange API keys
- **Dark Theme**: Beautiful, responsive dark-themed UI

## 🛠️ Tech Stack

### Frontend

- **Runtime**: Bun
- **Framework**: React 19 + TypeScript 5.7
- **Build Tool**: Vite 6
- **Styling**: TailwindCSS 3.4
- **State Management**: Zustand 5
- **Data Fetching**: TanStack Query 5
- **Routing**: React Router 7
- **Charts**: Lightweight Charts 4.2
- **Icons**: Lucide React

### Backend

- **Runtime**: Cloudflare Workers
- **Framework**: Hono 4
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM 0.38
- **Real-time**: WebSocket (Durable Objects)
- **Authentication**: JWT
- **Validation**: Zod 3.24

### Monorepo

- **Package Manager**: Bun Workspaces
- **Structure**: Apps + Packages

> 📦 **All packages updated to latest versions (January 2025)**. See [PACKAGE_VERSIONS.md](PACKAGE_VERSIONS.md) for detailed version information and migration notes.

## 📁 Project Structure

```
/roboz-trade
├── /apps
│   ├── /frontend          # React frontend application
│   │   ├── /src
│   │   │   ├── /components    # Reusable UI components
│   │   │   ├── /features      # Feature-based modules
│   │   │   ├── /hooks         # Custom React hooks
│   │   │   ├── /stores        # Zustand stores
│   │   │   └── /lib           # Utilities and API client
│   │   └── package.json
│   └── /backend           # Hono backend API
│       ├── /src
│       │   ├── /routes        # API route handlers
│       │   ├── /db            # Database schema
│       │   ├── /services      # Business logic
│       │   ├── /middleware    # Auth, rate limiting
│       │   └── /lib           # Utilities
│       └── package.json
├── /packages
│   └── /shared-types      # Shared TypeScript types
└── package.json           # Root workspace config
```

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd RobozTrade
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   Frontend:

   ```bash
   cd apps/frontend
   cp .env.example .env
   ```

   Backend:

   ```bash
   cd apps/backend
   cp .dev.vars.example .dev.vars
   ```

   Edit the `.dev.vars` file and set your JWT secret:

   ```
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   ```

4. **Create Cloudflare D1 Database**

   ```bash
   cd apps/backend
   bunx wrangler d1 create roboz-trade
   ```

   Copy the database ID from the output and update `wrangler.toml`:

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "roboz-trade"
   database_id = "your-database-id-here"
   ```

5. **Generate and run database migrations**
   ```bash
   bun run db:generate
   bunx wrangler d1 migrations apply roboz-trade --local
   ```

### Development

Run both frontend and backend in development mode:

```bash
# From root directory
bun run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend
cd apps/backend
bun run dev

# Terminal 2 - Frontend
cd apps/frontend
bun run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8787

## 🗄️ Database Schema

The application uses the following main tables:

- **users**: User accounts and authentication
- **api_keys**: Encrypted exchange API credentials
- **trading_bots**: Bot configurations and strategies
- **trades**: Trade execution history
- **benchmark_tests**: Strategy backtesting results

## 🔐 API Endpoints

### Authentication

- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login and get JWT token

### Trading Bots

- `GET /api/bots` - List all user's bots
- `GET /api/bots/:id` - Get bot details
- `POST /api/bots` - Create new bot
- `PATCH /api/bots/:id` - Update bot
- `DELETE /api/bots/:id` - Delete bot

### Trades

- `GET /api/trades` - Get all trades
- `GET /api/trades/bot/:botId` - Get trades for specific bot

### Market Data

- `GET /api/market/price/:symbol` - Get current price
- `GET /api/market/ticker/:symbol` - Get 24hr ticker data
- `GET /api/market/klines` - Get candlestick data

### API Keys

- `GET /api/keys` - List API keys
- `POST /api/keys` - Add new API key
- `PATCH /api/keys/:id/toggle` - Toggle key active status
- `DELETE /api/keys/:id` - Delete API key

### Benchmarks

- `GET /api/benchmarks` - List benchmarks
- `POST /api/benchmarks` - Create benchmark test

### WebSocket

- `WS /ws` - Real-time market data stream

## 🚢 Deployment

### Deploy to Cloudflare Workers

1. **Build the application**

   ```bash
   bun run build
   ```

2. **Run database migrations on production**

   ```bash
   cd apps/backend
   bunx wrangler d1 migrations apply roboz-trade
   ```

3. **Deploy backend**

   ```bash
   cd apps/backend
   bunx wrangler deploy
   ```

4. **Deploy frontend**

   Build the frontend and deploy to your preferred hosting service (Cloudflare Pages, Vercel, Netlify, etc.)

   ```bash
   cd apps/frontend
   bun run build
   # Deploy the dist/ folder
   ```

### Environment Variables for Production

Make sure to set these in your Cloudflare Workers settings:

- `JWT_SECRET`: Strong secret key for JWT signing
- `ASTER_API_BASE_URL`: Aster DEX API base URL

## 🔧 Configuration

### Aster DEX API

To use the trading features, you need to:

1. Create an account on [Aster DEX](https://asterdex.com)
2. Generate API keys from your account settings
3. Add the API keys in the Settings page of the application
4. API keys are encrypted before storage using AES-GCM

### Trading Strategies

The platform supports multiple trading strategies:

1. **Moving Average Cross**: Buy when short MA crosses above long MA, sell when it crosses below
2. **RSI**: Buy when RSI is oversold, sell when overbought
3. **Bollinger Bands**: Trade based on price touching upper/lower bands
4. **Custom**: Define your own trading logic

## 📊 Features in Detail

### Real-time Market Data

The application uses WebSocket connections to receive real-time market data from Aster DEX. The WebSocket service is implemented as a Cloudflare Durable Object for scalability.

### Encrypted API Keys

All exchange API keys are encrypted using AES-GCM encryption before being stored in the database. The encryption key is derived from your JWT secret using PBKDF2.

### Performance Analytics

Track your trading performance with comprehensive metrics:

- Win rate
- Profit factor
- Total P&L
- Average trade performance
- Trade distribution

## 🧪 Testing

```bash
# Run type checking
bun run type-check

# Build all packages
bun run build
```

## 📝 License

MIT License - feel free to use this project for your own purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### For AI-Assisted Development

This project includes **GitHub Copilot instructions** to help maintain code consistency and quality:

- **Location**: `.github/copilot-instructions.md`
- **Purpose**: Guides AI-assisted development with project-specific patterns
- **Includes**: Design system, component guidelines, code style, best practices

When using GitHub Copilot, it will automatically follow these instructions to provide suggestions that match the project's liquid-glass design system and coding standards.

## ⚠️ Disclaimer

This is a trading platform for educational purposes. Always do your own research and never invest more than you can afford to lose. Cryptocurrency trading carries significant risk.
