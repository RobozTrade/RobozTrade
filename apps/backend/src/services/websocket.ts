import { DurableObject } from 'cloudflare:workers';

const PRICE_UPDATE_INTERVAL = 10000; // 10 seconds

export class MarketDataWebSocket extends DurableObject {
  private connections: Set<WebSocket>;
  private asterWs: WebSocket | null;
  private subscribedSymbols: Set<string>;
  private priceUpdateInterval: ReturnType<typeof setInterval> | null;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.connections = new Set();
    this.asterWs = null;
    this.subscribedSymbols = new Set();
    this.priceUpdateInterval = null;
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response('Expected WebSocket', { status: 400 });
  }

  private handleSession(webSocket: WebSocket) {
    webSocket.accept();
    this.connections.add(webSocket);

    // Start price update interval if this is the first connection
    if (this.connections.size === 1 && !this.priceUpdateInterval) {
      this.startPriceUpdates();
    }

    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        await this.handleMessage(message, webSocket);
      } catch (error) {
        webSocket.send(
          JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format' },
          })
        );
      }
    });

    webSocket.addEventListener('close', () => {
      this.connections.delete(webSocket);

      // Stop price updates and close Aster WebSocket if no more connections
      if (this.connections.size === 0) {
        this.stopPriceUpdates();
        if (this.asterWs) {
          this.asterWs.close();
          this.asterWs = null;
          this.subscribedSymbols.clear();
        }
      }
    });

    webSocket.addEventListener('error', () => {
      this.connections.delete(webSocket);
    });
  }

  private async handleMessage(message: any, webSocket: WebSocket) {
    const { action, channels } = message;

    if (action === 'subscribe') {
      await this.subscribe(channels);
      webSocket.send(
        JSON.stringify({
          type: 'subscribed',
          data: { channels },
        })
      );
    } else if (action === 'unsubscribe') {
      await this.unsubscribe(channels);
      webSocket.send(
        JSON.stringify({
          type: 'unsubscribed',
          data: { channels },
        })
      );
    }
  }

  private async subscribe(channels: string[]) {
    // Initialize Aster WebSocket if not already connected
    if (!this.asterWs) {
      await this.connectToAster();
    }

    // Subscribe to new channels
    const newChannels = channels.filter(
      (channel) => !this.subscribedSymbols.has(channel)
    );

    if (newChannels.length > 0 && this.asterWs) {
      this.asterWs.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params: newChannels,
          id: Date.now(),
        })
      );

      newChannels.forEach((channel) => this.subscribedSymbols.add(channel));
    }
  }

  private async unsubscribe(channels: string[]) {
    if (!this.asterWs) return;

    const channelsToRemove = channels.filter((channel) =>
      this.subscribedSymbols.has(channel)
    );

    if (channelsToRemove.length > 0) {
      this.asterWs.send(
        JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: channelsToRemove,
          id: Date.now(),
        })
      );

      channelsToRemove.forEach((channel) =>
        this.subscribedSymbols.delete(channel)
      );
    }
  }

  private async connectToAster(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.asterWs = new WebSocket('wss://fstream.asterdex.com/ws');

      this.asterWs.addEventListener('open', () => {
        resolve();
      });

      this.asterWs.addEventListener('message', (event) => {
        // Broadcast to all connected clients
        this.broadcast(event.data as string);
      });

      this.asterWs.addEventListener('error', (error) => {
        console.error('Aster WebSocket error:', error);
        this.asterWs = null;
        reject(error);
      });

      this.asterWs.addEventListener('close', () => {
        this.asterWs = null;
        this.subscribedSymbols.clear();
      });
    });
  }

  private broadcast(data: string) {
    const message = JSON.parse(data);

    // Transform Aster message format to our format
    const transformedMessage = {
      type: this.getMessageType(message),
      data: message,
    };

    const messageStr = JSON.stringify(transformedMessage);

    this.connections.forEach((ws) => {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    });
  }

  private getMessageType(message: any): string {
    if (message.e === '24hrTicker') return 'ticker';
    if (message.e === 'kline') return 'kline';
    if (message.e === 'aggTrade') return 'trade';
    return 'unknown';
  }

  private startPriceUpdates() {
    // Fetch and broadcast prices every 10 seconds
    this.priceUpdateInterval = setInterval(async () => {
      await this.fetchAndBroadcastPrices();
    }, PRICE_UPDATE_INTERVAL);

    // Also fetch immediately
    this.fetchAndBroadcastPrices();
  }

  private stopPriceUpdates() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
  }

  private async fetchAndBroadcastPrices() {
    const symbols = [
      'BTCUSDT',
      'ETHUSDT',
      'SOLUSDT',
      'BNBUSDT',
      'ADAUSDT',
      'AVAXUSDT',
      'DOTUSDT',
      'MATICUSDT',
    ];

    try {
      // Fetch prices from Aster API
      for (const symbol of symbols) {
        const response = await fetch(
          `https://fapi.asterdex.com/fapi/v1/ticker/24hr?symbol=${symbol}`
        );

        if (response.ok) {
          const data = await response.json() as {
            symbol: string;
            lastPrice: string;
            priceChangePercent: string;
            volume: string;
            highPrice: string;
            lowPrice: string;
          };

          // Broadcast ticker data to all connected clients
          const tickerMessage = {
            type: 'ticker',
            data: {
              e: '24hrTicker',
              s: data.symbol,
              c: data.lastPrice,
              P: data.priceChangePercent,
              v: data.volume,
              h: data.highPrice,
              l: data.lowPrice,
              E: Date.now(),
            },
          };

          this.connections.forEach((ws) => {
            try {
              ws.send(JSON.stringify(tickerMessage));
            } catch (error) {
              console.error('Error sending price update to client:', error);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  }
}

