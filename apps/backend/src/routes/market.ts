import { Hono } from 'hono';
import { AsterAPI } from '../services/aster';

export const marketRoutes = new Hono<{ Bindings: { ASTER_API_BASE_URL?: string } }>();

// Public routes - no auth required for market data

// Get price for a symbol
marketRoutes.get('/price/:symbol', async (c) => {
  const symbol = c.req.param('symbol');
  const baseURL = c.env.ASTER_API_BASE_URL || 'https://fapi.asterdex.com';

  try {
    // Use public API without credentials
    const aster = new AsterAPI('', '', baseURL);
    const data = await aster.getPrice(symbol);
    return c.json({ success: true, data });
  } catch (error) {
    console.error('Get price error:', error);
    return c.json({ success: false, error: 'Failed to get price' }, 500);
  }
});

// Get 24hr ticker
marketRoutes.get('/ticker/:symbol', async (c) => {
  const symbol = c.req.param('symbol');
  const baseURL = c.env.ASTER_API_BASE_URL || 'https://fapi.asterdex.com';

  try {
    const aster = new AsterAPI('', '', baseURL);
    const data = await aster.get24hrTicker(symbol);
    return c.json({ success: true, data });
  } catch (error) {
    console.error('Get ticker error:', error);
    return c.json({ success: false, error: 'Failed to get ticker' }, 500);
  }
});

// Get klines/candlestick data
marketRoutes.get('/klines', async (c) => {
  const symbol = c.req.query('symbol');
  const interval = c.req.query('interval') || '1h';
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 100;
  const baseURL = c.env.ASTER_API_BASE_URL || 'https://fapi.asterdex.com';

  if (!symbol) {
    return c.json({ success: false, error: 'Symbol is required' }, 400);
  }

  try {
    const aster = new AsterAPI('', '', baseURL);
    const data = await aster.getKlines({ symbol, interval, limit });
    return c.json({ success: true, data });
  } catch (error) {
    console.error('Get klines error:', error);
    return c.json({ success: false, error: 'Failed to get klines' }, 500);
  }
});

