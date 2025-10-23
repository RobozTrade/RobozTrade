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
  ema50: number;
  ema20Series: number[];
  ema50Series: number[];
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  macdSeries: number[];
  macdSignalSeries: number[];
  macdHistogramSeries: number[];
  rsi7: number;
  rsi14: number;
  rsi7Series: number[];
  rsi14Series: number[];
}

const DEFAULT_RSI = 50;

function safeLast(values: number[], fallback = 0): number {
  if (values.length === 0) {
    return fallback;
  }

  const last = values[values.length - 1];
  if (Number.isNaN(last) || !Number.isFinite(last)) {
    return fallback;
  }

  return last;
}

export function calculateEMASequence(prices: number[], period: number): number[] {
  if (prices.length === 0) {
    return [];
  }

  const emaSeries: number[] = [];
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  emaSeries.push(ema);

  if (prices.length === 1) {
    return emaSeries;
  }

  let smaCalculated = false;

  for (let i = 1; i < prices.length; i++) {
    const price = prices[i];

    if (!smaCalculated && i >= period - 1) {
      const windowStart = Math.max(0, i - period + 1);
      const window = prices.slice(windowStart, i + 1);
      const average = window.reduce((sum, value) => sum + value, 0) / window.length;
      ema = average;
      smaCalculated = true;
    } else if (!smaCalculated) {
      ema = ((ema * i) + price) / (i + 1);
    } else {
      ema = (price - ema) * multiplier + ema;
    }

    emaSeries.push(ema);
  }

  return emaSeries;
}

export function calculateMACDSeries(prices: number[]): {
  macdSeries: number[];
  signalSeries: number[];
  histogramSeries: number[];
} {
  if (prices.length === 0) {
    return {
      macdSeries: [],
      signalSeries: [],
      histogramSeries: [],
    };
  }

  const ema12 = calculateEMASequence(prices, 12);
  const ema26 = calculateEMASequence(prices, 26);
  const macdSeries = prices.map((_, idx) => {
    const fast = ema12[idx] ?? safeLast(ema12);
    const slow = ema26[idx] ?? safeLast(ema26);
    return fast - slow;
  });

  const signalSeries = calculateEMASequence(macdSeries, 9);
  const histogramSeries = macdSeries.map((value, idx) => {
    const signal = signalSeries[idx] ?? safeLast(signalSeries);
    return value - signal;
  });

  return {
    macdSeries,
    signalSeries,
    histogramSeries,
  };
}

export function calculateRSISequence(prices: number[], period = 14): number[] {
  if (prices.length === 0) {
    return [];
  }

  const result = new Array<number>(prices.length).fill(DEFAULT_RSI);
  if (prices.length === 1) {
    return result;
  }

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  const initialLength = Math.min(period, gains.length);
  if (initialLength === 0) {
    return result;
  }

  let avgGain = gains.slice(0, initialLength).reduce((sum, value) => sum + value, 0) / initialLength;
  let avgLoss = losses.slice(0, initialLength).reduce((sum, value) => sum + value, 0) / initialLength;

  const firstIndex = initialLength;
  if (avgLoss === 0) {
    result[firstIndex] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[firstIndex] = 100 - 100 / (1 + rs);
  }

  for (let i = firstIndex + 1; i < prices.length; i++) {
    const gain = gains[i - 1] ?? 0;
    const loss = losses[i - 1] ?? 0;

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

export function calculateATRSeries(candles: Candle[], period: number): number[] {
  if (candles.length === 0) {
    return [];
  }

  const trueRanges: number[] = candles.map((candle, index) => {
    if (index === 0) {
      return candle.high - candle.low;
    }

    const previousClose = candles[index - 1].close;
    const highLow = candle.high - candle.low;
    const highPrevClose = Math.abs(candle.high - previousClose);
    const lowPrevClose = Math.abs(candle.low - previousClose);
    return Math.max(highLow, highPrevClose, lowPrevClose);
  });

  const atrSeries: number[] = [];
  let atr = trueRanges[0];
  atrSeries.push(atr);

  for (let i = 1; i < trueRanges.length; i++) {
    const tr = trueRanges[i];
    if (i < period) {
      atr = ((atr * i) + tr) / (i + 1);
    } else {
      atr = ((atr * (period - 1)) + tr) / period;
    }
    atrSeries.push(atr);
  }

  return atrSeries;
}

export function calculateATR(candles: Candle[], period: number): number {
  const atrSeries = calculateATRSeries(candles, period);
  return safeLast(atrSeries, 0);
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) {
    throw new Error(`Not enough data points for EMA${period}`);
  }

  const emaSeries = calculateEMASequence(prices, period);
  if (emaSeries.length === 0) {
    throw new Error(`Failed to compute EMA${period}`);
  }

  return safeLast(emaSeries);
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(prices: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (prices.length === 0) {
    throw new Error('Not enough data points for MACD calculation');
  }

  const { macdSeries, signalSeries, histogramSeries } = calculateMACDSeries(prices);
  return {
    macd: safeLast(macdSeries),
    signal: safeLast(signalSeries),
    histogram: safeLast(histogramSeries),
  };
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 7): number {
  if (prices.length < 2) {
    throw new Error(`Not enough data points for RSI${period}`);
  }

  const rsiSeries = calculateRSISequence(prices, period);
  return safeLast(rsiSeries, DEFAULT_RSI);
}

/**
 * Calculate all technical indicators for a given price history
 */
export function calculateIndicators(candles: Candle[]): TechnicalIndicators {
  if (candles.length === 0) {
    return {
      ema20: 0,
      ema50: 0,
      ema20Series: [],
      ema50Series: [],
      macd: 0,
      macdSignal: 0,
      macdHistogram: 0,
      macdSeries: [],
      macdSignalSeries: [],
      macdHistogramSeries: [],
      rsi7: DEFAULT_RSI,
      rsi14: DEFAULT_RSI,
      rsi7Series: [],
      rsi14Series: [],
    };
  }

  const closePrices = candles.map(c => c.close);
  const ema20Series = calculateEMASequence(closePrices, 20);
  const ema50Series = calculateEMASequence(closePrices, 50);
  const { macdSeries, signalSeries, histogramSeries } = calculateMACDSeries(closePrices);
  const rsi7Series = calculateRSISequence(closePrices, 7);
  const rsi14Series = calculateRSISequence(closePrices, 14);

  const lastPrice = closePrices[closePrices.length - 1];

  return {
    ema20: safeLast(ema20Series, lastPrice),
    ema50: safeLast(ema50Series, safeLast(ema20Series, lastPrice)),
    ema20Series,
    ema50Series,
    macd: safeLast(macdSeries),
    macdSignal: safeLast(signalSeries),
    macdHistogram: safeLast(histogramSeries),
    macdSeries,
    macdSignalSeries: signalSeries,
    macdHistogramSeries: histogramSeries,
    rsi7: safeLast(rsi7Series, DEFAULT_RSI),
    rsi14: safeLast(rsi14Series, DEFAULT_RSI),
    rsi7Series,
    rsi14Series,
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

