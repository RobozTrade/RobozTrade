import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { trades, tradingBots } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';

export const tradesRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

tradesRoutes.use('/*', authMiddleware);

// Get all trades for a bot
tradesRoutes.get('/bot/:botId', async (c) => {
  const userId = getUserId(c);
  const botId = c.req.param('botId');
  const db = getDb(c.env.DB);

  try {
    // Verify bot belongs to user
    const bot = await db.query.tradingBots.findFirst({
      where: and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)),
    });

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    const botTrades = await db.query.trades.findMany({
      where: eq(trades.botId, botId),
      orderBy: [desc(trades.executedAt)],
    });

    return c.json({ success: true, data: botTrades });
  } catch (error) {
    console.error('Get trades error:', error);
    return c.json({ success: false, error: 'Failed to get trades' }, 500);
  }
});

// Get all trades for user
tradesRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const db = getDb(c.env.DB);

  try {
    // Get all user's bots
    const userBots = await db.query.tradingBots.findMany({
      where: eq(tradingBots.userId, userId),
    });

    const botIds = userBots.map((bot) => bot.id);

    if (botIds.length === 0) {
      return c.json({ success: true, data: [] });
    }

    // Get trades for all bots
    const allTrades = await db.query.trades.findMany({
      orderBy: [desc(trades.executedAt)],
    });

    const userTrades = allTrades.filter((trade) => botIds.includes(trade.botId));

    return c.json({ success: true, data: userTrades });
  } catch (error) {
    console.error('Get all trades error:', error);
    return c.json({ success: false, error: 'Failed to get trades' }, 500);
  }
});

// Get single trade
tradesRoutes.get('/:id', async (c) => {
  const userId = getUserId(c);
  const tradeId = c.req.param('id');
  const db = getDb(c.env.DB);

  try {
    const trade = await db.query.trades.findFirst({
      where: eq(trades.id, tradeId),
    });

    if (!trade) {
      return c.json({ success: false, error: 'Trade not found' }, 404);
    }

    // Verify trade belongs to user's bot
    const bot = await db.query.tradingBots.findFirst({
      where: and(eq(tradingBots.id, trade.botId), eq(tradingBots.userId, userId)),
    });

    if (!bot) {
      return c.json({ success: false, error: 'Unauthorized' }, 403);
    }

    return c.json({ success: true, data: trade });
  } catch (error) {
    console.error('Get trade error:', error);
    return c.json({ success: false, error: 'Failed to get trade' }, 500);
  }
});

