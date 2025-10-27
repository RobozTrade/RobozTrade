import { Hono } from 'hono';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { users, tradingBots, tradeHistory, positionSnapshots, botExecutions } from '../db/schema';
import {
  determineAggregationInterval,
  aggregateRecordsInMemory,
  getTimeRange,
  calculateMetadata,
} from '../lib/performance-aggregation';
import {
  calculatePerformanceScore,
  calculateMaxDrawdown,
  MIN_TRADES_TO_QUALIFY,
  getPerformanceScoreFormula,
} from '../lib/performance-score';

type PublicBindings = {
  DB: D1Database;
};

export const publicRoutes = new Hono<{ Bindings: PublicBindings }>();

/**
 * Get all bots for a specific wallet address (public endpoint)
 * GET /api/public/bots/:walletAddress
 */
publicRoutes.get('/bots/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Find user by wallet address
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    if (!user) {
      return c.json({ success: true, data: [] });
    }

    // Get all bots for this user
    const bots = await db.query.tradingBots.findMany({
      where: eq(tradingBots.userId, user.id),
    });

    return c.json({ success: true, data: bots });
  } catch (error) {
    console.error('Get public bots error:', error);
    return c.json({ success: false, error: 'Failed to get bots' }, 500);
  }
});

/**
 * Get trade history for a specific wallet address (public endpoint)
 * GET /api/public/trades/:walletAddress
 */
publicRoutes.get('/trades/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const limit = parseInt(c.req.query('limit') || '50');
  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Find user by wallet address
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    if (!user) {
      return c.json({ success: true, data: [] });
    }

    // Get all bots for this user
    const userBots = await db
      .select()
      .from(tradingBots)
      .where(eq(tradingBots.userId, user.id))
      .all();

    if (userBots.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const botIds = userBots.map((bot) => bot.id);

    // Get trade history for all user's bots with bot name
    const trades = await db
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
      .all();

    return c.json({ success: true, data: trades });
  } catch (error) {
    console.error('Get public trades error:', error);
    return c.json({ success: false, error: 'Failed to get trades' }, 500);
  }
});

/**
 * Get positions for a specific wallet address (public endpoint)
 * GET /api/public/positions/:walletAddress
 */
publicRoutes.get('/positions/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Find user by wallet address
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    if (!user) {
      return c.json({ success: true, data: [] });
    }

    // Get all bots for this user
    const userBots = await db
      .select()
      .from(tradingBots)
      .where(eq(tradingBots.userId, user.id))
      .all();

    if (userBots.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const botIds = userBots.map((bot) => bot.id);

    // Get all recent position snapshots for all user's bots
    const allPositions = await db
      .select()
      .from(positionSnapshots)
      .where(inArray(positionSnapshots.botId, botIds))
      .orderBy(desc(positionSnapshots.snapshotTime))
      .limit(200) // Get more to ensure we have latest for each symbol+bot combo
      .all();

    // Group by botId+symbol and get latest for each unique position
    const latestPositionsMap = new Map<string, typeof allPositions[0]>();

    for (const pos of allPositions) {
      const key = `${pos.botId}-${pos.symbol}`;
      const existing = latestPositionsMap.get(key);

      if (!existing || new Date(pos.snapshotTime!) > new Date(existing.snapshotTime!)) {
        latestPositionsMap.set(key, pos);
      }
    }

    const positions = Array.from(latestPositionsMap.values());

    // Enrich positions with entry time and side from trade history
    const enrichedPositions = await Promise.all(
      positions.map(async (position) => {
        // Find the open trade for this symbol to get entry time and side
        const openTrade = await db
          .select()
          .from(tradeHistory)
          .where(
            and(
              eq(tradeHistory.botId, position.botId),
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
        };
      })
    );

    return c.json({ success: true, data: enrichedPositions });
  } catch (error) {
    console.error('Get public positions error:', error);
    return c.json({ success: false, error: 'Failed to get positions' }, 500);
  }
});

/**
 * Get bot executions for a specific wallet address (public endpoint)
 * GET /api/public/executions/:walletAddress
 */
publicRoutes.get('/executions/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const limit = parseInt(c.req.query('limit') || '50');
  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Find user by wallet address
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    if (!user) {
      return c.json({ success: true, data: [] });
    }

    // Get all bots for this user
    const userBots = await db
      .select()
      .from(tradingBots)
      .where(eq(tradingBots.userId, user.id))
      .all();

    if (userBots.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const botIds = userBots.map((bot) => bot.id);

    // Get bot executions for all user's bots
    const executions = await db
      .select()
      .from(botExecutions)
      .where(inArray(botExecutions.botId, botIds))
      .orderBy(desc(botExecutions.executionTime))
      .limit(limit)
      .all();

    return c.json({ success: true, data: executions });
  } catch (error) {
    console.error('Get public executions error:', error);
    return c.json({ success: false, error: 'Failed to get executions' }, 500);
  }
});

/**
 * Get latest performance data for all bots of a wallet address (public endpoint)
 * GET /api/public/bot-performance/:walletAddress/latest
 */
publicRoutes.get('/bot-performance/:walletAddress/latest', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Find user by wallet address
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    if (!user) {
      return c.json({ success: true, data: [] });
    }

    // Get all active bots for the user
    const userBots = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.userId, user.id), eq(tradingBots.status, 'active')))
      .all();

    if (userBots.length === 0) {
      return c.json({ success: true, data: [] });
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

    return c.json({ success: true, data: performanceData });
  } catch (error: any) {
    console.error('Get public bot performance error:', error);
    return c.json(
      { success: false, error: 'Failed to get bot performance data', message: error.message },
      500
    );
  }
});

/**
 * Get performance history for a specific bot (public endpoint) with intelligent aggregation
 * GET /api/public/bot-performance/:walletAddress/:botId/history?limit=100
 * Use limit=0 to fetch all records with automatic aggregation
 * Use aggregate=false to disable aggregation and get raw data
 */
publicRoutes.get('/bot-performance/:walletAddress/:botId/history', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const botId = c.req.param('botId');
  const limitParam = c.req.query('limit') || '100';
  const limit = parseInt(limitParam);
  const disableAggregation = c.req.query('aggregate') === 'false';
  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Find user by wallet address
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    if (!user) {
      return c.json({ success: true, data: { history: [], metadata: null } });
    }

    // Verify bot belongs to this user
    const bot = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, user.id)))
      .get();

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    // Fetch all execution records for this bot (ordered by time ascending for aggregation)
    const allRecords = await db
      .select({
        id: botExecutions.id,
        botId: botExecutions.botId,
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
    console.error('Get public bot performance history error:', error);
    return c.json(
      { success: false, error: 'Failed to get bot performance history', message: error.message },
      500
    );
  }
});

/**
 * Get initial balance for a bot by wallet address (public endpoint)
 * GET /api/public/bot-performance/:walletAddress/:botId/initial-balance
 */
publicRoutes.get('/bot-performance/:walletAddress/:botId/initial-balance', async (c) => {
  try {
    const walletAddress = c.req.param('walletAddress').toLowerCase();
    const botId = c.req.param('botId');
    const db = getDb(c.env.DB);

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.walletAddress, walletAddress),
    });

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Verify bot belongs to user
    const bot = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, user.id)))
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
    console.error('Error fetching public initial balance:', error);
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
 * Get top performing bots ranked by performance score (leaderboard)
 * GET /api/public/leaderboard/top-bots?limit=50
 *
 * Performance Score = (Total P&L % / Max Drawdown %) × ln(N - 50)
 * Minimum 50 trades required to qualify
 */
publicRoutes.get('/leaderboard/top-bots', async (c) => {
  const limitParam = c.req.query('limit') || '50';
  const limit = Math.min(parseInt(limitParam, 10) || 50, 100); // Max 100

  const db = getDb(c.env.DB);

  try {
    // Get all bots with their trade statistics
    const botsWithStats = await db
      .select({
        botId: tradingBots.id,
        botName: tradingBots.name,
        aiModel: tradingBots.aiModel,
        userId: tradingBots.userId,
        totalPnl: sql<number>`COALESCE(SUM(CASE WHEN ${tradeHistory.status} = 'CLOSED' THEN ${tradeHistory.realizedPnl} ELSE 0 END), 0)`,
        totalTrades: sql<number>`COUNT(CASE WHEN ${tradeHistory.status} = 'CLOSED' THEN 1 END)`,
        winningTrades: sql<number>`COUNT(CASE WHEN ${tradeHistory.status} = 'CLOSED' AND ${tradeHistory.realizedPnl} > 0 THEN 1 END)`,
      })
      .from(tradingBots)
      .leftJoin(tradeHistory, eq(tradingBots.id, tradeHistory.botId))
      .groupBy(tradingBots.id, tradingBots.name, tradingBots.aiModel, tradingBots.userId)
      .all();

    // Get user wallet addresses for these bots
    const userIds = [...new Set(botsWithStats.map(b => b.userId))];
    const usersData = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(inArray(users.id, userIds))
      .all();

    const userMap = new Map(usersData.map(u => [u.id, u.walletAddress]));

    // Get initial balance and max drawdown for each bot
    const botsWithScores = await Promise.all(
      botsWithStats.map(async (bot) => {
        // Get first execution for initial balance
        const firstExecution = await db
          .select({
            totalBalance: botExecutions.totalBalance,
            accountBalance: botExecutions.accountBalance,
          })
          .from(botExecutions)
          .where(eq(botExecutions.botId, bot.botId))
          .orderBy(botExecutions.executionTime)
          .limit(1)
          .get();

        const initialBalance = firstExecution?.totalBalance ?? firstExecution?.accountBalance ?? 10000;

        // Get all closed trades for max drawdown calculation
        const closedTrades = await db
          .select({
            realizedPnl: tradeHistory.realizedPnl,
          })
          .from(tradeHistory)
          .where(and(eq(tradeHistory.botId, bot.botId), eq(tradeHistory.status, 'CLOSED')))
          .orderBy(tradeHistory.closedAt)
          .all();

        const maxDrawdown = calculateMaxDrawdown(closedTrades);

        // Calculate performance score
        const scoreResult = calculatePerformanceScore({
          totalPnl: bot.totalPnl,
          initialBalance,
          maxDrawdown,
          totalTrades: bot.totalTrades,
        });

        return {
          botId: bot.botId,
          botName: bot.botName,
          aiModel: bot.aiModel,
          walletAddress: userMap.get(bot.userId) || '',
          totalPnl: bot.totalPnl,
          totalPnlPercent: scoreResult.totalPnlPercent,
          maxDrawdown,
          maxDrawdownPercent: scoreResult.maxDrawdownPercent,
          winRate: bot.totalTrades > 0 ? (bot.winningTrades / bot.totalTrades) * 100 : 0,
          totalTrades: bot.totalTrades,
          performanceScore: scoreResult.score,
          calmarRatio: scoreResult.calmarRatio,
          confidenceScore: scoreResult.confidenceScore,
          qualifies: scoreResult.qualifies,
        };
      })
    );

    // Filter only qualifying bots and sort by performance score
    const qualifiedBots = botsWithScores
      .filter(bot => bot.qualifies)
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, limit);

    return c.json({
      success: true,
      data: {
        bots: qualifiedBots,
        formula: getPerformanceScoreFormula(),
        minTradesToQualify: MIN_TRADES_TO_QUALIFY,
      },
    });
  } catch (error) {
    console.error('Get leaderboard top bots error:', error);
    return c.json({ success: false, error: 'Failed to get leaderboard' }, 500);
  }
});

/**
 * Get top performing bot for each AI model (ranked by performance score)
 * GET /api/public/leaderboard/top-by-model
 */
publicRoutes.get('/leaderboard/top-by-model', async (c) => {
  const db = getDb(c.env.DB);

  try {
    // Get all bots with their trade statistics
    const botsWithStats = await db
      .select({
        botId: tradingBots.id,
        botName: tradingBots.name,
        aiModel: tradingBots.aiModel,
        userId: tradingBots.userId,
        totalPnl: sql<number>`COALESCE(SUM(CASE WHEN ${tradeHistory.status} = 'CLOSED' THEN ${tradeHistory.realizedPnl} ELSE 0 END), 0)`,
        totalTrades: sql<number>`COUNT(CASE WHEN ${tradeHistory.status} = 'CLOSED' THEN 1 END)`,
        winningTrades: sql<number>`COUNT(CASE WHEN ${tradeHistory.status} = 'CLOSED' AND ${tradeHistory.realizedPnl} > 0 THEN 1 END)`,
      })
      .from(tradingBots)
      .leftJoin(tradeHistory, eq(tradingBots.id, tradeHistory.botId))
      .groupBy(tradingBots.id, tradingBots.name, tradingBots.aiModel, tradingBots.userId)
      .all();

    // Get user wallet addresses
    const userIds = [...new Set(botsWithStats.map(b => b.userId))];
    const usersData = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(inArray(users.id, userIds))
      .all();

    const userMap = new Map(usersData.map(u => [u.id, u.walletAddress]));

    // Calculate performance scores for all bots
    const botsWithScores = await Promise.all(
      botsWithStats.map(async (bot) => {
        // Get first execution for initial balance
        const firstExecution = await db
          .select({
            totalBalance: botExecutions.totalBalance,
            accountBalance: botExecutions.accountBalance,
          })
          .from(botExecutions)
          .where(eq(botExecutions.botId, bot.botId))
          .orderBy(botExecutions.executionTime)
          .limit(1)
          .get();

        const initialBalance = firstExecution?.totalBalance ?? firstExecution?.accountBalance ?? 10000;

        // Get all closed trades for max drawdown calculation
        const closedTrades = await db
          .select({
            realizedPnl: tradeHistory.realizedPnl,
          })
          .from(tradeHistory)
          .where(and(eq(tradeHistory.botId, bot.botId), eq(tradeHistory.status, 'CLOSED')))
          .orderBy(tradeHistory.closedAt)
          .all();

        const maxDrawdown = calculateMaxDrawdown(closedTrades);

        // Calculate performance score
        const scoreResult = calculatePerformanceScore({
          totalPnl: bot.totalPnl,
          initialBalance,
          maxDrawdown,
          totalTrades: bot.totalTrades,
        });

        return {
          botId: bot.botId,
          botName: bot.botName,
          aiModel: bot.aiModel || 'Unknown',
          walletAddress: userMap.get(bot.userId) || '',
          totalPnl: bot.totalPnl,
          totalPnlPercent: scoreResult.totalPnlPercent,
          maxDrawdown,
          maxDrawdownPercent: scoreResult.maxDrawdownPercent,
          winRate: bot.totalTrades > 0 ? (bot.winningTrades / bot.totalTrades) * 100 : 0,
          totalTrades: bot.totalTrades,
          performanceScore: scoreResult.score,
          qualifies: scoreResult.qualifies,
        };
      })
    );

    // Group by AI model and get top bot for each (only qualified bots)
    const byModel: Record<string, any> = {};

    for (const bot of botsWithScores) {
      if (!bot.qualifies) continue;

      const aiModel = bot.aiModel;

      if (!byModel[aiModel] || bot.performanceScore > byModel[aiModel].performanceScore) {
        byModel[aiModel] = bot;
      }
    }

    return c.json({
      success: true,
      data: {
        byModel,
        formula: getPerformanceScoreFormula(),
        minTradesToQualify: MIN_TRADES_TO_QUALIFY,
      },
    });
  } catch (error) {
    console.error('Get top by model error:', error);
    return c.json({ success: false, error: 'Failed to get top bots by model' }, 500);
  }
});

/**
 * Get all trading bots from all users (public endpoint)
 * GET /api/public/all-bots
 */
publicRoutes.get('/all-bots', async (c) => {
  const db = getDb(c.env.DB);

  try {
    // Get all bots (active and running)
    const bots = await db.query.tradingBots.findMany();

    return c.json({ success: true, data: bots });
  } catch (error) {
    console.error('Get all bots error:', error);
    return c.json({ success: false, error: 'Failed to get all bots' }, 500);
  }
});

/**
 * Get recent completed trades from all bots (public endpoint)
 * GET /api/public/all-trades?limit=50
 */
publicRoutes.get('/all-trades', async (c) => {
  const limitParam = c.req.query('limit') || '50';
  const limit = Math.min(parseInt(limitParam, 10) || 50, 200);

  const db = getDb(c.env.DB);

  try {
    // Get recent closed trades from all bots
    const trades = await db.query.tradeHistory.findMany({
      where: eq(tradeHistory.status, 'CLOSED'),
      orderBy: desc(tradeHistory.closedAt),
      limit,
    });

    return c.json({ success: true, data: trades });
  } catch (error) {
    console.error('Get all trades error:', error);
    return c.json({ success: false, error: 'Failed to get all trades' }, 500);
  }
});

/**
 * Get current open positions from all bots (public endpoint)
 * GET /api/public/all-positions
 */
publicRoutes.get('/all-positions', async (c) => {
  const db = getDb(c.env.DB);

  try {
    // Get all position snapshots
    const allSnapshots = await db.query.positionSnapshots.findMany({
      orderBy: desc(positionSnapshots.snapshotTime),
    });

    // Group by botId + symbol to get latest snapshot for each position
    const latestByBotSymbol = new Map<string, typeof allSnapshots[0]>();

    for (const snapshot of allSnapshots) {
      const key = `${snapshot.botId}-${snapshot.symbol}`;
      if (!latestByBotSymbol.has(key)) {
        latestByBotSymbol.set(key, snapshot);
      }
    }

    const positions = Array.from(latestByBotSymbol.values());

    // Enrich with entry time and side from open trades
    const positionsWithEntryTime = await Promise.all(
      positions.map(async (pos) => {
        if (pos.tradeId) {
          const trade = await db.query.tradeHistory.findFirst({
            where: eq(tradeHistory.id, pos.tradeId),
          });
          return {
            ...pos,
            entryTime: trade?.openedAt ?? null,
            side: trade?.side ?? null,
          };
        }
        return { ...pos, entryTime: null, side: null };
      })
    );

    return c.json({ success: true, data: positionsWithEntryTime });
  } catch (error) {
    console.error('Get all positions error:', error);
    return c.json({ success: false, error: 'Failed to get all positions' }, 500);
  }
});

/**
 * Get recent bot execution history from all bots (public endpoint)
 * GET /api/public/all-executions?limit=50
 */
publicRoutes.get('/all-executions', async (c) => {
  const limitParam = c.req.query('limit') || '50';
  const limit = Math.min(parseInt(limitParam, 10) || 50, 200);

  const db = getDb(c.env.DB);

  try {
    // Get recent executions from all bots
    const executions = await db.query.botExecutions.findMany({
      orderBy: desc(botExecutions.executionTime),
      limit,
    });

    return c.json({ success: true, data: executions });
  } catch (error) {
    console.error('Get all executions error:', error);
    return c.json({ success: false, error: 'Failed to get all executions' }, 500);
  }
});

/**
 * Get latest performance data for all bots (public endpoint)
 * GET /api/public/all-bot-performance/latest
 */
publicRoutes.get('/all-bot-performance/latest', async (c) => {
  const db = getDb(c.env.DB);

  try {
    // Get all bots
    const bots = await db.query.tradingBots.findMany();

    if (bots.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const botIds = bots.map(b => b.id);

    // Get latest execution for each bot
    const latestExecutions = await Promise.all(
      botIds.map(async (botId) => {
        const execution = await db.query.botExecutions.findFirst({
          where: eq(botExecutions.botId, botId),
          orderBy: desc(botExecutions.executionTime),
        });
        return execution;
      })
    );

    // Filter out nulls and return
    const validExecutions = latestExecutions.filter(e => e !== undefined);

    return c.json({ success: true, data: validExecutions });
  } catch (error) {
    console.error('Get all bot performance error:', error);
    return c.json({ success: false, error: 'Failed to get all bot performance' }, 500);
  }
});

/**
 * Get performance history for a specific bot (all public bots, no wallet filter) with intelligent aggregation
 * GET /api/public/all-bot-performance/:botId/history?limit=100
 * Use limit=0 to fetch all records with automatic aggregation
 * Use aggregate=false to disable aggregation and get raw data
 */
publicRoutes.get('/all-bot-performance/:botId/history', async (c) => {
  const botId = c.req.param('botId');
  const limitParam = c.req.query('limit') || '100';
  const limit = parseInt(limitParam);
  const disableAggregation = c.req.query('aggregate') === 'false';
  const db = getDb(c.env.DB);

  try {
    // Fetch all execution records for this bot (ordered by time ascending for aggregation)
    const allRecords = await db
      .select({
        id: botExecutions.id,
        botId: botExecutions.botId,
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
  } catch (error) {
    console.error('Get bot performance history error:', error);
    return c.json({ success: false, error: 'Failed to get bot performance history' }, 500);
  }
});

/**
 * Get initial balance for a specific bot (all public bots, no wallet filter)
 * GET /api/public/all-bot-performance/:botId/initial-balance
 */
publicRoutes.get('/all-bot-performance/:botId/initial-balance', async (c) => {
  const botId = c.req.param('botId');
  const db = getDb(c.env.DB);

  try {
    const firstExecution = await db.query.botExecutions.findFirst({
      where: eq(botExecutions.botId, botId),
      orderBy: botExecutions.executionTime,
    });

    const initialBalance = firstExecution?.accountBalance ?? 10000;

    return c.json({ success: true, data: { initialBalance } });
  } catch (error) {
    console.error('Get bot initial balance error:', error);
    return c.json({ success: false, error: 'Failed to get bot initial balance' }, 500);
  }
});

