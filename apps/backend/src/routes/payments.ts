import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { botPayments } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import type { ValidatePaymentResponse } from '@roboz-trade/shared-types';

const validatePaymentSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
});

// JSON-RPC response types
interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface TransactionData {
  from: string;
  to: string;
  value: string;
  input: string;
  blockNumber: string;
  hash: string;
}

interface TransactionReceipt {
  status: string;
  blockNumber: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

// BSC Mainnet configuration - now from environment variables
type PaymentBindings = {
  DB: D1Database;
  JWT_SECRET: string;
  BSC_RPC_URL?: string;
  USDT_CONTRACT_ADDRESS?: string;
  PAYMENT_RECIPIENT_ADDRESS?: string;
  REQUIRED_PAYMENT_AMOUNT?: string;
  MIN_CONFIRMATIONS?: string;
};

export const paymentsRoutes = new Hono<{ Bindings: PaymentBindings }>();

paymentsRoutes.use('/*', authMiddleware);

/**
 * Validate USDT payment on BSC mainnet
 */
paymentsRoutes.post('/validate', zValidator('json', validatePaymentSchema), async (c) => {
  const userId = getUserId(c);
  const { txHash } = c.req.valid('json');
  const db = getDb(c.env.DB);

  // Get configuration from environment variables with defaults
  const BSC_RPC_URLS = [
    c.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc.publicnode.com',
  ];
  const USDT_CONTRACT_ADDRESS = (c.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955').toLowerCase();
  const RECIPIENT_ADDRESS = (c.env.PAYMENT_RECIPIENT_ADDRESS || '0xB8b687E16BD6Ce3E37e6f9fd534542F75009c86B').toLowerCase();
  const REQUIRED_AMOUNT = parseFloat(c.env.REQUIRED_PAYMENT_AMOUNT || '10');
  const MIN_CONFIRMATIONS = parseInt(c.env.MIN_CONFIRMATIONS || '3', 10);

  // Helper function to try multiple RPC endpoints
  const fetchFromRpc = async <T>(method: string, params: any[]): Promise<T | null> => {
    for (const rpcUrl of BSC_RPC_URLS) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Math.floor(Math.random() * 1000),
            method,
            params,
          }),
        });

        if (!response.ok) continue;

        const data = await response.json() as JsonRpcResponse<T>;
        if (data.result) {
          return data.result;
        }
      } catch (error) {
        console.error(`RPC ${rpcUrl} failed:`, error);
        continue;
      }
    }
    return null;
  };

  try {
    // Check if transaction hash already exists
    const existingPayment = await db.query.botPayments.findFirst({
      where: eq(botPayments.txHash, txHash),
    });

    if (existingPayment) {
      if (existingPayment.status === 'confirmed') {
        return c.json({
          success: true,
          data: {
            valid: true,
            amount: existingPayment.amount,
            blockNumber: existingPayment.blockNumber,
            message: 'Payment already confirmed',
          } as ValidatePaymentResponse,
        });
      } else if (existingPayment.status === 'failed') {
        return c.json({
          success: false,
          error: 'This transaction has already been marked as failed',
        }, 400);
      }
    }

    // Fetch transaction from BSC with retry logic
    const tx = await fetchFromRpc<TransactionData>('eth_getTransactionByHash', [txHash]);

    if (!tx) {
      return c.json({
        success: false,
        error: 'Transaction not found on BSC network. It may still be pending or you may be on the wrong network. Please wait a few moments and try again.',
      }, 404);
    }

    // Fetch transaction receipt for confirmation status
    const receipt = await fetchFromRpc<TransactionReceipt>('eth_getTransactionReceipt', [txHash]);

    if (!receipt) {
      return c.json({
        success: false,
        error: 'Transaction receipt not found. The transaction may still be pending confirmation. Please wait a few moments and try again.',
      }, 404);
    }

    // Check if transaction was successful
    if (receipt.status !== '0x1') {
      // Save failed payment
      if (!existingPayment) {
        await db.insert(botPayments).values({
          id: nanoid(),
          userId,
          botId: null,
          txHash,
          amount: 0,
          currency: 'USDT',
          status: 'failed',
          blockNumber: parseInt(receipt.blockNumber, 16),
        });
      }

      return c.json({
        success: false,
        error: 'Transaction failed on blockchain',
      }, 400);
    }

    // Verify it's a USDT transfer to the correct address
    if (tx.to?.toLowerCase() !== USDT_CONTRACT_ADDRESS.toLowerCase()) {
      return c.json({
        success: false,
        error: 'Transaction is not a USDT transfer',
      }, 400);
    }

    // Decode transfer event from logs
    // Transfer event signature: Transfer(address,address,uint256)
    const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const transferLog = receipt.logs.find(
      (log: any) => log.topics[0] === transferEventSignature
    );

    if (!transferLog) {
      return c.json({
        success: false,
        error: 'No USDT transfer event found in transaction',
      }, 400);
    }

    // Decode recipient address (topics[2] in Transfer event)
    const recipientAddress = '0x' + transferLog.topics[2].slice(26);

    if (recipientAddress.toLowerCase() !== RECIPIENT_ADDRESS.toLowerCase()) {
      return c.json({
        success: false,
        error: `Payment must be sent to ${RECIPIENT_ADDRESS}`,
      }, 400);
    }

    // Decode amount (data field in Transfer event)
    // USDT has 18 decimals on BSC
    const amountHex = transferLog.data;
    const amountWei = BigInt(amountHex);
    const amount = Number(amountWei) / 1e18;

    // Verify amount is exactly 10 USDT (with small tolerance for rounding)
    if (Math.abs(amount - REQUIRED_AMOUNT) > 0.01) {
      return c.json({
        success: false,
        error: `Payment must be exactly ${REQUIRED_AMOUNT} USDT (received ${amount.toFixed(2)} USDT)`,
      }, 400);
    }

    // Get current block number to calculate confirmations
    const currentBlockHex = await fetchFromRpc<string>('eth_blockNumber', []);

    if (!currentBlockHex) {
      return c.json({
        success: false,
        error: 'Unable to fetch current block number. Please try again.',
      }, 500);
    }

    const currentBlock = parseInt(currentBlockHex, 16);
    const txBlock = parseInt(receipt.blockNumber, 16);
    const confirmations = currentBlock - txBlock + 1;

    // Check minimum confirmations
    if (confirmations < MIN_CONFIRMATIONS) {
      // Save as pending
      if (!existingPayment) {
        await db.insert(botPayments).values({
          id: nanoid(),
          userId,
          botId: null,
          txHash,
          amount,
          currency: 'USDT',
          status: 'pending',
          blockNumber: txBlock,
        });
      }

      return c.json({
        success: false,
        error: `Transaction needs ${MIN_CONFIRMATIONS} confirmations (currently ${confirmations})`,
      }, 400);
    }

    // Payment is valid and confirmed
    const paymentId = existingPayment?.id || nanoid();

    if (existingPayment) {
      // Update existing payment
      await db
        .update(botPayments)
        .set({
          status: 'confirmed',
          amount,
          blockNumber: txBlock,
          confirmedAt: new Date(),
        })
        .where(eq(botPayments.id, existingPayment.id));
    } else {
      // Create new payment record
      await db.insert(botPayments).values({
        id: paymentId,
        userId,
        botId: null,
        txHash,
        amount,
        currency: 'USDT',
        status: 'confirmed',
        blockNumber: txBlock,
        confirmedAt: new Date(),
      });
    }

    const response: ValidatePaymentResponse = {
      valid: true,
      amount,
      from: tx.from,
      to: recipientAddress,
      blockNumber: txBlock,
      confirmations,
    };

    return c.json({ success: true, data: response });
  } catch (error) {
    console.error('Payment validation error:', error);
    return c.json(
      { success: false, error: 'Failed to validate payment' },
      500
    );
  }
});

/**
 * Get payment history for user
 */
paymentsRoutes.get('/', async (c) => {
  const userId = getUserId(c);
  const db = getDb(c.env.DB);

  try {
    const payments = await db.query.botPayments.findMany({
      where: eq(botPayments.userId, userId),
    });

    return c.json({ success: true, data: payments });
  } catch (error) {
    console.error('Get payments error:', error);
    return c.json({ success: false, error: 'Failed to get payments' }, 500);
  }
});

