/**
 * Bot Performance API Routes
 * Endpoints for fetching bot performance metrics and real-time updates
 */

import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { tradingBots, botExecutions } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import {
  determineAggregationInterval,
  aggregateRecordsInMemory,
  getTimeRange,
  calculateMetadata,
} from '../lib/performance-aggregation';

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
 * Get performance history for a specific bot with intelligent aggregation
 * GET /api/bot-performance/:botId/history?limit=100
 * Use limit=0 to fetch all records with automatic aggregation
 * Use aggregate=false to disable aggregation and get raw data
 */
botPerformanceRoutes.get('/:botId/history', async (c) => {
  try {
    const userId = getUserId(c);
    const botId = c.req.param('botId');
    const limitParam = c.req.query('limit') || '100';
    const limit = parseInt(limitParam);
    const disableAggregation = c.req.query('aggregate') === 'false';
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

    // Fetch all execution records for this bot (ordered by time ascending for aggregation)
    const allRecords = await db
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
      .orderBy(botExecutions.executionTime) // Ascending for proper aggregation
      .all();

    // If aggregation is disabled or limit is specified (not 0), return raw data
    if (disableAggregation || (limit > 0 && limit < allRecords.length)) {
      const limitedRecords = limit > 0 ? allRecords.slice(-limit).reverse() : allRecords.reverse();
      return c.json({
        success: true,
        data: limitedRecords,
      });
    }

    // Determine if aggregation is needed
    const totalRecords = allRecords.length;
    const timeRange = getTimeRange(allRecords);

    if (!timeRange.first || !timeRange.last) {
      return c.json({
        success: true,
        data: { history: [], metadata: null },
      });
    }

    const timeSpanSeconds = timeRange.last - timeRange.first;
    const interval = determineAggregationInterval(totalRecords, timeSpanSeconds);

    // Aggregate the data
    const aggregatedHistory = aggregateRecordsInMemory(allRecords, interval);

    // Calculate metadata
    const metadata = calculateMetadata(
      totalRecords,
      aggregatedHistory.length,
      timeRange.first,
      timeRange.last,
      interval
    );

    return c.json({
      success: true,
      data: {
        history: aggregatedHistory,
        metadata,
      },
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

