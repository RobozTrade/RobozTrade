import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { tradingBots, apiKeys } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import type { CreateBotInput, UpdateBotInput } from '@roboz-trade/shared-types';

const createBotSchema = z.object({
  apiKeyId: z.string(),
  name: z.string().min(1),
  strategyType: z.enum(['ma_cross', 'rsi', 'bollinger', 'custom']),
  tradingPair: z.string(),
  config: z.object({
    shortPeriod: z.number().optional(),
    longPeriod: z.number().optional(),
    rsiPeriod: z.number().optional(),
    oversoldThreshold: z.number().optional(),
    overboughtThreshold: z.number().optional(),
    period: z.number().optional(),
    standardDeviations: z.number().optional(),
    customLogic: z.string().optional(),
  }),
  riskConfig: z.object({
    maxPositionSize: z.number(),
    stopLossPercentage: z.number(),
    takeProfitPercentage: z.number(),
    maxDailyLoss: z.number(),
    maxOpenTrades: z.number(),
  }),
});

const updateBotSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'stopped']).optional(),
  config: z.any().optional(),
  riskConfig: z.any().optional(),
});

export const botsRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

botsRoutes.use('/*', authMiddleware);

// Get all bots for user
botsRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const db = getDb(c.env.DB);

  try {
    const bots = await db.query.tradingBots.findMany({
      where: eq(tradingBots.userId, userId),
    });

    return c.json({ success: true, data: bots });
  } catch (error) {
    console.error('Get bots error:', error);
    return c.json({ success: false, error: 'Failed to get bots' }, 500);
  }
});

// Get single bot
botsRoutes.get('/:id', async (c) => {
  const userId = getUserId(c);
  const botId = c.req.param('id');
  const db = getDb(c.env.DB);

  try {
    const bot = await db.query.tradingBots.findFirst({
      where: and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)),
    });

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    return c.json({ success: true, data: bot });
  } catch (error) {
    console.error('Get bot error:', error);
    return c.json({ success: false, error: 'Failed to get bot' }, 500);
  }
});

// Create bot
botsRoutes.post('/', zValidator('json', createBotSchema), async (c) => {
  const userId = getUserId(c);
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    // Verify API key belongs to user
    const apiKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, data.apiKeyId), eq(apiKeys.userId, userId)),
    });

    if (!apiKey) {
      return c.json({ success: false, error: 'API key not found' }, 404);
    }

    const botId = nanoid();
    await db.insert(tradingBots).values({
      id: botId,
      userId,
      apiKeyId: data.apiKeyId,
      name: data.name,
      strategyType: data.strategyType,
      tradingPair: data.tradingPair,
      config: data.config,
      riskConfig: data.riskConfig,
      status: 'draft',
    });

    const bot = await db.query.tradingBots.findFirst({
      where: eq(tradingBots.id, botId),
    });

    return c.json({ success: true, data: bot }, 201);
  } catch (error) {
    console.error('Create bot error:', error);
    return c.json({ success: false, error: 'Failed to create bot' }, 500);
  }
});

// Update bot
botsRoutes.patch('/:id', zValidator('json', updateBotSchema), async (c) => {
  const userId = getUserId(c);
  const botId = c.req.param('id');
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    // Verify bot belongs to user
    const existingBot = await db.query.tradingBots.findFirst({
      where: and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)),
    });

    if (!existingBot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    await db
      .update(tradingBots)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tradingBots.id, botId));

    const bot = await db.query.tradingBots.findFirst({
      where: eq(tradingBots.id, botId),
    });

    return c.json({ success: true, data: bot });
  } catch (error) {
    console.error('Update bot error:', error);
    return c.json({ success: false, error: 'Failed to update bot' }, 500);
  }
});

// Delete bot
botsRoutes.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const botId = c.req.param('id');
  const db = getDb(c.env.DB);

  try {
    const bot = await db.query.tradingBots.findFirst({
      where: and(eq(tradingBots.id, botId), eq(tradingBots.userId, userId)),
    });

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    await db.delete(tradingBots).where(eq(tradingBots.id, botId));

    return c.json({ success: true, message: 'Bot deleted' });
  } catch (error) {
    console.error('Delete bot error:', error);
    return c.json({ success: false, error: 'Failed to delete bot' }, 500);
  }
});

