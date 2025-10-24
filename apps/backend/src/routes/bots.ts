import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { tradingBots, apiKeys, botPayments } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import { encrypt } from '../lib/crypto';

// Supported trading symbols
const SUPPORTED_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT', 'UNIUSDT',
  'ATOMUSDT', 'LTCUSDT', 'NEARUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT'
] as const;

// Supported AI models (Latest - October 2025)
const SUPPORTED_AI_MODELS = [
  // OpenAI (Latest - October 2025)
  'openai/gpt-5', 'openai/gpt-5-instant', 'openai/o3',
  // Anthropic (Latest - October 2025)
  'anthropic/claude-4.5-sonnet', 'anthropic/claude-3.5-sonnet',
  // Google (Latest - October 2025)
  'google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'google/gemma-3-27b',
  // Meta Llama (Latest Open Source - October 2025)
  'meta-llama/llama-4-scout-17b', 'meta-llama/llama-4-maverick-17b',
  // DeepSeek (Latest Open Source)
  'deepseek/deepseek-v3.1', 'deepseek/deepseek-r1',
  // Qwen (Latest Open Source)
  'qwen/qwen-2.5-72b-instruct',
  // Mistral (Latest Open Source)
  'mistralai/mistral-large',
  // xAI (Latest - October 2025)
  'x-ai/grok-4',
  // Cohere (Latest)
  'cohere/command-r-plus',
  // Perplexity (Latest)
  'perplexity/llama-3.1-sonar-large-128k-online'
] as const;

// New bot creation schema with payment and direct API keys
const createBotSchema = z.object({
  paymentTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  asterApiKey: z.string().min(1, 'Aster API Key is required'),
  asterApiSecret: z.string().min(1, 'Aster API Secret is required'),
  openRouterApiKey: z.string().min(1, 'OpenRouter API Key is required'),
  name: z.string().min(1, 'Bot name is required').max(100, 'Bot name too long'),
  tradingSymbols: z.array(z.enum(SUPPORTED_SYMBOLS as any))
    .min(1, 'At least one trading symbol is required')
    .max(5, 'Maximum 5 trading symbols allowed'),
  aiModel: z.enum(SUPPORTED_AI_MODELS as any, {
    errorMap: () => ({ message: 'Invalid AI model selected' })
  }),
  customPrompt: z.string().max(10000, 'Custom prompt too long').optional(),
  maxLeverage: z.number()
    .min(1, 'Leverage must be at least 1x')
    .max(20, 'Maximum leverage is 20x'),
  minNotionalPerTrade: z.number()
    .min(150, 'Minimum notional per trade must be at least 150 USDT'),
  maxNotionalPerTrade: z.number()
    .min(150, 'Maximum notional must be at least 150 USDT'),
  maxOpenTrades: z.number()
    .min(1, 'Must allow at least 1 open trade')
    .max(5, 'Maximum 5 open trades allowed'),
}).refine((data) => data.maxNotionalPerTrade >= data.minNotionalPerTrade, {
  message: 'Maximum notional per trade must be greater than or equal to minimum notional',
  path: ['maxNotionalPerTrade'],
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

  // Legacy bot fields
  config: z.any().optional(),
  riskConfig: z.any().optional(),

  // New AI-powered bot fields
  tradingSymbols: z.array(z.string()).optional(),
  // aiModel is NOT allowed to be changed after creation
  customPrompt: z.string().optional(),
  maxLeverage: z.number().min(1).max(125).optional(),
  minNotionalPerTrade: z.number().min(10).optional(),
  maxNotionalPerTrade: z.number().min(10).optional(),
  maxOpenTrades: z.number().min(1).max(10).optional(),
});

type BotBindings = {
  DB: D1Database;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  PBKDF2_ITERATIONS?: string;
};

export const botsRoutes = new Hono<{ Bindings: BotBindings }>();

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

      // Get encryption configuration
      const encryptionKey = c.env.ENCRYPTION_KEY;
      const iterations = parseInt(c.env.PBKDF2_ITERATIONS || '100000', 10);

      // Encrypt API keys
      const encryptedAsterKey = await encrypt(data.asterApiKey, encryptionKey, iterations);
      const encryptedAsterSecret = await encrypt(data.asterApiSecret, encryptionKey, iterations);
      const encryptedOpenRouterKey = await encrypt(data.openRouterApiKey, encryptionKey, iterations);

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
        tradingSymbols: data.tradingSymbols,
        aiModel: data.aiModel,
        customPrompt: data.customPrompt,
        maxLeverage: data.maxLeverage,
        minNotionalPerTrade: data.minNotionalPerTrade,
        maxNotionalPerTrade: data.maxNotionalPerTrade,
        maxOpenTrades: data.maxOpenTrades,
        status: 'draft',
        // Legacy fields - set to null/default for new AI-driven bots
        strategyType: 'custom', // Use 'custom' as default for AI bots
        tradingPair: data.tradingSymbols[0] || 'BTCUSDT', // Use first symbol as primary pair
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

