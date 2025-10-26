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

// Re-export Candle type for convenience
export type { Candle } from './indicators';

const ASTER_API_BASE_URL = 'https://fapi.asterdex.com';
const SYMBOL_METADATA_TTL_MS = 1000 * 60 * 5; // 5 minutes

let symbolMetadataCache: {
  timestamp: number;
  data: Map<string, SymbolMetadata>;
} | null = null;

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
  entryTime?: Date; // Entry time from trade history
}

export interface AccountInfo {
  availableBalance: number;
  totalBalance: number;
  unrealizedPnl: number;
  marginUsed: number;
}

export interface SymbolMetadata {
  symbol: string;
  minNotional: number;
  maxNotional?: number;
  minQty: number;
  maxQty?: number;
  stepSize: number;
  tickSize: number;
  pricePrecision: number;
  quantityPrecision: number;
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
  params: Record<string, any> = {},
  options: { requiresSignature?: boolean } = {}
): Promise<any> {
  const { requiresSignature = true } = options;
  const payload: Record<string, any> = { ...params };
  const headers: Record<string, string> = {};

  if (requiresSignature) {
    payload.recvWindow ??= 5000;
    payload.timestamp = Date.now();
    headers['X-MBX-APIKEY'] = credentials.apiKey;
  } else if (method !== 'GET') {
    headers['X-MBX-APIKEY'] = credentials.apiKey;
  }

  const sortedEntries = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, typeof value === 'string' ? value : String(value)] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));

  const queryString = new URLSearchParams(sortedEntries).toString();
  let url = `${ASTER_API_BASE_URL}${endpoint}`;
  let body: string | undefined;

  if (requiresSignature) {
    const signaturePayload = queryString;
    const signature = generateSignature(credentials.apiSecret, signaturePayload);

    if (method === 'POST') {
      body = signaturePayload
        ? `${signaturePayload}&signature=${signature}`
        : `signature=${signature}`;
    } else {
      const query = signaturePayload
        ? `${signaturePayload}&signature=${signature}`
        : `signature=${signature}`;
      url = `${url}?${query}`;
    }
  } else {
    if (queryString) {
      if (method === 'GET' || method === 'DELETE') {
        url = `${url}?${queryString}`;
      } else {
        body = queryString;
      }
    }
  }

  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    let errorMessage = `${response.status}`;
    try {
      const errorBody = await response.text();
      errorMessage = `${response.status} - ${errorBody}`;
    } catch (err) {
      console.error('Error parsing Aster API error response:', err);
    }
    throw new Error(`Aster API error: ${errorMessage}`);
  }

  return response.json();
}

function parseNumber(value: any, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSymbolMetadata(symbolInfo: any): SymbolMetadata | null {
  if (!symbolInfo || typeof symbolInfo !== 'object') {
    return null;
  }

  const filters = Array.isArray(symbolInfo.filters) ? symbolInfo.filters : [];
  const lotSize = filters.find((filter: any) => filter.filterType === 'LOT_SIZE');
  const marketLotSize = filters.find((filter: any) => filter.filterType === 'MARKET_LOT_SIZE');
  const priceFilter = filters.find((filter: any) => filter.filterType === 'PRICE_FILTER');
  const notionalFilter = filters.find((filter: any) => filter.filterType === 'NOTIONAL' || filter.filterType === 'MIN_NOTIONAL');

  const minQty = parseNumber(marketLotSize?.minQty ?? lotSize?.minQty, 0);
  const maxQtyRaw = marketLotSize?.maxQty ?? lotSize?.maxQty;
  const maxQty = maxQtyRaw !== undefined ? parseNumber(maxQtyRaw, Number.POSITIVE_INFINITY) : undefined;
  const stepSize = parseNumber(lotSize?.stepSize, 0.001);
  const tickSize = parseNumber(priceFilter?.tickSize, 0.01);
  const minNotional = parseNumber(notionalFilter?.minNotional ?? notionalFilter?.notional, 5);
  const maxNotionalRaw = notionalFilter?.maxNotional ?? notionalFilter?.maxNotionalValue;
  const maxNotional = maxNotionalRaw !== undefined ? parseNumber(maxNotionalRaw, Number.POSITIVE_INFINITY) : undefined;

  return {
    symbol: symbolInfo.symbol,
    minNotional,
    maxNotional: maxNotional && Number.isFinite(maxNotional) ? maxNotional : undefined,
    minQty,
    maxQty: maxQty && Number.isFinite(maxQty) ? maxQty : undefined,
    stepSize,
    tickSize,
    pricePrecision: parseInt(symbolInfo.pricePrecision ?? '2', 10) || 2,
    quantityPrecision: parseInt(symbolInfo.quantityPrecision ?? '3', 10) || 3,
  };
}

export async function getSymbolMetadata(credentials: AsterCredentials): Promise<Map<string, SymbolMetadata>> {
  if (symbolMetadataCache && Date.now() - symbolMetadataCache.timestamp < SYMBOL_METADATA_TTL_MS) {
    return symbolMetadataCache.data;
  }

  const response = await makeRequest('/fapi/v1/exchangeInfo', 'GET', credentials, {}, { requiresSignature: false });
  const symbols = Array.isArray(response?.symbols) ? response.symbols : [];
  const map = new Map<string, SymbolMetadata>();

  for (const symbolInfo of symbols) {
    if (symbolInfo?.status !== 'TRADING') {
      continue;
    }

    const metadata = parseSymbolMetadata(symbolInfo);
    if (!metadata) {
      continue;
    }

    map.set(metadata.symbol, metadata);
  }

  symbolMetadataCache = {
    timestamp: Date.now(),
    data: map,
  };

  return map;
}

/**
 * Get current market data for a symbol
 */
export async function getMarketData(
  symbol: string,
  credentials: AsterCredentials
): Promise<MarketData> {
  return withRateLimit(async () => {
    // Fetch ticker data, open interest, and funding rate in parallel
    const [tickerData, openInterestData, premiumIndexData] = await Promise.all([
      makeRequest(
        '/fapi/v1/ticker/24hr',
        'GET',
        credentials,
        { symbol },
        { requiresSignature: false }
      ),
      makeRequest(
        '/fapi/v1/openInterest',
        'GET',
        credentials,
        { symbol },
        { requiresSignature: false }
      ).catch(() => ({ openInterest: '0' })), // Fallback to 0 if endpoint fails
      makeRequest(
        '/fapi/v1/premiumIndex',
        'GET',
        credentials,
        { symbol },
        { requiresSignature: false }
      ).catch(() => ({ lastFundingRate: '0' })), // Fallback to 0 if endpoint fails
    ]);

    return {
      symbol: tickerData.symbol,
      price: parseFloat(tickerData.lastPrice),
      openInterest: parseFloat(openInterestData.openInterest || '0'),
      fundingRate: parseFloat(premiumIndexData.lastFundingRate || '0') * 100, // Convert to percentage
      volume24h: parseFloat(tickerData.volume),
      priceChange24h: parseFloat(tickerData.priceChangePercent),
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
    const data = await makeRequest(
      '/fapi/v1/klines',
      'GET',
      credentials,
      {
        symbol,
        interval,
        limit,
      },
      { requiresSignature: false }
    );

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
    const data = await makeRequest('/fapi/v2/account', 'GET', credentials);

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
    const data = await makeRequest('/fapi/v2/positionRisk', 'GET', credentials);

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
      await makeRequest('/fapi/v1/leverage', 'POST', credentials, {
        symbol: order.symbol,
        leverage: order.leverage,
      });
    }

    const data = await makeRequest('/fapi/v1/order', 'POST', credentials, params);

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
 * Query order status by orderId
 */
export async function getOrder(
  symbol: string,
  orderId: string,
  credentials: AsterCredentials
): Promise<OrderResponse> {
  return withRateLimit(async () => {
    const data = await makeRequest('/fapi/v1/order', 'GET', credentials, {
      symbol,
      orderId,
    });

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
  }, false); // false = not an ORDER request, just a query
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
    await makeRequest('/fapi/v1/order', 'DELETE', credentials, {
      symbol,
      orderId,
    });
  }, true); // true = ORDER request
}

/**
 * Close a position (market order in opposite direction)
 * Returns the order response with filled avgPrice
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

  // Place the close order
  const orderResponse = await placeOrder(
    {
      symbol,
      side: closeSide,
      type: 'MARKET',
      quantity: position.quantity,
    },
    credentials
  );

  // For MARKET orders, the initial response may have avgPrice as 0
  // Wait a moment and query the order to get the filled price
  if (orderResponse.type === 'MARKET' && (!orderResponse.avgPrice || orderResponse.avgPrice === 0)) {
    console.log(`⏳ Waiting for market order ${orderResponse.orderId} to fill...`);

    // Wait 500ms for the order to fill
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query the order to get the filled price
    try {
      const filledOrder = await getOrder(symbol, orderResponse.orderId, credentials);

      if (filledOrder.avgPrice && filledOrder.avgPrice > 0) {
        console.log(`✅ Order filled at avgPrice: ${filledOrder.avgPrice}`);
        return filledOrder;
      } else {
        console.warn(`⚠️ Order query returned avgPrice: ${filledOrder.avgPrice}, using position current price`);
        return {
          ...orderResponse,
          avgPrice: position.currentPrice,
        };
      }
    } catch (error) {
      console.error(`Error querying order ${orderResponse.orderId}:`, error);
      // Fallback to current position price
      return {
        ...orderResponse,
        avgPrice: position.currentPrice,
      };
    }
  }

  return orderResponse;
}

