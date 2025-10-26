import { Hono } from 'hono';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { tradeHistory, tradingBots } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';

export const tradesRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

tradesRoutes.use('/*', authMiddleware);

// Get all trades for a bot
tradesRoutes.get('/bot/:botId', async (c) => {
  const userId = getUserId(c);
  const botId = c.req.param('botId');
  const limit = parseInt(c.req.query('limit') || '200');
  const db = getDb(c.env.DB);

  try {
    // Verify bot belongs to user
    const bot = await db.query.tradingBots.findFirst({
      where: and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)),
    });

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    // Get trades from tradeHistory table with bot name
    const botTrades = await db
      .select({
        id: tradeHistory.id,
        botId: tradeHistory.botId,
        botName: tradingBots.name,
        symbol: tradeHistory.symbol,
        side: tradeHistory.side,
        orderType: tradeHistory.orderType,
        quantity: tradeHistory.quantity,
        entryPrice: tradeHistory.entryPrice,
        exitPrice: tradeHistory.exitPrice,
        leverage: tradeHistory.leverage,
        margin: tradeHistory.margin,
        realizedPnl: tradeHistory.realizedPnl,
        fees: tradeHistory.fees,
        orderId: tradeHistory.orderId,
        stopLossOrderId: tradeHistory.stopLossOrderId,
        takeProfitOrderId: tradeHistory.takeProfitOrderId,
        aiReasoning: tradeHistory.aiReasoning,
        status: tradeHistory.status,
        openedAt: tradeHistory.openedAt,
        closedAt: tradeHistory.closedAt,
      })
      .from(tradeHistory)
      .leftJoin(tradingBots, eq(tradeHistory.botId, tradingBots.id))
      .where(eq(tradeHistory.botId, botId))
      .orderBy(desc(tradeHistory.openedAt))
      .limit(limit)
      .all();

    return c.json({ success: true, data: botTrades });
  } catch (error) {
    console.error('Get trades error:', error);
    return c.json({ success: false, error: 'Failed to get trades' }, 500);
  }
});

// Get all trades for user
tradesRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const db = getDb(c.env.DB);

  try {
    // Get all user's bots
    const userBots = await db.query.tradingBots.findMany({
      where: eq(tradingBots.userId, userId),
    });

    const botIds = userBots.map((bot) => bot.id);

    if (botIds.length === 0) {
      return c.json({ success: true, data: [], total: 0, hasMore: false });
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradeHistory)
      .where(inArray(tradeHistory.botId, botIds))
      .get();

    const total = countResult?.count || 0;

    // Get trades from tradeHistory table for all user's bots with bot name
    const allTrades = await db
      .select({
        id: tradeHistory.id,
        botId: tradeHistory.botId,
        botName: tradingBots.name,
        symbol: tradeHistory.symbol,
        side: tradeHistory.side,
        orderType: tradeHistory.orderType,
        quantity: tradeHistory.quantity,
        entryPrice: tradeHistory.entryPrice,
        exitPrice: tradeHistory.exitPrice,
        leverage: tradeHistory.leverage,
        margin: tradeHistory.margin,
        realizedPnl: tradeHistory.realizedPnl,
        fees: tradeHistory.fees,
        orderId: tradeHistory.orderId,
        stopLossOrderId: tradeHistory.stopLossOrderId,
        takeProfitOrderId: tradeHistory.takeProfitOrderId,
        aiReasoning: tradeHistory.aiReasoning,
        status: tradeHistory.status,
        openedAt: tradeHistory.openedAt,
        closedAt: tradeHistory.closedAt,
      })
      .from(tradeHistory)
      .leftJoin(tradingBots, eq(tradeHistory.botId, tradingBots.id))
      .where(inArray(tradeHistory.botId, botIds))
      .orderBy(desc(tradeHistory.openedAt))
      .limit(limit)
      .offset(offset)
      .all();

    const hasMore = offset + allTrades.length < total;

    return c.json({ success: true, data: allTrades, total, hasMore });
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
    const trade = await db
      .select()
      .from(tradeHistory)
      .where(eq(tradeHistory.id, tradeId))
      .get();

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

