import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { botsRoutes } from './routes/bots';
import { tradesRoutes } from './routes/trades';
import { marketRoutes } from './routes/market';
import { apiKeysRoutes } from './routes/apikeys';
import { benchmarksRoutes } from './routes/benchmarks';
import { paymentsRoutes } from './routes/payments';
import { MarketDataWebSocket } from './services/websocket';

export { MarketDataWebSocket };

type Bindings = {
  // Database and Durable Objects
  DB: D1Database;
  MARKET_WS: DurableObjectNamespace;
  ASSETS: Fetcher;  // Assets binding for serving static frontend

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;  // For encrypting API keys

  // Public configuration (can be in wrangler.toml [vars])
  ASTER_API_BASE_URL?: string;
  CORS_ALLOWED_ORIGINS?: string;  // Comma-separated list of allowed origins

  // Blockchain configuration
  BSC_RPC_URL?: string;
  USDT_CONTRACT_ADDRESS?: string;
  PAYMENT_RECIPIENT_ADDRESS?: string;
  REQUIRED_PAYMENT_AMOUNT?: string;  // In USDT
  MIN_CONFIRMATIONS?: string;  // Number as string

  // Rate limiting
  RATE_LIMIT_WINDOW_MS?: string;  // Number as string
  RATE_LIMIT_MAX_REQUESTS?: string;  // Number as string

  // Crypto configuration
  PBKDF2_ITERATIONS?: string;  // Number as string
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());

// CORS - Configurable via environment variable
app.use('*', async (c, next) => {
  // Get allowed origins from environment variable or use defaults
  const allowedOriginsStr = c.env.CORS_ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000,https://roboz-trade.workers.dev';

  const allowedOrigins = allowedOriginsStr.split(',').map((o: string) => o.trim());

  const origin = c.req.header('Origin');

  // Allow requests with no origin (like mobile apps or curl) or if origin is in allowed list
  if (!origin || allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin || '*');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  await next();
});

// API Routes - These will be matched first due to run_worker_first config
app.route('/api/auth', authRoutes);
app.route('/api/bots', botsRoutes);
app.route('/api/trades', tradesRoutes);
app.route('/api/market', marketRoutes);
app.route('/api/keys', apiKeysRoutes);
app.route('/api/benchmarks', benchmarksRoutes);
app.route('/api/payments', paymentsRoutes);

// WebSocket endpoint
app.get('/ws', async (c) => {
  const id = c.env.MARKET_WS.idFromName('market-data');
  const stub = c.env.MARKET_WS.get(id);
  return stub.fetch(c.req.raw);
});

// Fallback to static assets for all other routes
// This handles the React SPA and all static files (HTML, CSS, JS, images)
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json(
    {
      success: false,
      error: 'Internal server error',
      message: err.message,
    },
    500
  );
});

export default app;

