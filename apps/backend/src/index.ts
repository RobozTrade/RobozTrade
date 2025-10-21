import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { botsRoutes } from './routes/bots';
import { tradesRoutes } from './routes/trades';
import { marketRoutes } from './routes/market';
import { apiKeysRoutes } from './routes/apikeys';
import { benchmarksRoutes } from './routes/benchmarks';
import { MarketDataWebSocket } from './services/websocket';

export { MarketDataWebSocket };

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  ASTER_API_BASE_URL?: string;
  MARKET_WS: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

// Health check
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'RobozTrade API',
    version: '1.0.0',
  });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/bots', botsRoutes);
app.route('/api/trades', tradesRoutes);
app.route('/api/market', marketRoutes);
app.route('/api/keys', apiKeysRoutes);
app.route('/api/benchmarks', benchmarksRoutes);

// WebSocket endpoint
app.get('/ws', async (c) => {
  const id = c.env.MARKET_WS.idFromName('market-data');
  const stub = c.env.MARKET_WS.get(id);
  return stub.fetch(c.req.raw);
});

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
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

