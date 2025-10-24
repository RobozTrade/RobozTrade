/**
 * Cloudflare Workers Scheduled Event Handler
 * Runs trading bots every 2 minutes
 */

import { asc, eq } from 'drizzle-orm';
import { getDb } from './lib/db';
import { tradingBots } from './db/schema';
import { executeBot } from './services/bot-executor';
import { asterRateLimiter } from './services/rate-limiter';

const BOT_BATCH_SIZE = 100;
const CRON_INTERVAL_MINUTES = 2;
const CRON_INTERVAL_MS = CRON_INTERVAL_MINUTES * 60 * 1000;

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

  const results = await Promise.allSettled(
    botsToProcess.map(bot => executeBot(bot.id, db, env.ENCRYPTION_KEY, iterations))
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

