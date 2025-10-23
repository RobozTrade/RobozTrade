/**
 * Cloudflare Workers Scheduled Event Handler
 * Runs trading bots every 2 minutes
 */

import { eq } from 'drizzle-orm';
import { getDb } from './lib/db';
import { tradingBots } from './db/schema';
import { executeBot } from './services/bot-executor';
import { asterRateLimiter } from './services/rate-limiter';

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
}

export interface ScheduledExecutionSummary {
  totalBots: number;
  successCount: number;
  failureCount: number;
  totalTrades: number;
  durationMs: number;
  details: ScheduledExecutionDetail[];
  rateLimit: ReturnType<typeof asterRateLimiter.getStatus>;
}

export async function runScheduledExecution(env: Env): Promise<ScheduledExecutionSummary> {
  const startTime = Date.now();
  const db = getDb(env.DB);
  const iterations = parseInt(env.PBKDF2_ITERATIONS || '100000', 10);

  const activeBots = await db
    .select()
    .from(tradingBots)
    .where(eq(tradingBots.status, 'active'))
    .all();

  if (activeBots.length === 0) {
    const durationMs = Date.now() - startTime;
    const rateLimitStatus = asterRateLimiter.getStatus();
    return {
      totalBots: 0,
      successCount: 0,
      failureCount: 0,
      totalTrades: 0,
      durationMs,
      details: [],
      rateLimit: rateLimitStatus,
    };
  }

  const results = await Promise.allSettled(
    activeBots.map(bot => executeBot(bot.id, db, env.ENCRYPTION_KEY, iterations))
  );

  let successCount = 0;
  let failureCount = 0;
  let totalTrades = 0;

  const details: ScheduledExecutionDetail[] = results.map((result, index) => {
    const botId = activeBots[index].id;

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
    successCount,
    failureCount,
    totalTrades,
    durationMs,
    details,
    rateLimit: rateLimitStatus,
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
    const summary = await runScheduledExecution(env);

    console.log(`Found ${summary.totalBots} active bots`);
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

