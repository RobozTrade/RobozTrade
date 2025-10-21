import { Context, Next } from 'hono';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const identifier = c.req.header('CF-Connecting-IP') || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(identifier);

    if (!record || now > record.resetTime) {
      requestCounts.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      await next();
      return;
    }

    if (record.count >= config.maxRequests) {
      return c.json(
        {
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
        429
      );
    }

    record.count++;
    await next();
  };
}

