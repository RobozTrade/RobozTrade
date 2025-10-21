import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { apiKeys } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/crypto';

const createApiKeySchema = z.object({
  apiKey: z.string(),
  apiSecret: z.string(),
  label: z.string(),
});

export const apiKeysRoutes = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string } }>();

apiKeysRoutes.use('/*', authMiddleware);

// Get all API keys for user
apiKeysRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const db = getDb(c.env.DB);

  try {
    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, userId),
    });

    // Don't return the actual keys, just metadata
    const sanitized = keys.map((key) => ({
      id: key.id,
      userId: key.userId,
      label: key.label,
      isActive: key.isActive,
      createdAt: key.createdAt,
    }));

    return c.json({ success: true, data: sanitized });
  } catch (error) {
    console.error('Get API keys error:', error);
    return c.json({ success: false, error: 'Failed to get API keys' }, 500);
  }
});

// Create API key
apiKeysRoutes.post('/', zValidator('json', createApiKeySchema), async (c) => {
  const userId = getUserId(c);
  const { apiKey, apiSecret, label } = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    // Encrypt the API credentials
    const encryptedKey = await encrypt(apiKey, c.env.JWT_SECRET);
    const encryptedSecret = await encrypt(apiSecret, c.env.JWT_SECRET);

    const keyId = nanoid();
    await db.insert(apiKeys).values({
      id: keyId,
      userId,
      apiKey: encryptedKey,
      apiSecret: encryptedSecret,
      label,
      isActive: true,
    });

    const key = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, keyId),
    });

    // Return without sensitive data
    return c.json({
      success: true,
      data: {
        id: key!.id,
        userId: key!.userId,
        label: key!.label,
        isActive: key!.isActive,
        createdAt: key!.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('Create API key error:', error);
    return c.json({ success: false, error: 'Failed to create API key' }, 500);
  }
});

// Toggle API key active status
apiKeysRoutes.patch('/:id/toggle', async (c) => {
  const userId = getUserId(c);
  const keyId = c.req.param('id');
  const db = getDb(c.env.DB);

  try {
    const key = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)),
    });

    if (!key) {
      return c.json({ success: false, error: 'API key not found' }, 404);
    }

    await db
      .update(apiKeys)
      .set({ isActive: !key.isActive })
      .where(eq(apiKeys.id, keyId));

    return c.json({ success: true, message: 'API key updated' });
  } catch (error) {
    console.error('Toggle API key error:', error);
    return c.json({ success: false, error: 'Failed to update API key' }, 500);
  }
});

// Delete API key
apiKeysRoutes.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const keyId = c.req.param('id');
  const db = getDb(c.env.DB);

  try {
    const key = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)),
    });

    if (!key) {
      return c.json({ success: false, error: 'API key not found' }, 404);
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));

    return c.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    console.error('Delete API key error:', error);
    return c.json({ success: false, error: 'Failed to delete API key' }, 500);
  }
});

