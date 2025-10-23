/**
 * Aster DEX API Service
 * Handles all interactions with Aster Finance Futures API
 *
 * Rate Limits:
 * - REQUEST_WEIGHT: 2400 per minute
 * - ORDERS: 1200 per minute
 * - ORDERS: 300 per 10 seconds
 */

import { createHmac } from 'crypto';
import type { Candle } from './indicators';
import { withRateLimit } from './rate-limiter';

const ASTER_API_BASE_URL = 'https://api.aster.finance';

export interface AsterCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  openInterest: number;
  fundingRate: number;
  volume24h: number;
  priceChange24h: number;
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  leverage: number;
  margin: number;
}

export interface AccountInfo {
  availableBalance: number;
  totalBalance: number;
  unrealizedPnl: number;
  marginUsed: number;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  leverage?: number;
}

export interface OrderResponse {
  orderId: string;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  status: string;
  executedQty: number;
  avgPrice: number;
}

/**
 * Generate HMAC SHA256 signature for Aster API
 */
function generateSignature(secret: string, queryString: string): string {
  return createHmac('sha256', secret)
    .update(queryString)
    .digest('hex');
}

/**
 * Make authenticated request to Aster API
 */
async function makeRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE',
  credentials: AsterCredentials,
  params: Record<string, any> = {}
): Promise<any> {
  const timestamp = Date.now();
  const queryParams = { ...params, timestamp };

  // Sort parameters alphabetically
  const sortedParams = Object.keys(queryParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = queryParams[key];
      return acc;
    }, {} as Record<string, any>);

  const queryString = new URLSearchParams(sortedParams as any).toString();
  const signature = generateSignature(credentials.apiSecret, queryString);

  const url = `${ASTER_API_BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: {
      'X-API-KEY': credentials.apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Aster API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get current market data for a symbol
 */
export async function getMarketData(
  symbol: string,
  credentials: AsterCredentials
): Promise<MarketData> {
  return withRateLimit(async () => {
    const data = await makeRequest('/v3/ticker/24hr', 'GET', credentials, { symbol });

    return {
      symbol: data.symbol,
      price: parseFloat(data.lastPrice),
      openInterest: parseFloat(data.openInterest || '0'),
      fundingRate: parseFloat(data.fundingRate || '0'),
      volume24h: parseFloat(data.volume),
      priceChange24h: parseFloat(data.priceChangePercent),
    };
  }, false);
}

/**
 * Get candlestick/kline data for technical analysis
 */
export async function getCandles(
  symbol: string,
  interval: string,
  limit: number,
  credentials: AsterCredentials
): Promise<Candle[]> {
  return withRateLimit(async () => {
    const data = await makeRequest('/v3/klines', 'GET', credentials, {
      symbol,
      interval,
      limit,
    });

    return data.map((candle: any[]) => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  }, false);
}

/**
 * Get account information
 */
export async function getAccountInfo(credentials: AsterCredentials): Promise<AccountInfo> {
  return withRateLimit(async () => {
    const data = await makeRequest('/v3/account', 'GET', credentials);

    return {
      availableBalance: parseFloat(data.availableBalance),
      totalBalance: parseFloat(data.totalWalletBalance),
      unrealizedPnl: parseFloat(data.totalUnrealizedProfit),
      marginUsed: parseFloat(data.totalMarginBalance),
    };
  }, false);
}

/**
 * Get all open positions
 */
export async function getPositions(credentials: AsterCredentials): Promise<Position[]> {
  return withRateLimit(async () => {
    const data = await makeRequest('/v3/positionRisk', 'GET', credentials);

    return data
      .filter((pos: any) => parseFloat(pos.positionAmt) !== 0)
      .map((pos: any) => ({
        symbol: pos.symbol,
        side: parseFloat(pos.positionAmt) > 0 ? 'LONG' : 'SHORT',
        quantity: Math.abs(parseFloat(pos.positionAmt)),
        entryPrice: parseFloat(pos.entryPrice),
        currentPrice: parseFloat(pos.markPrice),
        liquidationPrice: parseFloat(pos.liquidationPrice),
        unrealizedPnl: parseFloat(pos.unRealizedProfit),
        leverage: parseInt(pos.leverage),
        margin: parseFloat(pos.isolatedMargin),
      }));
  }, false);
}

/**
 * Place a new order (ORDER request - stricter rate limiting)
 */
export async function placeOrder(
  order: OrderRequest,
  credentials: AsterCredentials
): Promise<OrderResponse> {
  return withRateLimit(async () => {
    const params: any = {
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity.toString(),
    };

    if (order.price) {
      params.price = order.price.toString();
    }

    if (order.stopPrice) {
      params.stopPrice = order.stopPrice.toString();
    }

    if (order.leverage) {
      // Set leverage first
      await makeRequest('/v3/leverage', 'POST', credentials, {
        symbol: order.symbol,
        leverage: order.leverage,
      });
    }

    const data = await makeRequest('/v3/order', 'POST', credentials, params);

    return {
      orderId: data.orderId.toString(),
      symbol: data.symbol,
      side: data.side,
      type: data.type,
      quantity: parseFloat(data.origQty),
      price: parseFloat(data.price || data.avgPrice || '0'),
      status: data.status,
      executedQty: parseFloat(data.executedQty),
      avgPrice: parseFloat(data.avgPrice || '0'),
    };
  }, true); // true = ORDER request
}

/**
 * Cancel an order (ORDER request - stricter rate limiting)
 */
export async function cancelOrder(
  symbol: string,
  orderId: string,
  credentials: AsterCredentials
): Promise<void> {
  return withRateLimit(async () => {
    await makeRequest('/v3/order', 'DELETE', credentials, {
      symbol,
      orderId,
    });
  }, true); // true = ORDER request
}

/**
 * Close a position (market order in opposite direction)
 */
export async function closePosition(
  symbol: string,
  credentials: AsterCredentials
): Promise<OrderResponse> {
  const positions = await getPositions(credentials);
  const position = positions.find(p => p.symbol === symbol);

  if (!position) {
    throw new Error(`No open position found for ${symbol}`);
  }

  const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';

  return placeOrder(
    {
      symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: position.quantity,
    },
    credentials
  );
}

