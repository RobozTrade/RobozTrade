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
    const timestamp = record.executionTime;
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
    
    // Calculate averages
    const totalBalance = bucketRecords.reduce((sum, r) => sum + (r.totalBalance || 0), 0) / count;
    const unrealizedPnl = bucketRecords.reduce((sum, r) => sum + (r.unrealizedPnl || 0), 0) / count;
    const accountBalance = bucketRecords.reduce((sum, r) => sum + (r.accountBalance || 0), 0) / count;
    const accountExposure = bucketRecords.reduce((sum, r) => sum + (r.accountExposure || 0), 0) / count;
    const tradesExecuted = bucketRecords.reduce((sum, r) => sum + (r.tradesExecuted || 0), 0);
    
    // Get most recent status
    const mostRecentRecord = bucketRecords[bucketRecords.length - 1];
    
    aggregated.push({
      id: `agg_${bucketTimestamp}`,
      executionTime: bucketTimestamp,
      totalBalance: Math.round(totalBalance * 100) / 100,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      accountBalance: Math.round(accountBalance * 100) / 100,
      accountExposure: Math.round(accountExposure * 100) / 100,
      tradesExecuted,
      status: mostRecentRecord.status,
      recordCount: count,
      // Optional: include min/max for volatility visualization
      minTotalBalance: Math.min(...bucketRecords.map(r => r.totalBalance || 0)),
      maxTotalBalance: Math.max(...bucketRecords.map(r => r.totalBalance || 0)),
      minUnrealizedPnl: Math.min(...bucketRecords.map(r => r.unrealizedPnl || 0)),
      maxUnrealizedPnl: Math.max(...bucketRecords.map(r => r.unrealizedPnl || 0)),
    });
  });

  // Sort by timestamp
  return aggregated.sort((a, b) => a.executionTime - b.executionTime);
}

/**
 * Get time range from execution records
 */
export function getTimeRange(records: any[]): { first: number | null; last: number | null } {
  if (records.length === 0) {
    return { first: null, last: null };
  }

  const timestamps = records.map(r => r.executionTime).filter(t => t != null);
  
  if (timestamps.length === 0) {
    return { first: null, last: null };
  }

  return {
    first: Math.min(...timestamps),
    last: Math.max(...timestamps),
  };
}

