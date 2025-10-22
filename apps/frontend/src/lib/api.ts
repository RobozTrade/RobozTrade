import type {
  ApiResponse,
  AuthResponse,
  LoginInput,
  CreateUserInput,
  TradingBot,
  CreateBotInput,
  CreateBotInputLegacy,
  UpdateBotInput,
  Trade,
  ApiKey,
  CreateApiKeyInput,
  BenchmarkTest,
  CreateBenchmarkInput,
  Kline,
  ValidatePaymentResponse,
  BotPayment,
} from '@roboz-trade/shared-types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private getHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('auth-storage');
      if (token) {
        try {
          const parsed = JSON.parse(token);
          if (parsed.state?.token) {
            headers['Authorization'] = `Bearer ${parsed.state.token}`;
          }
        } catch (e) {
          console.error('Failed to parse auth token');
        }
      }
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    includeAuth = false
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(includeAuth),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(input: LoginInput): Promise<ApiResponse<AuthResponse>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async register(input: CreateUserInput): Promise<ApiResponse<AuthResponse>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Bots
  async getBots(): Promise<ApiResponse<TradingBot[]>> {
    return this.request('/bots', {}, true);
  }

  async getBot(id: string): Promise<ApiResponse<TradingBot>> {
    return this.request(`/bots/${id}`, {}, true);
  }

  async createBot(input: CreateBotInput | CreateBotInputLegacy): Promise<ApiResponse<TradingBot>> {
    return this.request(
      '/bots',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      true
    );
  }

  async updateBot(
    id: string,
    input: UpdateBotInput
  ): Promise<ApiResponse<TradingBot>> {
    return this.request(
      `/bots/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      true
    );
  }

  async deleteBot(id: string): Promise<ApiResponse<void>> {
    return this.request(
      `/bots/${id}`,
      {
        method: 'DELETE',
      },
      true
    );
  }

  // Trades
  async getTrades(): Promise<ApiResponse<Trade[]>> {
    return this.request('/trades', {}, true);
  }

  async getBotTrades(botId: string): Promise<ApiResponse<Trade[]>> {
    return this.request(`/trades/bot/${botId}`, {}, true);
  }

  // API Keys
  async getApiKeys(): Promise<ApiResponse<ApiKey[]>> {
    return this.request('/keys', {}, true);
  }

  async createApiKey(input: CreateApiKeyInput): Promise<ApiResponse<ApiKey>> {
    return this.request(
      '/keys',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      true
    );
  }

  async toggleApiKey(id: string): Promise<ApiResponse<void>> {
    return this.request(
      `/keys/${id}/toggle`,
      {
        method: 'PATCH',
      },
      true
    );
  }

  async deleteApiKey(id: string): Promise<ApiResponse<void>> {
    return this.request(
      `/keys/${id}`,
      {
        method: 'DELETE',
      },
      true
    );
  }

  // Benchmarks
  async getBenchmarks(): Promise<ApiResponse<BenchmarkTest[]>> {
    return this.request('/benchmarks', {}, true);
  }

  async createBenchmark(
    input: CreateBenchmarkInput
  ): Promise<ApiResponse<BenchmarkTest>> {
    return this.request(
      '/benchmarks',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      true
    );
  }

  // Market Data
  async getPrice(symbol: string): Promise<ApiResponse<{ symbol: string; price: string }>> {
    return this.request(`/market/price/${symbol}`);
  }

  async getTicker(symbol: string): Promise<ApiResponse<any>> {
    return this.request(`/market/ticker/${symbol}`);
  }

  async getKlines(
    symbol: string,
    interval: string,
    limit?: number
  ): Promise<ApiResponse<Kline[]>> {
    const params = new URLSearchParams({ symbol, interval });
    if (limit) params.append('limit', String(limit));
    return this.request(`/market/klines?${params}`);
  }

  // Payments
  async validatePayment(txHash: string): Promise<ApiResponse<ValidatePaymentResponse>> {
    return this.request(
      '/payments/validate',
      {
        method: 'POST',
        body: JSON.stringify({ txHash }),
      },
      true
    );
  }

  async getPayments(): Promise<ApiResponse<BotPayment[]>> {
    return this.request('/payments', {}, true);
  }
}

export const api = new ApiClient();

