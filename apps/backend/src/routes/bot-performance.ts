/**
 * Bot Performance API Routes
 * Endpoints for fetching bot performance metrics and real-time updates
 */

import { Hono } from 'hono';
import { eq, desc, and, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../lib/db';
import { tradingBots, botExecutions, tradeHistory, botPerformanceSnapshots } from '../db/schema';
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

/**
 * Sync account balances for all trades of a bot
 * POST /api/bot-performance/:botId/sync-balances
 * Calculates account balance based on P&L for all closed trades
 */
botPerformanceRoutes.post('/:botId/sync-balances', async (c) => {
  try {
    const userId = getUserId(c);
    const botId = c.req.param('botId');
    const initialBalance = parseFloat(c.req.query('initialBalance') || '100');
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

    // Get all closed trades ordered by closedAt
    const closedTrades = await db
      .select()
      .from(tradeHistory)
      .where(and(eq(tradeHistory.botId, botId), eq(tradeHistory.status, 'CLOSED')))
      .orderBy(asc(tradeHistory.closedAt))
      .all();

    let currentBalance = initialBalance;
    let updatedCount = 0;

    // Update each trade with calculated account balance
    for (const trade of closedTrades) {
      // Calculate balance after this trade
      const pnl = trade.realizedPnl || 0;
      const fees = trade.fees || 0;
      const netPnl = pnl - fees;

      // Balance before this trade closed
      const balanceBeforeClose = currentBalance;

      // Update the trade with account balance
      await db
        .update(tradeHistory)
        .set({ accountBalance: balanceBeforeClose })
        .where(eq(tradeHistory.id, trade.id))
        .run();

      // Update current balance for next iteration
      currentBalance += netPnl;
      updatedCount++;
    }

    return c.json({
      success: true,
      data: {
        updatedTrades: updatedCount,
        initialBalance,
        finalBalance: currentBalance,
        totalPnl: currentBalance - initialBalance,
      },
    });
  } catch (error: any) {
    console.error('Error syncing account balances:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to sync account balances',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Get snapshot-based performance history for a specific bot with intelligent aggregation
 * GET /api/bot-performance/:botId/snapshot-history?limit=100
 * Returns account balance progression based on bot_performance_snapshots
 * Use limit=0 to fetch all records with automatic aggregation
 * Use aggregate=false to disable aggregation and get raw data
 */
botPerformanceRoutes.get('/:botId/snapshot-history', async (c) => {
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

    // Get all snapshots ordered by time
    const snapshots = await db
      .select({
        id: botPerformanceSnapshots.id,
        totalBalance: botPerformanceSnapshots.totalBalance,
        snapshotTime: botPerformanceSnapshots.snapshotTime,
      })
      .from(botPerformanceSnapshots)
      .where(eq(botPerformanceSnapshots.botId, botId))
      .orderBy(asc(botPerformanceSnapshots.snapshotTime))
      .all();

    if (snapshots.length === 0) {
      return c.json({
        success: true,
        data: {
          history: [],
          metadata: {
            totalRecords: 0,
            returnedRecords: 0,
            aggregated: false,
          },
        },
      });
    }

    // Build history from snapshots
    const allHistory = snapshots.map((snapshot) => ({
      id: snapshot.id,
      timestamp: snapshot.snapshotTime,
      totalBalance: snapshot.totalBalance,
      accountBalance: snapshot.totalBalance,
    }));

    // If limit is specified and less than total, return limited results
    if (limit > 0 && limit < allHistory.length && !disableAggregation) {
      // Apply intelligent aggregation
      const timeRange = getTimeRange(allHistory);
      if (timeRange.first !== null && timeRange.last !== null) {
        const timeSpanSeconds = timeRange.last - timeRange.first;
        const interval = determineAggregationInterval(allHistory.length, timeSpanSeconds);
        const aggregatedHistory = aggregateRecordsInMemory(allHistory, interval);
        const metadata = calculateMetadata(
          allHistory.length,
          aggregatedHistory.length,
          timeRange.first,
          timeRange.last,
          interval
        );

        return c.json({
          success: true,
          data: {
            history: aggregatedHistory.slice(-limit),
            metadata,
          },
        });
      }
    }

    // Return all records or limited raw data
    const returnedHistory = limit > 0 ? allHistory.slice(-limit) : allHistory;

    return c.json({
      success: true,
      data: {
        history: returnedHistory,
        metadata: {
          totalRecords: allHistory.length,
          returnedRecords: returnedHistory.length,
          aggregated: false,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching bot snapshot history:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch bot snapshot history',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Get trade-based performance history for a specific bot with intelligent aggregation
 * GET /api/bot-performance/:botId/trade-history?limit=100
 * Returns account balance progression based on closed trades
 * Use limit=0 to fetch all records with automatic aggregation
 * Use aggregate=false to disable aggregation and get raw data
 */
botPerformanceRoutes.get('/:botId/trade-history', async (c) => {
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

    // Get all closed trades ordered by closedAt (ascending for aggregation)
    const closedTrades = await db
      .select({
        id: tradeHistory.id,
        symbol: tradeHistory.symbol,
        side: tradeHistory.side,
        entryPrice: tradeHistory.entryPrice,
        exitPrice: tradeHistory.exitPrice,
        quantity: tradeHistory.quantity,
        realizedPnl: tradeHistory.realizedPnl,
        fees: tradeHistory.fees,
        accountBalance: tradeHistory.accountBalance,
        closedAt: tradeHistory.closedAt,
        openedAt: tradeHistory.openedAt,
      })
      .from(tradeHistory)
      .where(and(eq(tradeHistory.botId, botId), eq(tradeHistory.status, 'CLOSED')))
      .orderBy(asc(tradeHistory.closedAt))
      .all();

    // Build history with account balance from trade_history table
    const initialBalance = 100; // Fixed initial balance
    const allHistory = closedTrades.map((trade) => {
      const pnl = trade.realizedPnl || 0;
      const fees = trade.fees || 0;
      const netPnl = pnl - fees;

      // Use stored account balance from trade_history table
      const accountBalance = trade.accountBalance ?? initialBalance;

      return {
        id: trade.id,
        timestamp: trade.closedAt,
        accountBalance,
        totalBalance: accountBalance, // For compatibility with aggregation
        realizedPnl: pnl,
        fees,
        netPnl,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
      };
    });

    // If aggregation is disabled or limit is specified (not 0), return raw data
    if (disableAggregation || (limit > 0 && limit < allHistory.length)) {
      const limitedRecords = limit > 0 ? allHistory.slice(-limit).reverse() : allHistory.reverse();
      return c.json({
        success: true,
        data: {
          history: limitedRecords,
          totalTrades: closedTrades.length,
        },
      });
    }

    // Determine if aggregation is needed
    const totalRecords = allHistory.length;
    const timeRange = getTimeRange(allHistory.map(h => ({ executionTime: h.timestamp })));

    if (!timeRange.first || !timeRange.last) {
      return c.json({
        success: true,
        data: { history: [], metadata: null },
      });
    }

    const timeSpanSeconds = timeRange.last - timeRange.first;
    const interval = determineAggregationInterval(totalRecords, timeSpanSeconds);

    // Aggregate the data (convert to execution format for aggregation)
    const recordsForAggregation = allHistory.map(h => ({
      id: h.id,
      executionTime: h.timestamp,
      totalBalance: h.accountBalance,
      unrealizedPnl: 0,
      accountBalance: h.accountBalance,
      accountExposure: 0,
      tradesExecuted: 1,
      status: 'success',
    }));

    const aggregatedHistory = aggregateRecordsInMemory(recordsForAggregation, interval);

    // Convert back to trade history format
    const formattedHistory = aggregatedHistory.map(record => ({
      id: record.id,
      timestamp: record.executionTime,
      accountBalance: record.accountBalance,
      totalBalance: record.totalBalance,
    }));

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
        history: formattedHistory,
        metadata,
        totalTrades: closedTrades.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching trade-based performance history:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch trade-based performance history',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Sync bot metrics from trade history
 * POST /api/bot-performance/:botId/sync-metrics
 * Recalculates and updates all bot metrics including long/short trades, leverage, etc.
 */
botPerformanceRoutes.post('/:botId/sync-metrics', async (c) => {
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

    // Get all closed trades
    const closedTrades = await db
      .select()
      .from(tradeHistory)
      .where(and(eq(tradeHistory.botId, botId), eq(tradeHistory.status, 'CLOSED')))
      .orderBy(asc(tradeHistory.closedAt))
      .all();

    const totalTrades = closedTrades.length;
    const longTrades = closedTrades.filter(t => t.side === 'BUY').length;
    const shortTrades = closedTrades.filter(t => t.side === 'SELL').length;

    // Calculate average leverage
    const totalLeverage = closedTrades.reduce((sum, t) => sum + (t.leverage || 1), 0);
    const averageLeverage = totalTrades > 0 ? totalLeverage / totalTrades : 0;

    // Calculate win/loss metrics
    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0).length;

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalFees = closedTrades.reduce((sum, t) => sum + (t.fees || 0), 0);
    const netPnl = totalPnl - totalFees;

    // Get initial and final balance
    const firstTrade = closedTrades[0];
    const lastTrade = closedTrades[closedTrades.length - 1];
    const initialBalance = firstTrade?.accountBalance || 100;
    const finalBalance = lastTrade?.accountBalance || initialBalance;
    const totalReturn = initialBalance > 0 ? ((finalBalance - initialBalance) / initialBalance) * 100 : 0;

    // Calculate win rate and profit metrics
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.realizedPnl || 0) < 0);
    const averageWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / losses.length) : 0;
    const profitFactor = averageLoss > 0 ? (averageWin * winningTrades) / (averageLoss * losingTrades) : 0;

    // Calculate Sharpe ratio
    let sharpeRatio = 0;
    if (totalTrades > 1) {
      const returns = closedTrades.map(t => (t.realizedPnl || 0) - (t.fees || 0));
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        const tradesPerYear = 365 * 12;
        const annualizedReturn = avgReturn * tradesPerYear;
        const annualizedStdDev = stdDev * Math.sqrt(tradesPerYear);
        sharpeRatio = annualizedReturn / annualizedStdDev;
      }
    }

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = initialBalance;
    let currentBalance = initialBalance;
    for (const trade of closedTrades) {
      currentBalance = trade.accountBalance || currentBalance;
      if (currentBalance > peak) {
        peak = currentBalance;
      }
      const drawdown = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Update or create bot metrics
    const { botMetrics } = await import('../db/schema');
    const existingMetrics = await db
      .select()
      .from(botMetrics)
      .where(eq(botMetrics.botId, botId))
      .get();

    if (existingMetrics) {
      await db
        .update(botMetrics)
        .set({
          totalTrades,
          winningTrades,
          losingTrades,
          longTrades,
          shortTrades,
          totalPnl: netPnl,
          totalReturn,
          sharpeRatio,
          maxDrawdown,
          winRate,
          averageWin,
          averageLoss,
          profitFactor,
          averageLeverage,
          lastUpdated: new Date(),
        })
        .where(eq(botMetrics.botId, botId));
    } else {
      const { nanoid } = await import('nanoid');
      await db.insert(botMetrics).values({
        id: nanoid(),
        botId,
        totalTrades,
        winningTrades,
        losingTrades,
        longTrades,
        shortTrades,
        totalPnl: netPnl,
        totalReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        averageWin,
        averageLoss,
        profitFactor,
        averageLeverage,
        lastUpdated: new Date(),
      });
    }

    return c.json({
      success: true,
      data: {
        totalTrades,
        longTrades,
        shortTrades,
        winningTrades,
        losingTrades,
        averageLeverage: Math.round(averageLeverage * 100) / 100,
        totalPnl: netPnl,
        totalReturn: Math.round(totalReturn * 100) / 100,
        winRate: Math.round(winRate * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        message: 'Bot metrics synced successfully',
      },
    });
  } catch (error: any) {
    console.error('Error syncing bot metrics:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to sync bot metrics',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Unified sync endpoint - fetches current account balance from Aster API and syncs all metrics
 * POST /api/bot-performance/:botId/sync
 * Fetches account balance from Aster API, updates bot metrics, and returns current state
 */
botPerformanceRoutes.post('/:botId/sync', async (c) => {
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

    // Get latest account balance from most recent execution
    const latestExecution = await db
      .select({
        accountBalance: botExecutions.accountBalance,
        totalBalance: botExecutions.totalBalance,
        unrealizedPnl: botExecutions.unrealizedPnl,
      })
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .orderBy(desc(botExecutions.executionTime))
      .limit(1)
      .get();

    const currentAccountBalance = latestExecution?.accountBalance ?? null;
    const currentTotalBalance = latestExecution?.totalBalance ?? null;
    const unrealizedPnl = latestExecution?.unrealizedPnl ?? null;

    // Get all closed trades for metrics calculation
    const closedTrades = await db
      .select()
      .from(tradeHistory)
      .where(and(eq(tradeHistory.botId, botId), eq(tradeHistory.status, 'CLOSED')))
      .orderBy(asc(tradeHistory.closedAt))
      .all();

    // Update account balances in trade history
    // Strategy:
    // - For old trades (beyond latest 100): Calculate from initial balance of 100
    // - For latest 100 trades: Use actual totalBalance from bot executions when available
    const initialBalance = 100; // Fixed initial balance

    if (closedTrades.length > 0) {
      // Get all bot executions for this bot (latest 100 stored)
      const allExecutions = await db
        .select({
          id: botExecutions.id,
          executionTime: botExecutions.executionTime,
          totalBalance: botExecutions.totalBalance,
        })
        .from(botExecutions)
        .where(eq(botExecutions.botId, botId))
        .orderBy(asc(botExecutions.executionTime))
        .all();

      // Find the earliest execution time to determine cutoff
      const earliestExecutionTime = allExecutions.length > 0 && allExecutions[0].executionTime
        ? new Date(allExecutions[0].executionTime).getTime()
        : null;

      let runningBalance = initialBalance;

      // Always update ALL trades' account balances from start
      for (const trade of closedTrades) {
        const tradeCloseTime = trade.closedAt ? new Date(trade.closedAt).getTime() : 0;
        const pnl = trade.realizedPnl || 0;
        const fees = trade.fees || 0;

        let balanceAfterTrade: number;

        // Check if this trade is within the latest 100 executions window
        if (earliestExecutionTime !== null && tradeCloseTime >= earliestExecutionTime) {
          // This is a recent trade - try to use bot execution data
          const closestExecution = allExecutions.find(
            (exec) => exec.executionTime && new Date(exec.executionTime).getTime() >= tradeCloseTime
          );

          if (closestExecution?.totalBalance !== null && closestExecution?.totalBalance !== undefined) {
            // Use actual totalBalance from bot execution
            balanceAfterTrade = closestExecution.totalBalance;
          } else {
            // No execution found, calculate from running balance
            balanceAfterTrade = runningBalance + pnl - fees;
          }
        } else {
          // Old trade (before earliest execution) - calculate from P&L
          balanceAfterTrade = runningBalance + pnl - fees;
        }

        // Store the balance AFTER this trade in the trade record
        await db
          .update(tradeHistory)
          .set({ accountBalance: balanceAfterTrade })
          .where(eq(tradeHistory.id, trade.id));

        // Update running balance for next iteration
        runningBalance = balanceAfterTrade;
        trade.accountBalance = balanceAfterTrade; // Update in-memory object for metrics calculation
      }
    }

    const totalTrades = closedTrades.length;
    const longTrades = closedTrades.filter(t => t.side === 'BUY').length;
    const shortTrades = closedTrades.filter(t => t.side === 'SELL').length;

    // Calculate average leverage
    const totalLeverage = closedTrades.reduce((sum, t) => sum + (t.leverage || 1), 0);
    const averageLeverage = totalTrades > 0 ? totalLeverage / totalTrades : 0;

    // Calculate win/loss metrics
    const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0).length;

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalFees = closedTrades.reduce((sum, t) => sum + (t.fees || 0), 0);
    const netPnl = totalPnl - totalFees;

    // Get final balance from trade history (initialBalance already calculated above)
    const lastTrade = closedTrades[closedTrades.length - 1];
    const finalBalance = lastTrade?.accountBalance || initialBalance;
    const totalReturn = initialBalance > 0 ? ((finalBalance - initialBalance) / initialBalance) * 100 : 0;

    // Calculate win rate and profit metrics
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.realizedPnl || 0) < 0);
    const averageWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / losses.length) : 0;
    const profitFactor = averageLoss > 0 ? (averageWin * winningTrades) / (averageLoss * losingTrades) : 0;

    // Calculate Sharpe ratio
    let sharpeRatio = 0;
    if (totalTrades > 1) {
      const returns = closedTrades.map(t => (t.realizedPnl || 0) - (t.fees || 0));
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        const tradesPerYear = 365 * 12;
        const annualizedReturn = avgReturn * tradesPerYear;
        const annualizedStdDev = stdDev * Math.sqrt(tradesPerYear);
        sharpeRatio = annualizedReturn / annualizedStdDev;
      }
    }

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = initialBalance;
    let currentBalance = initialBalance;
    for (const trade of closedTrades) {
      currentBalance = trade.accountBalance || currentBalance;
      if (currentBalance > peak) {
        peak = currentBalance;
      }
      const drawdown = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Update or create bot metrics
    const { botMetrics } = await import('../db/schema');
    const existingMetrics = await db
      .select()
      .from(botMetrics)
      .where(eq(botMetrics.botId, botId))
      .get();

    if (existingMetrics) {
      await db
        .update(botMetrics)
        .set({
          totalTrades,
          winningTrades,
          losingTrades,
          longTrades,
          shortTrades,
          totalPnl: netPnl,
          totalReturn,
          sharpeRatio,
          maxDrawdown,
          winRate,
          averageWin,
          averageLoss,
          profitFactor,
          averageLeverage,
          lastUpdated: new Date(),
        })
        .where(eq(botMetrics.botId, botId));
    } else {
      const { nanoid } = await import('nanoid');
      await db.insert(botMetrics).values({
        id: nanoid(),
        botId,
        totalTrades,
        winningTrades,
        losingTrades,
        longTrades,
        shortTrades,
        totalPnl: netPnl,
        totalReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        averageWin,
        averageLoss,
        profitFactor,
        averageLeverage,
        lastUpdated: new Date(),
      });
    }

    return c.json({
      success: true,
      data: {
        // Current account balance from Aster API
        currentAccountBalance,
        currentTotalBalance,
        unrealizedPnl,
        // Metrics from trade history
        totalTrades,
        longTrades,
        shortTrades,
        longPercentage: totalTrades > 0 ? Math.round((longTrades / totalTrades) * 10000) / 100 : 0,
        shortPercentage: totalTrades > 0 ? Math.round((shortTrades / totalTrades) * 10000) / 100 : 0,
        averageLeverage: Math.round(averageLeverage * 100) / 100,
        initialBalance,
        finalBalance,
        totalPnl: netPnl,
        totalReturn: Math.round(totalReturn * 100) / 100,
        winRate: Math.round(winRate * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        message: 'Bot synced successfully',
      },
    });
  } catch (error: any) {
    console.error('Error syncing bot:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to sync bot',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Sync all user's bot metrics
 * POST /api/bot-performance/sync-all-metrics
 * Recalculates and updates metrics for all user's bots
 */
botPerformanceRoutes.post('/sync-all-metrics', async (c) => {
  try {
    const userId = getUserId(c);
    const db = getDb(c.env.DB);

    // Get all user's bots
    const userBots = await db
      .select()
      .from(tradingBots)
      .where(eq(tradingBots.userId, userId))
      .all();

    if (userBots.length === 0) {
      return c.json({
        success: true,
        data: {
          botsProcessed: 0,
          message: 'No bots found',
        },
      });
    }

    const results = [];
    const { botMetrics } = await import('../db/schema');
    const { nanoid } = await import('nanoid');

    for (const bot of userBots) {
      try {
        // Get all closed trades for this bot
        const closedTrades = await db
          .select()
          .from(tradeHistory)
          .where(and(eq(tradeHistory.botId, bot.id), eq(tradeHistory.status, 'CLOSED')))
          .orderBy(asc(tradeHistory.closedAt))
          .all();

        const totalTrades = closedTrades.length;
        const longTrades = closedTrades.filter(t => t.side === 'BUY').length;
        const shortTrades = closedTrades.filter(t => t.side === 'SELL').length;

        // Calculate average leverage
        const totalLeverage = closedTrades.reduce((sum, t) => sum + (t.leverage || 1), 0);
        const averageLeverage = totalTrades > 0 ? totalLeverage / totalTrades : 0;

        // Calculate win/loss metrics
        const winningTrades = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
        const losingTrades = closedTrades.filter(t => (t.realizedPnl || 0) < 0).length;

        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const totalFees = closedTrades.reduce((sum, t) => sum + (t.fees || 0), 0);
        const netPnl = totalPnl - totalFees;

        // Get initial and final balance
        const firstTrade = closedTrades[0];
        const lastTrade = closedTrades[closedTrades.length - 1];
        const initialBalance = firstTrade?.accountBalance || 100;
        const finalBalance = lastTrade?.accountBalance || initialBalance;
        const totalReturn = initialBalance > 0 ? ((finalBalance - initialBalance) / initialBalance) * 100 : 0;

        // Calculate win rate and profit metrics
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0);
        const losses = closedTrades.filter(t => (t.realizedPnl || 0) < 0);
        const averageWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / wins.length : 0;
        const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnl || 0), 0) / losses.length) : 0;
        const profitFactor = averageLoss > 0 ? (averageWin * winningTrades) / (averageLoss * losingTrades) : 0;

        // Calculate Sharpe ratio
        let sharpeRatio = 0;
        if (totalTrades > 1) {
          const returns = closedTrades.map(t => (t.realizedPnl || 0) - (t.fees || 0));
          const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
          const stdDev = Math.sqrt(variance);
          if (stdDev > 0) {
            const tradesPerYear = 365 * 12;
            const annualizedReturn = avgReturn * tradesPerYear;
            const annualizedStdDev = stdDev * Math.sqrt(tradesPerYear);
            sharpeRatio = annualizedReturn / annualizedStdDev;
          }
        }

        // Calculate max drawdown
        let maxDrawdown = 0;
        let peak = initialBalance;
        let currentBalance = initialBalance;
        for (const trade of closedTrades) {
          currentBalance = trade.accountBalance || currentBalance;
          if (currentBalance > peak) {
            peak = currentBalance;
          }
          const drawdown = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }

        // Update or create bot metrics
        const existingMetrics = await db
          .select()
          .from(botMetrics)
          .where(eq(botMetrics.botId, bot.id))
          .get();

        if (existingMetrics) {
          await db
            .update(botMetrics)
            .set({
              totalTrades,
              winningTrades,
              losingTrades,
              longTrades,
              shortTrades,
              totalPnl: netPnl,
              totalReturn,
              sharpeRatio,
              maxDrawdown,
              winRate,
              averageWin,
              averageLoss,
              profitFactor,
              averageLeverage,
              lastUpdated: new Date(),
            })
            .where(eq(botMetrics.botId, bot.id));
        } else {
          await db.insert(botMetrics).values({
            id: nanoid(),
            botId: bot.id,
            totalTrades,
            winningTrades,
            losingTrades,
            longTrades,
            shortTrades,
            totalPnl: netPnl,
            totalReturn,
            sharpeRatio,
            maxDrawdown,
            winRate,
            averageWin,
            averageLoss,
            profitFactor,
            averageLeverage,
            lastUpdated: new Date(),
          });
        }

        results.push({
          botId: bot.id,
          botName: bot.name,
          totalTrades,
          success: true,
        });
      } catch (error: any) {
        results.push({
          botId: bot.id,
          botName: bot.name,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return c.json({
      success: true,
      data: {
        botsProcessed: userBots.length,
        successCount,
        failureCount,
        results,
        message: `Synced metrics for ${successCount} bot(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      },
    });
  } catch (error: any) {
    console.error('Error syncing all bot metrics:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to sync all bot metrics',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Get bot statistics from trade history
 * GET /api/bot-performance/:botId/statistics
 * Returns: total trades, long/short counts with percentages, average leverage, initial/final balance
 */
botPerformanceRoutes.get('/:botId/statistics', async (c) => {
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

    // Get all closed trades
    const closedTrades = await db
      .select()
      .from(tradeHistory)
      .where(and(eq(tradeHistory.botId, botId), eq(tradeHistory.status, 'CLOSED')))
      .orderBy(asc(tradeHistory.closedAt))
      .all();

    const totalTrades = closedTrades.length;
    const longTrades = closedTrades.filter(t => t.side === 'BUY').length;
    const shortTrades = closedTrades.filter(t => t.side === 'SELL').length;

    const longPercentage = totalTrades > 0 ? (longTrades / totalTrades) * 100 : 0;
    const shortPercentage = totalTrades > 0 ? (shortTrades / totalTrades) * 100 : 0;

    // Calculate average leverage
    const totalLeverage = closedTrades.reduce((sum, t) => sum + (t.leverage || 1), 0);
    const averageLeverage = totalTrades > 0 ? totalLeverage / totalTrades : 0;

    // Get initial and final balance
    const firstTrade = closedTrades[0];
    const lastTrade = closedTrades[closedTrades.length - 1];

    const initialBalance = firstTrade?.accountBalance || 100;
    const finalBalance = lastTrade?.accountBalance || initialBalance;

    return c.json({
      success: true,
      data: {
        totalTrades,
        longTrades,
        shortTrades,
        longPercentage: Math.round(longPercentage * 100) / 100,
        shortPercentage: Math.round(shortPercentage * 100) / 100,
        averageLeverage: Math.round(averageLeverage * 100) / 100,
        initialBalance,
        finalBalance,
      },
    });
  } catch (error: any) {
    console.error('Error fetching bot statistics:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch bot statistics',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Sync bot performance snapshots from trade history
 * POST /api/bot-performance/:botId/sync-snapshots
 * Populates bot_performance_snapshots table with historical data from trade_history.accountBalance
 */
botPerformanceRoutes.post('/:botId/sync-snapshots', async (c) => {
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

    // Get all trades with accountBalance, ordered by time
    const trades = await db
      .select({
        id: tradeHistory.id,
        accountBalance: tradeHistory.accountBalance,
        openedAt: tradeHistory.openedAt,
        closedAt: tradeHistory.closedAt,
        status: tradeHistory.status,
      })
      .from(tradeHistory)
      .where(eq(tradeHistory.botId, botId))
      .orderBy(asc(tradeHistory.openedAt))
      .all();

    if (trades.length === 0) {
      return c.json({
        success: true,
        message: 'No trades found for this bot',
        snapshotsCreated: 0,
        totalTrades: 0,
      });
    }

    // Delete existing snapshots for this bot to avoid duplicates
    await db.delete(botPerformanceSnapshots).where(eq(botPerformanceSnapshots.botId, botId));

    // Create snapshots from trades with accountBalance
    let snapshotsCreated = 0;
    const snapshots: Array<{ id: string; botId: string; totalBalance: number; snapshotTime: Date }> = [];

    for (const trade of trades) {
      if (trade.accountBalance !== null && trade.accountBalance !== undefined) {
        // Use closedAt for closed trades, openedAt for open trades
        const snapshotTime = trade.status === 'CLOSED' && trade.closedAt
          ? trade.closedAt
          : trade.openedAt;

        if (snapshotTime) {
          snapshots.push({
            id: nanoid(),
            botId,
            totalBalance: trade.accountBalance,
            snapshotTime: snapshotTime instanceof Date ? snapshotTime : new Date(snapshotTime),
          });
        }
      }
    }

    // Insert snapshots in batches
    if (snapshots.length > 0) {
      // D1/SQLite has a limit of 999 variables per query
      // Each snapshot has 4 fields (id, botId, totalBalance, snapshotTime)
      // To be safe, use batch size of 100 (100 * 4 = 400 variables)
      const batchSize = 100;
      for (let i = 0; i < snapshots.length; i += batchSize) {
        const batch = snapshots.slice(i, i + batchSize);
        try {
          await db.insert(botPerformanceSnapshots).values(batch);
          snapshotsCreated += batch.length;
        } catch (batchError: any) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, batchError);
          // If batch insert fails, try inserting one by one
          for (const snapshot of batch) {
            try {
              await db.insert(botPerformanceSnapshots).values(snapshot);
              snapshotsCreated += 1;
            } catch (singleError: any) {
              console.error('Error inserting single snapshot:', singleError);
              // Continue with next snapshot
            }
          }
        }
      }
    }

    return c.json({
      success: true,
      message: `Successfully synced ${snapshotsCreated} performance snapshots`,
      snapshotsCreated,
      totalTrades: trades.length,
    });
  } catch (error: any) {
    console.error('Error syncing bot performance snapshots:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to sync bot performance snapshots',
        message: error.message,
      },
      500
    );
  }
});

