import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { benchmarkTests } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';

const createBenchmarkSchema = z.object({
  name: z.string(),
  scenarioType: z.enum(['bull_market', 'bear_market', 'sideways', 'high_volatility']),
  botId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export const benchmarksRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

benchmarksRoutes.use('/*', authMiddleware);

// Get all benchmarks for user
benchmarksRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const db = getDb(c.env.DB);

  try {
    const benchmarks = await db.query.benchmarkTests.findMany({
      where: eq(benchmarkTests.userId, userId),
    });

    return c.json({ success: true, data: benchmarks });
  } catch (error) {
    console.error('Get benchmarks error:', error);
    return c.json({ success: false, error: 'Failed to get benchmarks' }, 500);
  }
});

// Get single benchmark
benchmarksRoutes.get('/:id', async (c) => {
  const userId = getUserId(c);
  const benchmarkId = c.req.param('id');
  const db = getDb(c.env.DB);

  try {
    const benchmark = await db.query.benchmarkTests.findFirst({
      where: and(
        eq(benchmarkTests.id, benchmarkId),
        eq(benchmarkTests.userId, userId)
      ),
    });

    if (!benchmark) {
      return c.json({ success: false, error: 'Benchmark not found' }, 404);
    }

    return c.json({ success: true, data: benchmark });
  } catch (error) {
    console.error('Get benchmark error:', error);
    return c.json({ success: false, error: 'Failed to get benchmark' }, 500);
  }
});

// Create benchmark test
benchmarksRoutes.post('/', zValidator('json', createBenchmarkSchema), async (c) => {
  const userId = getUserId(c);
  const data = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    // TODO: Implement actual backtesting logic
    // For now, create a placeholder benchmark
    const benchmarkId = nanoid();
    
    const mockResults = {
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      totalReturn: 0,
      duration: 0,
    };

    await db.insert(benchmarkTests).values({
      id: benchmarkId,
      userId,
      name: data.name,
      scenarioType: data.scenarioType,
      score: null,
      results: mockResults,
    });

    const benchmark = await db.query.benchmarkTests.findFirst({
      where: eq(benchmarkTests.id, benchmarkId),
    });

    return c.json({ success: true, data: benchmark }, 201);
  } catch (error) {
    console.error('Create benchmark error:', error);
    return c.json({ success: false, error: 'Failed to create benchmark' }, 500);
  }
});

// Delete benchmark
benchmarksRoutes.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const benchmarkId = c.req.param('id');
  const db = getDb(c.env.DB);

  try {
    const benchmark = await db.query.benchmarkTests.findFirst({
      where: and(
        eq(benchmarkTests.id, benchmarkId),
        eq(benchmarkTests.userId, userId)
      ),
    });

    if (!benchmark) {
      return c.json({ success: false, error: 'Benchmark not found' }, 404);
    }

    await db.delete(benchmarkTests).where(eq(benchmarkTests.id, benchmarkId));

    return c.json({ success: true, message: 'Benchmark deleted' });
  } catch (error) {
    console.error('Delete benchmark error:', error);
    return c.json({ success: false, error: 'Failed to delete benchmark' }, 500);
  }
});

