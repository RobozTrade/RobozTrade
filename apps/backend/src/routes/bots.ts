import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { tradingBots, apiKeys, botPayments } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import { encrypt } from '../lib/crypto';
import type { CreateBotInput, CreateBotInputLegacy, UpdateBotInput } from '@roboz-trade/shared-types';

// New bot creation schema with payment and direct API keys
const createBotSchema = z.object({
  paymentTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  asterApiKey: z.string().min(1),
  asterApiSecret: z.string().min(1),
  openRouterApiKey: z.string().min(1),
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
    maxLeverage: z.number().optional(),
    maxMarginPerTrade: z.number().optional(),
    profitFactorThreshold: z.number().optional(),
  }),
});

// Legacy bot creation schema (for backward compatibility)
const createBotSchemaLegacy = z.object({
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

// Create bot (new flow with payment validation)
botsRoutes.post('/', async (c) => {
  const userId = getUserId(c);
  const db = getDb(c.env.DB);

  try {
    const body = await c.req.json();

    // Check if this is the new flow (has paymentTxHash) or legacy flow (has apiKeyId)
    if ('paymentTxHash' in body) {
      // New flow with payment validation
      const validation = createBotSchema.safeParse(body);

      if (!validation.success) {
        return c.json({
          success: false,
          error: 'Invalid input',
          details: validation.error.errors
        }, 400);
      }

      const data = validation.data;

      // Verify payment exists and is confirmed
      const payment = await db.query.botPayments.findFirst({
        where: and(
          eq(botPayments.txHash, data.paymentTxHash),
          eq(botPayments.userId, userId),
          eq(botPayments.status, 'confirmed')
        ),
      });

      if (!payment) {
        return c.json({
          success: false,
          error: 'Payment not found or not confirmed. Please complete payment first.'
        }, 400);
      }

      // Check if payment is already used for another bot
      if (payment.botId) {
        return c.json({
          success: false,
          error: 'This payment has already been used for another bot'
        }, 400);
      }

      // Encrypt API keys
      const encryptedAsterKey = await encrypt(data.asterApiKey, c.env.JWT_SECRET);
      const encryptedAsterSecret = await encrypt(data.asterApiSecret, c.env.JWT_SECRET);
      const encryptedOpenRouterKey = await encrypt(data.openRouterApiKey, c.env.JWT_SECRET);

      const botId = nanoid();

      // Create bot with encrypted API keys
      await db.insert(tradingBots).values({
        id: botId,
        userId,
        apiKeyId: null,
        asterApiKey: encryptedAsterKey,
        asterApiSecret: encryptedAsterSecret,
        openRouterApiKey: encryptedOpenRouterKey,
        name: data.name,
        strategyType: data.strategyType,
        tradingPair: data.tradingPair,
        config: data.config,
        riskConfig: data.riskConfig,
        status: 'draft',
      });

      // Link payment to bot
      await db
        .update(botPayments)
        .set({ botId })
        .where(eq(botPayments.id, payment.id));

      const bot = await db.query.tradingBots.findFirst({
        where: eq(tradingBots.id, botId),
      });

      // Remove sensitive data from response
      const sanitizedBot = {
        ...bot,
        asterApiKey: undefined,
        asterApiSecret: undefined,
        openRouterApiKey: undefined,
      };

      return c.json({ success: true, data: sanitizedBot }, 201);

    } else {
      // Legacy flow with existing API key
      const validation = createBotSchemaLegacy.safeParse(body);

      if (!validation.success) {
        return c.json({
          success: false,
          error: 'Invalid input',
          details: validation.error.errors
        }, 400);
      }

      const data = validation.data;

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
    }
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

