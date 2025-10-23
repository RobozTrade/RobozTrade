/**
 * Technical Indicators Service
 * Calculates EMA, MACD, RSI and other technical indicators
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  ema20: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  rsi7: number;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) {
    throw new Error(`Not enough data points for EMA${period}`);
  }

  const multiplier = 2 / (period + 1);
  
  // Calculate initial SMA
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  
  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(prices: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (prices.length < 26) {
    throw new Error('Not enough data points for MACD calculation');
  }

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  // Calculate signal line (9-period EMA of MACD)
  // For simplicity, we'll use a simple moving average here
  // In production, you'd want to calculate EMA of MACD values over time
  const signal = macd * 0.9; // Simplified signal line
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 7): number {
  if (prices.length < period + 1) {
    throw new Error(`Not enough data points for RSI${period}`);
  }

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  const gains: number[] = changes.map(change => change > 0 ? change : 0);
  const losses: number[] = changes.map(change => change < 0 ? Math.abs(change) : 0);

  // Calculate average gain and loss
  const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
  const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

/**
 * Calculate all technical indicators for a given price history
 */
export function calculateIndicators(candles: Candle[]): TechnicalIndicators {
  const closePrices = candles.map(c => c.close);
  
  const ema20 = calculateEMA(closePrices, 20);
  const { macd, signal, histogram } = calculateMACD(closePrices);
  const rsi7 = calculateRSI(closePrices, 7);

  return {
    ema20,
    macd,
    macdSignal: signal,
    macdHistogram: histogram,
    rsi7,
  };
}

/**
 * Calculate Sharpe Ratio
 * @param returns Array of returns (as decimals, e.g., 0.05 for 5%)
 * @param riskFreeRate Annual risk-free rate (default 0.02 for 2%)
 */
export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length === 0) {
    return 0;
  }

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return 0;
  }

  // Annualize the Sharpe ratio (assuming daily returns)
  const annualizedReturn = avgReturn * 365;
  const annualizedStdDev = stdDev * Math.sqrt(365);
  
  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

/**
 * Calculate maximum drawdown
 * @param equityCurve Array of account values over time
 */
export function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) {
    return 0;
  }

  let maxDrawdown = 0;
  let peak = equityCurve[0];

  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculate profit factor
 * @param trades Array of trade PnL values
 */
export function calculateProfitFactor(trades: number[]): number {
  const grossProfit = trades.filter(t => t > 0).reduce((sum, t) => sum + t, 0);
  const grossLoss = Math.abs(trades.filter(t => t < 0).reduce((sum, t) => sum + t, 0));

  if (grossLoss === 0) {
    return grossProfit > 0 ? Infinity : 0;
  }

  return grossProfit / grossLoss;
}

