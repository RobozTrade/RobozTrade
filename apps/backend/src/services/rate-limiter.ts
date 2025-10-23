/**
 * Rate Limiter for Aster DEX API
 * 
 * Aster DEX Rate Limits:
 * - REQUEST_WEIGHT: 2400 per minute
 * - ORDERS: 1200 per minute
 * - ORDERS: 300 per 10 seconds
 */

interface RateLimitConfig {
  requestsPerMinute: number;
  ordersPerMinute: number;
  ordersPer10Seconds: number;
}

interface RateLimitState {
  requestCount: number;
  orderCount: number;
  orderCount10s: number;
  lastResetMinute: number;
  lastReset10s: number;
}

class AsterRateLimiter {
  private config: RateLimitConfig = {
    requestsPerMinute: 2400,
    ordersPerMinute: 1200,
    ordersPer10Seconds: 300,
  };

  private state: RateLimitState = {
    requestCount: 0,
    orderCount: 0,
    orderCount10s: 0,
    lastResetMinute: Date.now(),
    lastReset10s: Date.now(),
  };

  // Add safety margin (use 80% of limits to be conservative)
  private readonly SAFETY_MARGIN = 0.8;

  /**
   * Reset counters if time windows have passed
   */
  private resetIfNeeded(): void {
    const now = Date.now();

    // Reset minute counters
    if (now - this.state.lastResetMinute >= 60000) {
      this.state.requestCount = 0;
      this.state.orderCount = 0;
      this.state.lastResetMinute = now;
    }

    // Reset 10-second counter
    if (now - this.state.lastReset10s >= 10000) {
      this.state.orderCount10s = 0;
      this.state.lastReset10s = now;
    }
  }

  /**
   * Check if we can make a request
   */
  canMakeRequest(isOrderRequest: boolean = false): boolean {
    this.resetIfNeeded();

    const requestLimit = this.config.requestsPerMinute * this.SAFETY_MARGIN;
    const orderLimitMinute = this.config.ordersPerMinute * this.SAFETY_MARGIN;
    const orderLimit10s = this.config.ordersPer10Seconds * this.SAFETY_MARGIN;

    // Check request weight limit
    if (this.state.requestCount >= requestLimit) {
      return false;
    }

    // Check order limits if this is an order request
    if (isOrderRequest) {
      if (this.state.orderCount >= orderLimitMinute) {
        return false;
      }
      if (this.state.orderCount10s >= orderLimit10s) {
        return false;
      }
    }

    return true;
  }

  /**
   * Wait until we can make a request
   */
  async waitForSlot(isOrderRequest: boolean = false): Promise<void> {
    while (!this.canMakeRequest(isOrderRequest)) {
      // Wait 100ms and check again
      await new Promise(resolve => setTimeout(resolve, 100));
      this.resetIfNeeded();
    }
  }

  /**
   * Record a request
   */
  recordRequest(isOrderRequest: boolean = false): void {
    this.resetIfNeeded();
    this.state.requestCount++;

    if (isOrderRequest) {
      this.state.orderCount++;
      this.state.orderCount10s++;
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    requestsUsed: number;
    requestsLimit: number;
    ordersUsedMinute: number;
    ordersLimitMinute: number;
    ordersUsed10s: number;
    ordersLimit10s: number;
    timeUntilResetMinute: number;
    timeUntilReset10s: number;
  } {
    this.resetIfNeeded();
    const now = Date.now();

    return {
      requestsUsed: this.state.requestCount,
      requestsLimit: Math.floor(this.config.requestsPerMinute * this.SAFETY_MARGIN),
      ordersUsedMinute: this.state.orderCount,
      ordersLimitMinute: Math.floor(this.config.ordersPerMinute * this.SAFETY_MARGIN),
      ordersUsed10s: this.state.orderCount10s,
      ordersLimit10s: Math.floor(this.config.ordersPer10Seconds * this.SAFETY_MARGIN),
      timeUntilResetMinute: 60000 - (now - this.state.lastResetMinute),
      timeUntilReset10s: 10000 - (now - this.state.lastReset10s),
    };
  }

  /**
   * Reset all counters (useful for testing)
   */
  reset(): void {
    this.state = {
      requestCount: 0,
      orderCount: 0,
      orderCount10s: 0,
      lastResetMinute: Date.now(),
      lastReset10s: Date.now(),
    };
  }
}

// Global rate limiter instance
export const asterRateLimiter = new AsterRateLimiter();

/**
 * Decorator function to rate limit API calls
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  isOrderRequest: boolean = false
): Promise<T> {
  // Wait for available slot
  await asterRateLimiter.waitForSlot(isOrderRequest);

  // Record the request
  asterRateLimiter.recordRequest(isOrderRequest);

  // Execute the function
  try {
    return await fn();
  } catch (error: any) {
    // Check if error is rate limit related
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      console.warn('Rate limit hit, waiting 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      asterRateLimiter.reset();
      throw error;
    }
    throw error;
  }
}

