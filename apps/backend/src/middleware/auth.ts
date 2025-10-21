import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';

export interface AuthEnv {
  JWT_SECRET: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const jwtSecret = c.env.JWT_SECRET;

  try {
    const payload = verify(token, jwtSecret) as JWTPayload;
    c.set('userId', payload.userId);
    c.set('userEmail', payload.email);
    await next();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
}

export function getUserId(c: Context): string {
  const userId = c.get('userId');
  if (!userId) {
    throw new Error('User ID not found in context');
  }
  return userId;
}

