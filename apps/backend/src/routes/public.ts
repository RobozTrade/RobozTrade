import { Hono } from 'hono';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { users, tradingBots, tradeHistory, positionSnapshots, botExecutions } from '../db/schema';

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

    // Get trade history for all user's bots
    const trades = await db
      .select()
      .from(tradeHistory)
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

    // Enrich positions with entry time from trade history
    const enrichedPositions = await Promise.all(
      positions.map(async (position) => {
        // Find the open trade for this symbol to get entry time
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
 * Get performance history for a specific bot (public endpoint)
 * GET /api/public/bot-performance/:walletAddress/:botId/history
 */
publicRoutes.get('/bot-performance/:walletAddress/:botId/history', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const botId = c.req.param('botId');
  const limit = parseInt(c.req.query('limit') || '100');
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

    // Verify bot belongs to this user
    const bot = await db
      .select()
      .from(tradingBots)
      .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, user.id)))
      .get();

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    // Get performance history
    const history = await db
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
      .where(eq(botExecutions.botId, botId))
      .orderBy(desc(botExecutions.executionTime))
      .limit(limit)
      .all();

    return c.json({ success: true, data: history });
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
 * Get top performing bots ranked by total P&L (leaderboard)
 * GET /api/public/leaderboard/top-bots?limit=50
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
      .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${tradeHistory.status} = 'CLOSED' THEN ${tradeHistory.realizedPnl} ELSE 0 END), 0)`))
      .limit(limit)
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

    // Format response
    const bots = botsWithStats.map(bot => ({
      botId: bot.botId,
      botName: bot.botName,
      aiModel: bot.aiModel,
      walletAddress: userMap.get(bot.userId) || '',
      totalPnl: bot.totalPnl,
      winRate: bot.totalTrades > 0 ? (bot.winningTrades / bot.totalTrades) * 100 : 0,
      totalTrades: bot.totalTrades,
    }));

    return c.json({ success: true, data: { bots } });
  } catch (error) {
    console.error('Get leaderboard top bots error:', error);
    return c.json({ success: false, error: 'Failed to get leaderboard' }, 500);
  }
});

/**
 * Get top performing bot for each AI model
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
      .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${tradeHistory.status} = 'CLOSED' THEN ${tradeHistory.realizedPnl} ELSE 0 END), 0)`))
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

    // Group by AI model and get top bot for each
    const byModel: Record<string, any> = {};

    for (const bot of botsWithStats) {
      const aiModel = bot.aiModel || 'Unknown';

      if (!byModel[aiModel] || bot.totalPnl > byModel[aiModel].totalPnl) {
        byModel[aiModel] = {
          botId: bot.botId,
          botName: bot.botName,
          walletAddress: userMap.get(bot.userId) || '',
          totalPnl: bot.totalPnl,
          winRate: bot.totalTrades > 0 ? (bot.winningTrades / bot.totalTrades) * 100 : 0,
          totalTrades: bot.totalTrades,
        };
      }
    }

    return c.json({ success: true, data: { byModel } });
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

    // Enrich with entry time from open trades
    const positionsWithEntryTime = await Promise.all(
      positions.map(async (pos) => {
        if (pos.tradeId) {
          const trade = await db.query.tradeHistory.findFirst({
            where: eq(tradeHistory.id, pos.tradeId),
          });
          return { ...pos, entryTime: trade?.openedAt ?? null };
        }
        return { ...pos, entryTime: null };
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
 * Get performance history for a specific bot (all public bots, no wallet filter)
 * GET /api/public/all-bot-performance/:botId/history
 */
publicRoutes.get('/all-bot-performance/:botId/history', async (c) => {
  const botId = c.req.param('botId');
  const limit = parseInt(c.req.query('limit') || '100');
  const db = getDb(c.env.DB);

  try {
    const history = await db.query.botExecutions.findMany({
      where: eq(botExecutions.botId, botId),
      orderBy: desc(botExecutions.executionTime),
      limit: Math.min(limit, 500),
    });

    return c.json({ success: true, data: history });
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

