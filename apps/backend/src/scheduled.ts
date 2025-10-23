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
  const startTime = Date.now();

  try {
    const db = getDb(env.DB);
    const iterations = parseInt(env.PBKDF2_ITERATIONS || '100000', 10);

    // Fetch all active bots
    const activeBots = await db
      .select()
      .from(tradingBots)
      .where(eq(tradingBots.status, 'active'))
      .all();

    console.log(`Found ${activeBots.length} active bots`);

    if (activeBots.length === 0) {
      console.log('No active bots to execute');
      return;
    }

    // Execute all bots in parallel (with some concurrency control)
    const results = await Promise.allSettled(
      activeBots.map(bot =>
        executeBot(bot.id, db, env.ENCRYPTION_KEY, iterations)
      )
    );

    // Log results
    let successCount = 0;
    let failureCount = 0;
    let totalTrades = 0;

    results.forEach((result, index) => {
      const botId = activeBots[index].id;

      if (result.status === 'fulfilled') {
        const execution = result.value;
        if (execution.success) {
          successCount++;
          totalTrades += execution.tradesExecuted;
          console.log(`Bot ${botId}: SUCCESS - ${execution.tradesExecuted} trades executed`);
        } else {
          failureCount++;
          console.error(`Bot ${botId}: FAILED - ${execution.errors.join(', ')}`);
        }
      } else {
        failureCount++;
        console.error(`Bot ${botId}: REJECTED - ${result.reason}`);
      }
    });

    const duration = Date.now() - startTime;
    console.log(`Scheduled execution completed in ${duration}ms`);
    console.log(`Results: ${successCount} successful, ${failureCount} failed, ${totalTrades} total trades`);

    // Log rate limit status
    const rateLimitStatus = asterRateLimiter.getStatus();
    console.log('Rate Limit Status:', {
      requests: `${rateLimitStatus.requestsUsed}/${rateLimitStatus.requestsLimit}`,
      ordersMinute: `${rateLimitStatus.ordersUsedMinute}/${rateLimitStatus.ordersLimitMinute}`,
      orders10s: `${rateLimitStatus.ordersUsed10s}/${rateLimitStatus.ordersLimit10s}`,
    });

  } catch (error) {
    console.error('Fatal error in scheduled execution:', error);
    throw error;
  }
}

