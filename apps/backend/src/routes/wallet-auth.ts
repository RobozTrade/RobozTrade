import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sign } from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { eq, and, gt } from 'drizzle-orm';
import { verifyMessage } from 'viem';
import { getDb } from '../lib/db';
import { users, nonces } from '../db/schema';
import type {
  NonceResponse,
  WalletAuthResponse,
  NonceRequest,
  WalletAuthRequest
} from '@roboz-trade/shared-types';

const nonceRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
});

const walletAuthSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  signature: z.string(),
  nonce: z.string(),
  timestamp: z.number(),
  displayName: z.string().min(2).optional(),
});

type WalletAuthBindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const walletAuthRoutes = new Hono<{ Bindings: WalletAuthBindings }>();

// Helper function to verify Ethereum signature using viem
async function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  try {
    // Use viem's verifyMessage to verify the signature
    // verifyMessage returns true if the signature is valid, false otherwise
    const isValid = await verifyMessage({
      address: expectedAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Generate nonce for wallet authentication
walletAuthRoutes.post('/nonce', zValidator('json', nonceRequestSchema), async (c) => {
  const { walletAddress }: NonceRequest = c.req.valid('json');
  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address to lowercase
    const normalizedAddress = walletAddress.toLowerCase();

    // Generate a unique nonce
    const nonce = nanoid(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Clean up expired nonces for this wallet
    const now = new Date();
    await db.delete(nonces)
      .where(
        and(
          eq(nonces.walletAddress, normalizedAddress),
          gt(nonces.expiresAt, now)
        )
      );

    // Generate timestamp
    const timestamp = Date.now();

    // Store the nonce
    await db.insert(nonces).values({
      id: nanoid(),
      walletAddress: normalizedAddress,
      nonce,
      expiresAt,
      used: false,
    });

    // Create the message to sign
    const message = `Sign this message to authenticate with RobozTrade\n\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

    const response: NonceResponse = {
      nonce,
      message,
      timestamp, // Include timestamp so frontend can send it back
    };

    return c.json({ success: true, data: response });
  } catch (error) {
    console.error('Nonce generation error:', error);
    return c.json(
      { success: false, error: 'Failed to generate nonce' },
      500
    );
  }
});

// Verify wallet signature and authenticate
walletAuthRoutes.post('/verify', zValidator('json', walletAuthSchema), async (c) => {
  const {
    walletAddress,
    signature,
    nonce: providedNonce,
    timestamp,
    displayName
  }: WalletAuthRequest = c.req.valid('json');

  const db = getDb(c.env.DB);

  try {
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // 1. Validate timestamp (must be within 5 minutes)
    const now = Date.now();
    const timeDiff = Math.abs(now - timestamp);
    const fiveMinutes = 5 * 60 * 1000;

    if (timeDiff > fiveMinutes) {
      return c.json(
        { success: false, error: 'Signature expired. Please try again.' },
        401
      );
    }

    // 2. Validate nonce exists and hasn't been used
    const nonceRecord = await db.query.nonces.findFirst({
      where: and(
        eq(nonces.nonce, providedNonce),
        eq(nonces.walletAddress, normalizedAddress),
        eq(nonces.used, false)
      ),
    });

    if (!nonceRecord) {
      return c.json(
        { success: false, error: 'Invalid or expired nonce' },
        401
      );
    }

    // Check if nonce has expired
    if (new Date() > nonceRecord.expiresAt) {
      return c.json(
        { success: false, error: 'Nonce has expired' },
        401
      );
    }

    // 3. Verify signature
    const message = `Sign this message to authenticate with RobozTrade\n\nNonce: ${providedNonce}\nTimestamp: ${timestamp}`;

    console.log('=== Signature Verification Debug ===');
    console.log('Message to verify:', message);
    console.log('Signature:', signature);
    console.log('Expected address:', normalizedAddress);
    console.log('Provided nonce:', providedNonce);
    console.log('Timestamp:', timestamp);

    const isValidSignature = await verifySignature(message, signature, normalizedAddress);

    console.log('Signature valid:', isValidSignature);

    if (!isValidSignature) {
      return c.json(
        { success: false, error: 'Invalid signature' },
        401
      );
    }

    // 4. Mark nonce as used
    await db.update(nonces)
      .set({ used: true })
      .where(eq(nonces.id, nonceRecord.id));

    // 5. Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalizedAddress),
    });

    let isNewUser = false;

    // 6. If user doesn't exist, create new user
    if (!user) {
      if (!displayName) {
        return c.json(
          { success: false, error: 'Display name required for new users' },
          400
        );
      }

      const userId = nanoid();
      await db.insert(users).values({
        id: userId,
        walletAddress: normalizedAddress,
        displayName,
      });

      user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      isNewUser = true;
    }

    if (!user) {
      throw new Error('Failed to create or retrieve user');
    }

    // 7. Generate JWT
    const token = sign(
      {
        userId: user.id,
        walletAddress: normalizedAddress,
      },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response: WalletAuthResponse = {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        createdAt: user.createdAt!,
      },
      token,
      isNewUser,
    };

    return c.json({ success: true, data: response });
  } catch (error) {
    console.error('Wallet authentication error:', error);
    return c.json(
      { success: false, error: 'Authentication failed' },
      500
    );
  }
});

// Clean up expired nonces (can be called periodically)
walletAuthRoutes.post('/cleanup-nonces', async (c) => {
  const db = getDb(c.env.DB);

  try {
    const now = new Date();
    await db.delete(nonces)
      .where(gt(nonces.expiresAt, now));

    return c.json({ success: true, message: 'Expired nonces cleaned up' });
  } catch (error) {
    console.error('Nonce cleanup error:', error);
    return c.json(
      { success: false, error: 'Failed to clean up nonces' },
      500
    );
  }
});

