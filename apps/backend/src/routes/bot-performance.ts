/**
 * Bot Performance API Routes
 * Endpoints for fetching bot performance metrics and real-time updates
 */

import { Hono } from 'hono';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { tradingBots, botExecutions } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';

type BotPerformanceBindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const botPerformanceRoutes = new Hono<{ Bindings: BotPerformanceBindings }>();

botPerformanceRoutes.use('/*', authMiddleware);

/**
 * Get latest performance data for all active bots
 * GET /api/bot-performance/latest
 */
botPerformanceRoutes.get('/latest', async (c) => {
  try {
    const userId = getUserId(c);
    const db = getDb(c.env.DB);

    // Get all active bots for the user
    const userBots = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.userId, userId), eq(tradingBots.status, 'active')))
      .all();

    if (userBots.length === 0) {
      return c.json({
        success: true,
        data: [],
      });
    }

    // Get latest execution for each bot with performance metrics
    const performanceData = await Promise.all(
      userBots.map(async (bot) => {
        const latestExecution = await db
          .select({
            id: botExecutions.id,
            botId: botExecutions.botId,
            executionTime: botExecutions.executionTime,
            totalBalance: botExecutions.totalBalance,
            unrealizedPnl: botExecutions.unrealizedPnl,
            accountBalance: botExecutions.accountBalance,
            status: botExecutions.status,
          })
          .from(botExecutions)
          .where(eq(botExecutions.botId, bot.id))
          .orderBy(desc(botExecutions.executionTime))
          .limit(1)
          .get();

        return {
          botId: bot.id,
          botName: bot.name,
          totalBalance: latestExecution?.totalBalance ?? null,
          unrealizedPnl: latestExecution?.unrealizedPnl ?? null,
          accountBalance: latestExecution?.accountBalance ?? null,
          executionTime: latestExecution?.executionTime ?? null,
          status: latestExecution?.status ?? 'PENDING',
        };
      })
    );

    return c.json({
      success: true,
      data: performanceData,
    });
  } catch (error: any) {
    console.error('Error fetching bot performance:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch bot performance data',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Get performance history for a specific bot
 * GET /api/bot-performance/:botId/history
 */
botPerformanceRoutes.get('/:botId/history', async (c) => {
  try {
    const userId = getUserId(c);
    const botId = c.req.param('botId');
    const limit = parseInt(c.req.query('limit') || '100');
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

    // Get execution history with performance metrics
    const history = await db
      .select({
        id: botExecutions.id,
        executionTime: botExecutions.executionTime,
        totalBalance: botExecutions.totalBalance,
        unrealizedPnl: botExecutions.unrealizedPnl,
        accountBalance: botExecutions.accountBalance,
        accountExposure: botExecutions.accountExposure,
        tradesExecuted: botExecutions.tradesExecuted,
        status: botExecutions.status,
      })
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .orderBy(desc(botExecutions.executionTime))
      .limit(limit)
      .all();

    return c.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    console.error('Error fetching bot performance history:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch bot performance history',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Get initial balance for a bot (first execution)
 * GET /api/bot-performance/:botId/initial-balance
 */
botPerformanceRoutes.get('/:botId/initial-balance', async (c) => {
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

    // Get first execution to determine initial balance
    const firstExecution = await db
      .select({
        totalBalance: botExecutions.totalBalance,
        accountBalance: botExecutions.accountBalance,
        executionTime: botExecutions.executionTime,
      })
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .orderBy(botExecutions.executionTime) // Ascending to get first
      .limit(1)
      .get();

    return c.json({
      success: true,
      data: {
        initialBalance: firstExecution?.totalBalance ?? firstExecution?.accountBalance ?? null,
        firstExecutionTime: firstExecution?.executionTime ?? null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching initial balance:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch initial balance',
        message: error.message,
      },
      500
    );
  }
});

