import type { PlaceOrderInput, Kline } from '@roboz-trade/shared-types';

export class AsterAPI {
  private baseURL: string;

  constructor(
    private apiKey: string,
    private apiSecret: string,
    baseURL = 'https://fapi.asterdex.com'
  ) {
    this.baseURL = baseURL;
  }

  /**
   * Generate HMAC SHA256 signature for authenticated requests
   */
  private async sign(params: Record<string, any>): Promise<string> {
    const queryString = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)] as [string, string])
    ).toString();

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.apiSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(queryString)
    );

    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    const response = await fetch(
      `${this.baseURL}/fapi/v1/ticker/price?symbol=${symbol}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get price: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get 24hr ticker data
   */
  async get24hrTicker(symbol: string): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/fapi/v1/ticker/24hr?symbol=${symbol}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get ticker: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Place a new order
   */
  async placeOrder(params: PlaceOrderInput): Promise<any> {
    const timestamp = Date.now();
    const orderParams = {
      symbol: params.symbol,
      side: params.side,
      type: params.price ? 'LIMIT' : 'MARKET',
      quantity: params.quantity,
      ...(params.price && { price: params.price, timeInForce: 'GTC' }),
      timestamp,
    };

    const signature = await this.sign(orderParams);

    const response = await fetch(`${this.baseURL}/fapi/v1/order`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ...orderParams as any,
        signature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to place order: ${error}`);
    }

    return response.json();
  }

  /**
   * Get kline/candlestick data
   */
  async getKlines(params: {
    symbol: string;
    interval: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<Kline[]> {
    const queryParams = new URLSearchParams({
      symbol: params.symbol,
      interval: params.interval,
      ...(params.limit && { limit: String(params.limit) }),
      ...(params.startTime && { startTime: String(params.startTime) }),
      ...(params.endTime && { endTime: String(params.endTime) }),
    });

    const response = await fetch(
      `${this.baseURL}/fapi/v1/klines?${queryParams}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get klines: ${response.statusText}`);
    }

    const data = await response.json() as any[];

    // Transform Aster API response to our Kline format
    return data.map((k: any[]) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<any> {
    const timestamp = Date.now();
    const params = { timestamp };
    const signature = await this.sign(params);

    const response = await fetch(
      `${this.baseURL}/fapi/v2/account?timestamp=${timestamp}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get account info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    const timestamp = Date.now();
    const params: any = { timestamp };
    if (symbol) params.symbol = symbol;

    const signature = await this.sign(params);
    const queryParams = new URLSearchParams({ ...params, signature });

    const response = await fetch(
      `${this.baseURL}/fapi/v1/openOrders?${queryParams}`,
      {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get open orders: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<any> {
    const timestamp = Date.now();
    const params = { symbol, orderId, timestamp };
    const signature = await this.sign(params);

    const response = await fetch(`${this.baseURL}/fapi/v1/order`, {
      method: 'DELETE',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ ...params as any, signature }),
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel order: ${response.statusText}`);
    }

    return response.json();
  }
}

