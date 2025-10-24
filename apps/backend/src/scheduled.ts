/**
 * Cloudflare Workers Scheduled Event Handler
 * Runs trading bots every 2 minutes
 */

import { asc, eq } from 'drizzle-orm';
import { getDb } from './lib/db';
import { tradingBots, apiKeys } from './db/schema';
import { executeBot, type SharedMarketDataCache } from './services/bot-executor';
import { asterRateLimiter } from './services/rate-limiter';
import { decrypt } from './lib/crypto';
import * as AsterAPI from './services/aster-api';

const BOT_BATCH_SIZE = 100;
const CRON_INTERVAL_MINUTES = 2;
const CRON_INTERVAL_MS = CRON_INTERVAL_MINUTES * 60 * 1000;

/**
 * Build shared market data cache for all unique symbols across bots
 * This dramatically reduces API calls by fetching each symbol's data only once
 */
async function buildSharedMarketDataCache(
  bots: any[],
  env: Env
): Promise<SharedMarketDataCache | null> {
  try {
    // Collect all unique symbols from all bots
    const allSymbols = new Set<string>();
    for (const bot of bots) {
      const symbols = (bot.tradingSymbols as string[]) || [];
      symbols.forEach(symbol => allSymbols.add(symbol));
    }

    if (allSymbols.size === 0) {
      return null;
    }

    console.log(`Building shared cache for ${allSymbols.size} unique symbols: ${Array.from(allSymbols).join(', ')}`);

    // Get credentials from the first bot (we need any valid credentials to fetch public market data)
    // Note: Market data endpoints don't require authentication, but we use credentials for consistency
    const firstBot = bots[0];
    if (!firstBot) {
      return null;
    }

    const db = getDb(env.DB);
    const iterations = parseInt(env.PBKDF2_ITERATIONS || '100000', 10);

    // Resolve credentials from first bot
    let asterApiKey: string | null = null;
    let asterApiSecret: string | null = null;

    if (firstBot.asterApiKey && firstBot.asterApiSecret) {
      asterApiKey = await decrypt(firstBot.asterApiKey, env.ENCRYPTION_KEY, iterations);
      asterApiSecret = await decrypt(firstBot.asterApiSecret, env.ENCRYPTION_KEY, iterations);
    }

    if ((!asterApiKey || !asterApiSecret) && firstBot.apiKeyId) {
      const apiKeyRecord = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, firstBot.apiKeyId))
        .get();

      if (apiKeyRecord) {
        asterApiKey = await decrypt(apiKeyRecord.apiKey, env.ENCRYPTION_KEY, iterations);
        asterApiSecret = await decrypt(apiKeyRecord.apiSecret, env.ENCRYPTION_KEY, iterations);
      }
    }

    if (!asterApiKey || !asterApiSecret) {
      console.warn('No valid credentials found for building shared cache');
      return null;
    }

    const credentials: AsterAPI.AsterCredentials = {
      apiKey: asterApiKey,
      apiSecret: asterApiSecret,
    };

    // Fetch symbol metadata once
    const symbolMetadata = await AsterAPI.getSymbolMetadata(credentials);

    // Fetch market data for all symbols in parallel
    const marketDataPromises = Array.from(allSymbols).map(async (symbol) => {
      try {
        const marketData = await AsterAPI.getMarketData(symbol, credentials);
        const intradayCandles = await AsterAPI.getCandles(symbol, '15m', 120, credentials);
        const higherTimeframeCandles = await AsterAPI.getCandles(symbol, '4h', 120, credentials);
        return { symbol, marketData, intradayCandles, higherTimeframeCandles };
      } catch (error: any) {
        console.error(`Error fetching data for ${symbol}:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(marketDataPromises);

    // Build cache maps
    const marketDataMap = new Map<string, AsterAPI.MarketData>();
    const intradayCandlesMap = new Map<string, AsterAPI.Candle[]>();
    const higherTimeframeCandlesMap = new Map<string, AsterAPI.Candle[]>();

    for (const result of results) {
      if (result) {
        marketDataMap.set(result.symbol, result.marketData);
        intradayCandlesMap.set(result.symbol, result.intradayCandles);
        higherTimeframeCandlesMap.set(result.symbol, result.higherTimeframeCandles);
      }
    }

    console.log(`Shared cache built successfully: ${marketDataMap.size}/${allSymbols.size} symbols cached`);

    return {
      symbolMetadata,
      marketData: marketDataMap,
      intradayCandles: intradayCandlesMap,
      higherTimeframeCandles: higherTimeframeCandlesMap,
    };
  } catch (error: any) {
    console.error('Error building shared market data cache:', error.message);
    return null;
  }
}

export interface Env {
  DB: D1Database;
  ENCRYPTION_KEY: string;
  PBKDF2_ITERATIONS?: string;
  APP_RUNTIME_ENV?: string;
}

export interface ScheduledExecutionDetail {
  botId: string;
  success: boolean;
  tradesExecuted: number;
  errors: string[];
  aiDecisions?: any[];
  aiPrompt?: string | null;
  aiRawResponse?: string | null;
  aiThinking?: string | null;
  aiRuntimeMs?: number | null;
  aiInvocations?: number | null;
}

export interface ScheduledExecutionBatchInfo {
  batchIndex: number;
  totalBatches: number;
  batchSize: number;
}

export interface ScheduledExecutionSummary {
  totalBots: number;
  processedBots: number;
  successCount: number;
  failureCount: number;
  totalTrades: number;
  durationMs: number;
  details: ScheduledExecutionDetail[];
  rateLimit: ReturnType<typeof asterRateLimiter.getStatus>;
  batch?: ScheduledExecutionBatchInfo;
}

export async function runScheduledExecution(
  env: Env,
  options: { scheduledTime?: number } = {}
): Promise<ScheduledExecutionSummary> {
  const startTime = Date.now();
  const db = getDb(env.DB);
  const iterations = parseInt(env.PBKDF2_ITERATIONS || '100000', 10);

  const activeBots = await db
    .select()
    .from(tradingBots)
    .where(eq(tradingBots.status, 'active'))
    .orderBy(asc(tradingBots.createdAt), asc(tradingBots.id))
    .all();

  if (activeBots.length === 0) {
    const durationMs = Date.now() - startTime;
    const rateLimitStatus = asterRateLimiter.getStatus();
    return {
      totalBots: 0,
      processedBots: 0,
      successCount: 0,
      failureCount: 0,
      totalTrades: 0,
      durationMs,
      details: [],
      rateLimit: rateLimitStatus,
    };
  }

  let botsToProcess = activeBots;
  let batchInfo: ScheduledExecutionBatchInfo | undefined;

  if (activeBots.length > BOT_BATCH_SIZE) {
    const totalBatches = Math.ceil(activeBots.length / BOT_BATCH_SIZE);
    const referenceTime = options.scheduledTime ?? Date.now();
    const runIndex = Math.floor(referenceTime / CRON_INTERVAL_MS);
    // Rotate through batches deterministically using the scheduled run index
    const batchIndex = runIndex % totalBatches;
    const start = batchIndex * BOT_BATCH_SIZE;
    const end = Math.min(start + BOT_BATCH_SIZE, activeBots.length);
    botsToProcess = activeBots.slice(start, end);
    batchInfo = {
      batchIndex,
      totalBatches,
      batchSize: BOT_BATCH_SIZE,
    };
  }

  // Build shared market data cache to reduce API calls
  // This fetches each unique symbol's data only once, shared across all bots
  const sharedCache = await buildSharedMarketDataCache(botsToProcess, env);

  if (sharedCache) {
    console.log(`Using shared cache - saved ${(botsToProcess.length - 1) * sharedCache.marketData.size * 3} API calls`);
  } else {
    console.log('Shared cache not available - bots will fetch data individually');
  }

  const results = await Promise.allSettled(
    botsToProcess.map(bot => executeBot(bot.id, db, env.ENCRYPTION_KEY, iterations, sharedCache || undefined))
  );

  let successCount = 0;
  let failureCount = 0;
  let totalTrades = 0;

  const details: ScheduledExecutionDetail[] = results.map((result, index) => {
    const botId = botsToProcess[index].id;

    if (result.status === 'fulfilled') {
      const execution = result.value;

      if (execution.success) {
        successCount++;
      } else {
        failureCount++;
      }
      totalTrades += execution.tradesExecuted;

      return {
        botId,
        success: execution.success,
        tradesExecuted: execution.tradesExecuted,
        errors: execution.errors,
        aiDecisions: execution.decisions,
        aiPrompt: execution.aiPrompt,
        aiRawResponse: execution.aiRawResponse,
        aiThinking: execution.aiThinking,
        aiRuntimeMs: execution.aiRuntimeMs,
        aiInvocations: execution.aiInvocations,
      };
    }

    failureCount++;
    return {
      botId,
      success: false,
      tradesExecuted: 0,
      errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
    };
  });

  const durationMs = Date.now() - startTime;
  const rateLimitStatus = asterRateLimiter.getStatus();

  return {
    totalBots: activeBots.length,
    processedBots: botsToProcess.length,
    successCount,
    failureCount,
    totalTrades,
    durationMs,
    details,
    rateLimit: rateLimitStatus,
    batch: batchInfo,
  };
}

/**
 * Scheduled event handler - runs every 2 minutes
 * Configure in wrangler.toml:
 * [triggers]
 * crons = ["star-slash-2 star star star star"]
 */
export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('Starting scheduled trading bot execution...');
  try {
    const summary = await runScheduledExecution(env, { scheduledTime: event.scheduledTime });

    console.log(`Found ${summary.totalBots} active bots`);
    if (summary.batch) {
      console.log(
        `Processing batch ${summary.batch.batchIndex + 1}/${summary.batch.totalBatches} (${summary.processedBots} bots this run)`
      );
    } else {
      console.log(`Processing ${summary.processedBots} bots this run`);
    }
    console.log(`Scheduled execution completed in ${summary.durationMs}ms`);
    console.log(
      `Results: ${summary.successCount} successful, ${summary.failureCount} failed, ${summary.totalTrades} total trades`
    );

    summary.details.forEach(detail => {
      if (detail.success) {
        console.log(`Bot ${detail.botId}: SUCCESS - ${detail.tradesExecuted} trades executed`);
      } else {
        console.error(`Bot ${detail.botId}: FAILED - ${detail.errors.join(', ')}`);
      }
    });

    console.log('Rate Limit Status:', {
      requests: `${summary.rateLimit.requestsUsed}/${summary.rateLimit.requestsLimit}`,
      ordersMinute: `${summary.rateLimit.ordersUsedMinute}/${summary.rateLimit.ordersLimitMinute}`,
      orders10s: `${summary.rateLimit.ordersUsed10s}/${summary.rateLimit.ordersLimit10s}`,
    });

  } catch (error) {
    console.error('Fatal error in scheduled execution:', error);
    throw error;
  }
}

