/**
 * Bot Execution API Routes
 * Endpoints for managing and monitoring bot execution
 */

import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { tradingBots, botExecutions, tradeHistory, positionSnapshots, botMetrics } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import { asterRateLimiter } from '../services/rate-limiter';

type BotExecutionBindings = {
  DB: D1Database;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  PBKDF2_ITERATIONS?: string;
  APP_RUNTIME_ENV?: string;
};

export const botExecutionRoutes = new Hono<{ Bindings: BotExecutionBindings }>();

botExecutionRoutes.use('/*', authMiddleware);

/**
 * Get bot execution history
 * GET /api/bot-execution/:botId/history
 */
botExecutionRoutes.get('/:botId/history', async (c) => {
  try {
    const userId = getUserId(c);
    const botId = c.req.param('botId');
    const limit = parseInt(c.req.query('limit') || '50');
    const db = getDb(c.env.DB);

    // Verify bot ownership
    const bot = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    // Get execution history
    const executions = await db
      .select()
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .orderBy(desc(botExecutions.executionTime))
      .limit(limit)
      .all();

    return c.json({
      success: true,
      data: executions,
    });
  } catch (error: any) {
    console.error('Error fetching execution history:', error);
    return c.json(
      { success: false, error: 'Failed to fetch execution history', message: error.message },
      500
    );
  }
});

/**
 * Get bot trade history
 * GET /api/bot-execution/:botId/trades
 */
botExecutionRoutes.get('/:botId/trades', async (c) => {
  try {
    const userId = getUserId(c);
    const botId = c.req.param('botId');
    const limit = parseInt(c.req.query('limit') || '100');
    const status = c.req.query('status'); // 'OPEN', 'CLOSED', 'CANCELLED'
    const db = getDb(c.env.DB);

    // Verify bot ownership
    const bot = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    // Build query with bot name
    const selectFields = {
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
    };

    let trades;
    if (status) {
      trades = await db
        .select(selectFields)
        .from(tradeHistory)
        .leftJoin(tradingBots, eq(tradeHistory.botId, tradingBots.id))
        .where(and(eq(tradeHistory.botId, botId), eq(tradeHistory.status, status)))
        .orderBy(desc(tradeHistory.openedAt))
        .limit(limit)
        .all();
    } else {
      trades = await db
        .select(selectFields)
        .from(tradeHistory)
        .leftJoin(tradingBots, eq(tradeHistory.botId, tradingBots.id))
        .where(eq(tradeHistory.botId, botId))
        .orderBy(desc(tradeHistory.openedAt))
        .limit(limit)
        .all();
    }

    return c.json({
      success: true,
      data: trades,
    });
  } catch (error: any) {
    console.error('Error fetching trade history:', error);
    return c.json(
      { success: false, error: 'Failed to fetch trade history', message: error.message },
      500
    );
  }
});

/**
 * Get bot performance metrics
 * GET /api/bot-execution/:botId/metrics
 */
botExecutionRoutes.get('/:botId/metrics', async (c) => {
  try {
    const userId = getUserId(c);
    const botId = c.req.param('botId');
    const db = getDb(c.env.DB);

    // Verify bot ownership
    const bot = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    // Get metrics
    const metrics = await db
      .select()
      .from(botMetrics)
      .where(eq(botMetrics.botId, botId))
      .get();

    if (!metrics) {
      return c.json({
        success: true,
        data: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalReturn: 0,
          totalPnl: 0,
          sharpeRatio: 0,
          winRate: 0,
        },
      });
    }

    return c.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Error fetching bot metrics:', error);
    return c.json(
      { success: false, error: 'Failed to fetch bot metrics', message: error.message },
      500
    );
  }
});

/**
 * Get current positions
 * GET /api/bot-execution/:botId/positions
 */
botExecutionRoutes.get('/:botId/positions', async (c) => {
  try {
    const userId = getUserId(c);
    const botId = c.req.param('botId');
    const db = getDb(c.env.DB);

    // Verify bot ownership
    const bot = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    // Get latest position snapshots (one per symbol)
    const positions = await db
      .select()
      .from(positionSnapshots)
      .where(eq(positionSnapshots.botId, botId))
      .orderBy(desc(positionSnapshots.snapshotTime))
      .limit(10)
      .all();

    // Group by symbol and get latest for each
    const latestPositions = positions.reduce((acc, pos) => {
      if (!acc[pos.symbol] || new Date(pos.snapshotTime!) > new Date(acc[pos.symbol].snapshotTime!)) {
        acc[pos.symbol] = pos;
      }
      return acc;
    }, {} as Record<string, typeof positions[0]>);

    // Enrich positions with entry time, side, reasoning, and invalidation condition from trade history
    const enrichedPositions = await Promise.all(
      Object.values(latestPositions).map(async (position) => {
        // Find the open trade for this symbol to get entry time, side, reasoning, and invalidation condition
        const openTrade = await db
          .select()
          .from(tradeHistory)
          .where(
            and(
              eq(tradeHistory.botId, botId),
              eq(tradeHistory.symbol, position.symbol),
              eq(tradeHistory.status, 'OPEN')
            )
          )
          .orderBy(desc(tradeHistory.openedAt))
          .limit(1)
          .get();

        return {
          ...position,
          entryTime: openTrade?.openedAt || null,
          side: openTrade?.side || null,
          reasoning: openTrade?.aiReasoning || null,
          invalidationCondition: openTrade?.invalidationCondition || null,
        };
      })
    );

    return c.json({
      success: true,
      data: enrichedPositions,
    });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return c.json(
      { success: false, error: 'Failed to fetch positions', message: error.message },
      500
    );
  }
});

/**
 * Get Aster DEX API rate limit status
 * GET /api/bot-execution/rate-limit-status
 */
botExecutionRoutes.get('/rate-limit-status', async (c) => {
  try {
    const status = asterRateLimiter.getStatus();

    return c.json({
      success: true,
      data: {
        requests: {
          used: status.requestsUsed,
          limit: status.requestsLimit,
          percentage: Math.round((status.requestsUsed / status.requestsLimit) * 100),
        },
        ordersPerMinute: {
          used: status.ordersUsedMinute,
          limit: status.ordersLimitMinute,
          percentage: Math.round((status.ordersUsedMinute / status.ordersLimitMinute) * 100),
        },
        ordersPer10Seconds: {
          used: status.ordersUsed10s,
          limit: status.ordersLimit10s,
          percentage: Math.round((status.ordersUsed10s / status.ordersLimit10s) * 100),
        },
        timeUntilReset: {
          minute: Math.ceil(status.timeUntilResetMinute / 1000),
          tenSeconds: Math.ceil(status.timeUntilReset10s / 1000),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching rate limit status:', error);
    return c.json(
      { success: false, error: 'Failed to fetch rate limit status', message: error.message },
      500
    );
  }
});

