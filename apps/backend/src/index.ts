import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { walletAuthRoutes } from './routes/wallet-auth';
import { botsRoutes } from './routes/bots';
import { tradesRoutes } from './routes/trades';
import { marketRoutes } from './routes/market';
import { apiKeysRoutes } from './routes/apikeys';
import { benchmarksRoutes } from './routes/benchmarks';
import { paymentsRoutes } from './routes/payments';
import { botExecutionRoutes } from './routes/bot-execution';
import { botPerformanceRoutes } from './routes/bot-performance';
import { publicRoutes } from './routes/public';
import { MarketDataWebSocket } from './services/websocket';
import { handleScheduled, runScheduledExecution, type Env as ScheduledEnv } from './scheduled';

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
  APP_RUNTIME_ENV?: string;
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

  // Handle preflight requests first
  if (c.req.method === 'OPTIONS') {
    // Always allow preflight if origin is in allowed list
    if (origin && allowedOrigins.includes(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    return new Response(null, { status: 204 });
  }

  // For actual requests, proceed and add CORS headers to response
  await next();

  // Add CORS headers to response if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
});

// API Routes - These will be matched first due to run_worker_first config
app.route('/api/auth', authRoutes);
app.route('/api/auth/wallet', walletAuthRoutes);
app.route('/api/bots', botsRoutes);
app.route('/api/trades', tradesRoutes);
app.route('/api/market', marketRoutes);
app.route('/api/keys', apiKeysRoutes);
app.route('/api/benchmarks', benchmarksRoutes);
app.route('/api/payments', paymentsRoutes);
app.route('/api/bot-execution', botExecutionRoutes);
app.route('/api/bot-performance', botPerformanceRoutes);
app.route('/api/public', publicRoutes);


/**
 * Manually trigger full cron execution (development only)
 * POST /api/cron/trigger
 */
app.get('/api/cron/trigger', async (c) => {
  try {
    const runtimeEnv = (c.env.APP_RUNTIME_ENV || 'production').toLowerCase();
    if (runtimeEnv !== 'development') {
      return c.json({ success: false, error: 'Manual cron trigger is disabled outside development' }, 403);
    }

    // Ensure the request is authenticated to keep traceability in development


    const summary = await runScheduledExecution({
      DB: c.env.DB,
      ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
      PBKDF2_ITERATIONS: c.env.PBKDF2_ITERATIONS,
      APP_RUNTIME_ENV: c.env.APP_RUNTIME_ENV,
    });

    return c.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error triggering cron execution:', error);
    return c.json(
      { success: false, error: 'Failed to trigger cron execution', message: error.message },
      500
    );
  }
});

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

// Export the scheduled event handler for Cloudflare Workers
export default {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    return handleScheduled(event, env as ScheduledEnv, ctx);
  },
};

