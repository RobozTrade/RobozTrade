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
import { handleScheduled, runScheduledExecution, cleanupOldBotExecutions, type Env as ScheduledEnv } from './scheduled';
import { createDailyXPosts, getDailyBotPerformance } from './services/x-twitter-poster';
import { getDb } from './lib/db';

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

  // X/Twitter API configuration (secrets)
  TWITTER_API_KEY?: string;
  TWITTER_API_SECRET?: string;
  TWITTER_ACCESS_TOKEN?: string;
  TWITTER_ACCESS_TOKEN_SECRET?: string;
  OPENROUTER_API_KEY?: string;  // For X/Twitter posting (can be separate from bot keys)
  GOOGLE_API_KEY?: string;  // For Google Gemini/Imagen API image generation
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

/**
 * Manually trigger bot execution cleanup (development only)
 * POST /api/cron/cleanup
 */
app.get('/api/cron/cleanup', async (c) => {
  try {
    const runtimeEnv = (c.env.APP_RUNTIME_ENV || 'production').toLowerCase();
    if (runtimeEnv !== 'development') {
      return c.json({ success: false, error: 'Manual cleanup trigger is disabled outside development' }, 403);
    }

    const result = await cleanupOldBotExecutions({
      DB: c.env.DB,
      ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
      PBKDF2_ITERATIONS: c.env.PBKDF2_ITERATIONS,
      APP_RUNTIME_ENV: c.env.APP_RUNTIME_ENV,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error triggering cleanup:', error);
    return c.json(
      { success: false, error: 'Failed to trigger cleanup', message: error.message },
      500
    );
  }
});

/**
 * Test X/Twitter posting endpoint (development only)
 * GET /api/test/x-post
 * Tests the daily X/Twitter posting functionality with detailed logging and error reporting
 */
app.get('/api/test/x-post', async (c) => {
  try {
    const runtimeEnv = (c.env.APP_RUNTIME_ENV || 'production').toLowerCase();
    console.log('[X-TEST] Environment check:', { runtimeEnv, required: 'development' });

    if (runtimeEnv !== 'development') {
      console.log('[X-TEST] Access denied - not in development mode');
      return c.json({
        success: false,
        error: 'Test endpoint is disabled outside development',
        runtimeEnv,
      }, 403);
    }

    console.log('[X-TEST] Starting X/Twitter posting test...');

    // Check for required API keys
    const requiredKeys = {
      TWITTER_API_KEY: c.env.TWITTER_API_KEY ? '***SET***' : 'MISSING',
      TWITTER_API_SECRET: c.env.TWITTER_API_SECRET ? '***SET***' : 'MISSING',
      TWITTER_ACCESS_TOKEN: c.env.TWITTER_ACCESS_TOKEN ? '***SET***' : 'MISSING',
      TWITTER_ACCESS_TOKEN_SECRET: c.env.TWITTER_ACCESS_TOKEN_SECRET ? '***SET***' : 'MISSING',
      OPENROUTER_API_KEY: c.env.OPENROUTER_API_KEY ? '***SET***' : 'MISSING',
      GOOGLE_API_KEY: c.env.GOOGLE_API_KEY ? '***SET***' : 'MISSING',
    };

    console.log('[X-TEST] API Keys status:', requiredKeys);

    if (
      !c.env.TWITTER_API_KEY ||
      !c.env.TWITTER_API_SECRET ||
      !c.env.TWITTER_ACCESS_TOKEN ||
      !c.env.TWITTER_ACCESS_TOKEN_SECRET ||
      !c.env.OPENROUTER_API_KEY ||
      !c.env.GOOGLE_API_KEY
    ) {
      console.error('[X-TEST] Missing required API keys');
      return c.json({
        success: false,
        error: 'Missing required API keys',
        apiKeysStatus: requiredKeys,
      }, 400);
    }

    // Get database and configuration
    const db = getDb(c.env.DB);
    const iterations = parseInt(c.env.PBKDF2_ITERATIONS || '100000', 10);

    console.log('[X-TEST] Configuration:', {
      pbkdf2Iterations: iterations,
      hasDb: !!db,
    });

    // Step 1: Get daily bot performance
    console.log('[X-TEST] Step 1: Fetching daily bot performance...');
    let botPerformance: any = null;
    let botPerformanceError: any = null;

    try {
      botPerformance = await getDailyBotPerformance(
        db,
        c.env.ENCRYPTION_KEY,
        iterations
      );
      console.log('[X-TEST] Bot performance data:', {
        topBot: botPerformance.topBot ? {
          botId: botPerformance.topBot.botId,
          botName: botPerformance.topBot.botName,
          aiModel: botPerformance.topBot.aiModel,
          dailyReturn: botPerformance.topBot.dailyReturn,
          totalBalance: botPerformance.topBot.totalBalance,
          tradesExecuted: botPerformance.topBot.tradesExecuted,
        } : null,
        leastBot: botPerformance.leastBot ? {
          botId: botPerformance.leastBot.botId,
          botName: botPerformance.leastBot.botName,
          aiModel: botPerformance.leastBot.aiModel,
          dailyReturn: botPerformance.leastBot.dailyReturn,
          totalBalance: botPerformance.leastBot.totalBalance,
          tradesExecuted: botPerformance.leastBot.tradesExecuted,
        } : null,
      });
    } catch (error: any) {
      botPerformanceError = error;
      console.error('[X-TEST] Error fetching bot performance:', error);
    }

    // Step 2: Create and post X/Twitter posts
    console.log('[X-TEST] Step 2: Creating and posting X/Twitter posts...');
    let xPostResults: any = null;
    let xPostError: any = null;

    try {
      xPostResults = await createDailyXPosts(
        db,
        c.env.ENCRYPTION_KEY,
        iterations,
        c.env.OPENROUTER_API_KEY,
        c.env.GOOGLE_API_KEY,
        c.env.TWITTER_API_KEY,
        c.env.TWITTER_API_SECRET,
        c.env.TWITTER_ACCESS_TOKEN,
        c.env.TWITTER_ACCESS_TOKEN_SECRET
      );
      console.log('[X-TEST] X/Twitter posting results:', xPostResults);
    } catch (error: any) {
      xPostError = error;
      console.error('[X-TEST] Error in X/Twitter posting:', error);
    }

    // Compile comprehensive response
    const response = {
      success: !botPerformanceError && !xPostError && xPostResults !== null,
      timestamp: new Date().toISOString(),
      environment: {
        runtimeEnv,
        pbkdf2Iterations: iterations,
      },
      apiKeysStatus: requiredKeys,
      botPerformance: botPerformance
        ? {
          topBot: botPerformance.topBot,
          leastBot: botPerformance.leastBot,
          error: null,
        }
        : {
          topBot: null,
          leastBot: null,
          error: botPerformanceError ? {
            message: botPerformanceError.message,
            stack: botPerformanceError.stack,
          } : null,
        },
      xPostResults: xPostResults
        ? {
          topBotPost: xPostResults.topBotPost,
          leastBotPost: xPostResults.leastBotPost,
          error: null,
        }
        : null,
      errors: {
        botPerformanceError: botPerformanceError
          ? {
            message: botPerformanceError.message,
            stack: botPerformanceError.stack,
            name: botPerformanceError.name,
          }
          : null,
        xPostError: xPostError
          ? {
            message: xPostError.message,
            stack: xPostError.stack,
            name: xPostError.name,
          }
          : null,
      },
      summary: {
        botPerformanceFetched: !!botPerformance,
        topBotFound: !!botPerformance?.topBot,
        leastBotFound: !!botPerformance?.leastBot,
        topBotPosted: xPostResults?.topBotPost?.success || false,
        leastBotPosted: xPostResults?.leastBotPost?.success || false,
        topBotTweetId: xPostResults?.topBotPost?.tweetId || null,
        leastBotTweetId: xPostResults?.leastBotPost?.tweetId || null,
      },
    };

    console.log('[X-TEST] Complete response summary:', {
      success: response.success,
      summary: response.summary,
      hasErrors: !!(response.errors.botPerformanceError || response.errors.xPostError),
    });

    return c.json(response, response.success ? 200 : 500);
  } catch (error: any) {
    console.error('[X-TEST] Fatal error:', error);
    return c.json({
      success: false,
      error: 'Fatal error in test endpoint',
      message: error.message,
      stack: error.stack,
      name: error.name,
    }, 500);
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

