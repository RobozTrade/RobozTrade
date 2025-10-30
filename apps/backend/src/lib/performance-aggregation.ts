/**
 * Performance Data Aggregation Utilities
 * Provides intelligent data aggregation for bot performance history
 * to optimize chart rendering and data transfer while maintaining visual accuracy
 */

import { sql } from 'drizzle-orm';

export interface AggregationInterval {
  name: string;
  seconds: number;
  sqliteFormat: string; // SQLite strftime format for bucketing
}

export interface AggregationMetadata {
  interval: string;
  intervalSeconds: number;
  totalRecords: number;
  aggregatedPoints: number;
  timeSpanDays: number;
  firstExecutionTime: string | null;
  lastExecutionTime: string | null;
}

export interface AggregatedHistoryResponse {
  history: any[];
  metadata: AggregationMetadata;
}

// Define available aggregation intervals
const INTERVALS: Record<string, AggregationInterval> = {
  RAW: { name: 'raw', seconds: 0, sqliteFormat: '' },
  HOUR_1: { name: '1h', seconds: 3600, sqliteFormat: '%Y-%m-%d %H:00:00' },
  HOUR_6: { name: '6h', seconds: 21600, sqliteFormat: '%Y-%m-%d %H:00:00' }, // Will need custom logic
  DAY_1: { name: '1d', seconds: 86400, sqliteFormat: '%Y-%m-%d' },
  WEEK_1: { name: '1w', seconds: 604800, sqliteFormat: '%Y-W%W' },
  MONTH_1: { name: '1M', seconds: 2592000, sqliteFormat: '%Y-%m' },
};

const TARGET_MIN_POINTS = 200;
const TARGET_MAX_POINTS = 500;
const MIN_RECORDS_FOR_AGGREGATION = 50;

/**
 * Determine the optimal aggregation interval based on time span and record count
 */
export function determineAggregationInterval(
  totalRecords: number,
  timeSpanSeconds: number
): AggregationInterval {
  // If very few records, return raw data
  if (totalRecords < MIN_RECORDS_FOR_AGGREGATION) {
    return INTERVALS.RAW;
  }

  const timeSpanDays = timeSpanSeconds / 86400;

  // Calculate how many points we'd get with each interval
  let selectedInterval = INTERVALS.RAW;

  if (timeSpanDays <= 7) {
    // Up to 7 days: use 1-hour intervals if needed
    const pointsWithHourly = timeSpanDays * 24;
    selectedInterval = pointsWithHourly > TARGET_MAX_POINTS ? INTERVALS.HOUR_6 : INTERVALS.HOUR_1;
  } else if (timeSpanDays <= 30) {
    // Up to 30 days: use 6-hour or daily intervals
    const pointsWithSixHourly = timeSpanDays * 4;
    selectedInterval = pointsWithSixHourly > TARGET_MAX_POINTS ? INTERVALS.DAY_1 : INTERVALS.HOUR_6;
  } else if (timeSpanDays <= 90) {
    // Up to 90 days: use daily intervals
    selectedInterval = INTERVALS.DAY_1;
  } else if (timeSpanDays <= 365) {
    // Up to 1 year: use weekly intervals
    selectedInterval = INTERVALS.WEEK_1;
  } else {
    // Over 1 year: use monthly intervals
    selectedInterval = INTERVALS.MONTH_1;
  }

  // Verify the selected interval will produce a reasonable number of points
  const estimatedPoints = timeSpanSeconds / selectedInterval.seconds;

  // If still too many points, move to next larger interval
  if (estimatedPoints > TARGET_MAX_POINTS * 2) {
    if (selectedInterval === INTERVALS.HOUR_1) return INTERVALS.HOUR_6;
    if (selectedInterval === INTERVALS.HOUR_6) return INTERVALS.DAY_1;
    if (selectedInterval === INTERVALS.DAY_1) return INTERVALS.WEEK_1;
    if (selectedInterval === INTERVALS.WEEK_1) return INTERVALS.MONTH_1;
  }

  return selectedInterval;
}

/**
 * Build SQLite aggregation query for performance history
 * Returns SQL template for time-bucketed aggregation
 */
export function buildAggregationQuery(interval: AggregationInterval) {
  if (interval.name === 'raw') {
    return null; // No aggregation needed
  }

  // For 6-hour intervals, we need to bucket by 6-hour periods
  if (interval.name === '6h') {
    return {
      timeBucket: sql`datetime((execution_time / 21600) * 21600, 'unixepoch')`,
      groupBy: sql`(execution_time / 21600)`,
    };
  }

  // For other intervals, use strftime
  return {
    timeBucket: sql`strftime(${interval.sqliteFormat}, datetime(execution_time, 'unixepoch'))`,
    groupBy: sql`strftime(${interval.sqliteFormat}, datetime(execution_time, 'unixepoch'))`,
  };
}

/**
 * Calculate aggregation metadata
 */
export function calculateMetadata(
  totalRecords: number,
  aggregatedPoints: number,
  firstExecutionTime: number | null,
  lastExecutionTime: number | null,
  interval: AggregationInterval
): AggregationMetadata {
  const timeSpanSeconds = firstExecutionTime && lastExecutionTime
    ? lastExecutionTime - firstExecutionTime
    : 0;

  const timeSpanDays = timeSpanSeconds / 86400;

  return {
    interval: interval.name,
    intervalSeconds: interval.seconds,
    totalRecords,
    aggregatedPoints,
    timeSpanDays: Math.round(timeSpanDays * 100) / 100,
    firstExecutionTime: firstExecutionTime
      ? new Date(firstExecutionTime * 1000).toISOString()
      : null,
    lastExecutionTime: lastExecutionTime
      ? new Date(lastExecutionTime * 1000).toISOString()
      : null,
  };
}

/**
 * Aggregate execution records in-memory (fallback for complex aggregations)
 * This is used when database-level aggregation is not feasible
 *
 * IMPORTANT: For the first bucket (oldest data), the firstTotalBalance and firstAccountBalance
 * fields preserve the very first balance value, which should be used as the initial balance
 * when calculating performance metrics from aggregated data.
 */
export function aggregateRecordsInMemory(
  records: any[],
  interval: AggregationInterval
): any[] {
  if (interval.name === 'raw' || records.length === 0) {
    return records;
  }

  // Group records by time bucket
  const buckets = new Map<number, any[]>();

  records.forEach((record) => {
    // Normalize timestamp to seconds
    const timestamp = normalizeTimestamp(record.executionTime);
    const bucketKey = Math.floor(timestamp / interval.seconds) * interval.seconds;

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(record);
  });

  // Aggregate each bucket
  const aggregated: any[] = [];

  buckets.forEach((bucketRecords, bucketTimestamp) => {
    const count = bucketRecords.length;

    // Get first and last records in the bucket
    const firstRecord = bucketRecords[0];
    const lastRecord = bucketRecords[bucketRecords.length - 1];

    // For balance fields, use the last (most recent) value in the bucket
    // This ensures we capture the final state at the end of each time period
    const totalBalance = lastRecord.totalBalance || 0;
    const unrealizedPnl = lastRecord.unrealizedPnl || 0;
    const accountBalance = lastRecord.accountBalance || 0;
    const accountExposure = lastRecord.accountExposure || 0;

    // Sum up trades executed across the bucket
    const tradesExecuted = bucketRecords.reduce((sum, r) => sum + (r.tradesExecuted || 0), 0);

    aggregated.push({
      id: `agg_${bucketTimestamp}`,
      executionTime: bucketTimestamp,
      totalBalance: Math.round(totalBalance * 100) / 100,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      accountBalance: Math.round(accountBalance * 100) / 100,
      accountExposure: Math.round(accountExposure * 100) / 100,
      tradesExecuted,
      status: lastRecord.status,
      recordCount: count,
      // Optional: include min/max for volatility visualization
      minTotalBalance: Math.min(...bucketRecords.map(r => r.totalBalance || 0)),
      maxTotalBalance: Math.max(...bucketRecords.map(r => r.totalBalance || 0)),
      minUnrealizedPnl: Math.min(...bucketRecords.map(r => r.unrealizedPnl || 0)),
      maxUnrealizedPnl: Math.max(...bucketRecords.map(r => r.unrealizedPnl || 0)),
      // Store first balance in bucket for accurate initial balance tracking
      // For the first bucket in the aggregated array, these values represent the oldest balance
      firstTotalBalance: firstRecord.totalBalance || 0,
      firstAccountBalance: firstRecord.accountBalance || 0,
    });
  });

  // Sort by timestamp (ascending - oldest first)
  // This ensures aggregated[0] contains the oldest data with firstTotalBalance/firstAccountBalance
  // representing the true initial balance
  return aggregated.sort((a, b) => a.executionTime - b.executionTime);
}

/**
 * Convert executionTime to Unix timestamp in seconds
 * Handles Date objects, millisecond timestamps, and second timestamps
 */
function normalizeTimestamp(executionTime: any): number {
  if (executionTime == null) return 0;

  // If it's a Date object, convert to seconds
  if (executionTime instanceof Date) {
    return Math.floor(executionTime.getTime() / 1000);
  }

  // If it's a number
  if (typeof executionTime === 'number') {
    // Check if it's in milliseconds (> year 2100 in seconds would be > 4102444800)
    // Timestamps > 10000000000 are likely in milliseconds
    if (executionTime > 10000000000) {
      return Math.floor(executionTime / 1000);
    }
    return executionTime;
  }

  // If it's a string, try to parse it
  if (typeof executionTime === 'string') {
    const parsed = new Date(executionTime).getTime();
    return Math.floor(parsed / 1000);
  }

  return 0;
}

/**
 * Get time range from execution records
 */
export function getTimeRange(records: any[]): { first: number | null; last: number | null } {
  if (records.length === 0) {
    return { first: null, last: null };
  }

  const timestamps = records
    .map(r => normalizeTimestamp(r.executionTime))
    .filter(t => t > 0);

  if (timestamps.length === 0) {
    return { first: null, last: null };
  }

  return {
    first: Math.min(...timestamps),
    last: Math.max(...timestamps),
  };
}

