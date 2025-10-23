import { Hono } from 'hono';

/**
 * Legacy auth routes (email/password)
 * This file is kept for backward compatibility but is deprecated.
 * The application now uses wallet-based authentication via /api/auth/wallet
 * See: src/routes/wallet-auth.ts
 */

export const authRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

// Deprecated: Use wallet authentication instead
authRoutes.post('/register', async (c) => {
  return c.json(
    {
      success: false,
      error: 'Email/password authentication is deprecated. Please use wallet authentication at /api/auth/wallet'
    },
    410 // Gone
  );
});

// Deprecated: Use wallet authentication instead
authRoutes.post('/login', async (c) => {
  return c.json(
    {
      success: false,
      error: 'Email/password authentication is deprecated. Please use wallet authentication at /api/auth/wallet'
    },
    410 // Gone
  );
});

