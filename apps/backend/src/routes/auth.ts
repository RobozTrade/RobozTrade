import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { hash, compare } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { users } from '../db/schema';
import type { AuthResponse } from '@roboz-trade/shared-types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, displayName } = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return c.json(
        { success: false, error: 'User already exists' },
        400
      );
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Create user
    const userId = nanoid();
    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      displayName,
    });

    // Get created user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate JWT
    const token = sign(
      { userId: user.id, email: user.email },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt!,
      },
      token,
    };

    return c.json({ success: true, data: response });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json(
      { success: false, error: 'Failed to register user' },
      500
    );
  }
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return c.json(
        { success: false, error: 'Invalid credentials' },
        401
      );
    }

    // Verify password
    const isValid = await compare(password, user.passwordHash);

    if (!isValid) {
      return c.json(
        { success: false, error: 'Invalid credentials' },
        401
      );
    }

    // Generate JWT
    const token = sign(
      { userId: user.id, email: user.email },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt!,
      },
      token,
    };

    return c.json({ success: true, data: response });
  } catch (error) {
    console.error('Login error:', error);
    return c.json(
      { success: false, error: 'Failed to login' },
      500
    );
  }
});

