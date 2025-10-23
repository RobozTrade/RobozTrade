/**
 * AI Trading Decision Service
 * Uses Vercel AI SDK with OpenRouter to make trading decisions based on market data
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { MarketData, Position, SymbolMetadata } from './aster-api';
import type { TechnicalIndicators } from './indicators';

export interface TradingContext {
  symbol: string;
  currentPrice: number;
  marketData: MarketData;
  indicators: TechnicalIndicators;
  position?: Position;
  accountBalance: number;
  accountValue: number;
  totalReturn: number;
  sharpeRatio: number;
  cycleCount: number;
  minutesTrading: number;
  maxLeverage: number;
  minNotionalPerTrade: number;
  maxNotionalPerTrade: number;
  maxOpenTrades: number;
  currentOpenTrades: number;
  accountExposure?: number;
  instrument?: SymbolMetadata;
  intradayMidPrices?: number[];
  intradayEma20Series?: number[];
  intradayMacdSeries?: number[];
  intradayRsi7Series?: number[];
  intradayRsi14Series?: number[];
  higherTimeframeEma20?: number;
  higherTimeframeEma50?: number;
  higherTimeframeAtr3?: number;
  higherTimeframeAtr14?: number;
  higherTimeframeVolume?: number;
  higherTimeframeVolumeAverage?: number;
  higherTimeframeMacdSeries?: number[];
  higherTimeframeRsi14Series?: number[];
}

export interface TradingDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  symbol: string;
  reasoning: string;
  confidence: number;
  suggestedQuantity?: number;
  suggestedLeverage?: number;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
}

export interface TradingDecisionResult {
  decisions: TradingDecision[];
  prompt: string;
  rawResponse: string;
  summary?: string;
  thinking?: string;
  runtimeMs?: number;
  invocations?: number;
}

interface ParsedAIResponse {
  decisions: TradingDecision[];
  summary?: string;
  thinking?: string;
}

/**
 * Populate prompt template with actual values
 */
function populatePromptTemplate(
  template: string,
  contexts: TradingContext[]
): string {
  if (contexts.length === 0) {
    return template;
  }

  let prompt = template;
  const firstContext = contexts[0];

  const globalReplacements: Record<string, string | number | undefined> = {
    current_time: new Date().toISOString(),
    cycle_count: firstContext.cycleCount,
    minutes_trading: firstContext.minutesTrading,
    available_cash: formatNumber(firstContext.accountBalance, 2),
    account_balance: formatNumber(firstContext.accountBalance, 2),
    balance: formatNumber(firstContext.accountBalance, 2),
    account_value: formatNumber(firstContext.accountValue, 2),
    total_return: formatNumber(firstContext.totalReturn, 2),
    sharpe_ratio: formatNumber(firstContext.sharpeRatio, 3),
    max_leverage: firstContext.maxLeverage,
    min_notional_per_trade: formatNumber(firstContext.minNotionalPerTrade, 2),
    max_notional_per_trade: formatNumber(firstContext.maxNotionalPerTrade, 2),
    max_open_trades: firstContext.maxOpenTrades,
    current_open_trades: firstContext.currentOpenTrades,
    account_exposure: formatNumber(firstContext.accountExposure ?? 0, 2),
    exposure: formatNumber(firstContext.accountExposure ?? 0, 2),
  };

  prompt = replaceTemplatePlaceholders(prompt, globalReplacements);

  prompt = prompt.replace(/\{\{#each symbols\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, blockTemplate: string) => {
    const renderedBlocks = contexts
      .map(ctx => renderSymbolBlock(blockTemplate, ctx))
      .join('\n')
      .trim();

    return renderedBlocks;
  });

  return prompt;
}

function renderSymbolBlock(blockTemplate: string, ctx: TradingContext): string {
  let block = blockTemplate;

  const symbolPair = ctx.symbol;
  const symbolBase = symbolPair.replace(/USDT$/i, '');

  const symbolReplacements: Record<string, string | number | undefined> = {
    symbol: symbolPair,
    symbol_pair: symbolPair,
    symbol_base: symbolBase,
    symbol_upper: symbolBase.toUpperCase(),
    symbol_lower: symbolBase.toLowerCase(),
    current_price: formatNumber(ctx.currentPrice, 2),
    current_ema20: formatNumber(ctx.indicators.ema20, 2),
    current_ema50: formatNumber(ctx.indicators.ema50 ?? ctx.indicators.ema20, 2),
    current_macd: formatNumber(ctx.indicators.macd, 2),
    current_macd_signal: formatNumber(ctx.indicators.macdSignal, 2),
    current_macd_histogram: formatNumber(ctx.indicators.macdHistogram, 2),
    current_rsi: formatNumber(ctx.indicators.rsi7, 1),
    current_rsi7: formatNumber(ctx.indicators.rsi7, 1),
    current_rsi14: formatNumber(ctx.indicators.rsi14 ?? ctx.indicators.rsi7, 1),
    open_interest: formatNumber(ctx.marketData.openInterest, 0),
    funding_rate: `${formatNumber(ctx.marketData.fundingRate * 100, 4)}%`,
    funding_rate_decimal: formatNumber(ctx.marketData.fundingRate, 6),
    funding_rate_percent: formatNumber(ctx.marketData.fundingRate * 100, 4),
    volume_24h: formatNumber(ctx.marketData.volume24h, 2),
    price_change_24h: formatNumber(ctx.marketData.priceChange24h, 2),
    price_change_percent_24h: formatNumber(ctx.marketData.priceChange24h, 2),
    exposure_notional: ctx.position
      ? formatNumber(ctx.position.quantity * ctx.currentPrice, 2)
      : undefined,
    intraday_mid_prices: formatSeries(ctx.intradayMidPrices),
    intraday_ema20_series: formatSeries(ctx.intradayEma20Series),
    intraday_macd_series: formatSeries(ctx.intradayMacdSeries),
    intraday_rsi7_series: formatSeries(ctx.intradayRsi7Series),
    intraday_rsi14_series: formatSeries(ctx.intradayRsi14Series),
    ht_ema20: ctx.higherTimeframeEma20 !== undefined ? formatNumber(ctx.higherTimeframeEma20, 2) : undefined,
    ht_ema50: ctx.higherTimeframeEma50 !== undefined ? formatNumber(ctx.higherTimeframeEma50, 2) : undefined,
    ht_atr3: ctx.higherTimeframeAtr3 !== undefined ? formatNumber(ctx.higherTimeframeAtr3, 2) : undefined,
    ht_atr14: ctx.higherTimeframeAtr14 !== undefined ? formatNumber(ctx.higherTimeframeAtr14, 2) : undefined,
    ht_volume_current: ctx.higherTimeframeVolume !== undefined ? formatNumber(ctx.higherTimeframeVolume, 2) : undefined,
    ht_volume_average: ctx.higherTimeframeVolumeAverage !== undefined ? formatNumber(ctx.higherTimeframeVolumeAverage, 2) : undefined,
    ht_macd_series: formatSeries(ctx.higherTimeframeMacdSeries),
    ht_rsi14_series: formatSeries(ctx.higherTimeframeRsi14Series),
  };

  block = replaceTemplatePlaceholders(block, symbolReplacements);

  block = block.replace(/\{\{#if position\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, inner) => {
    if (!ctx.position) {
      return '';
    }

    return replaceTemplatePlaceholders(inner, getPositionReplacements(ctx.position));
  });

  const fallbackPositionReplacements = ctx.position
    ? getPositionReplacements(ctx.position)
    : {
      'position.side': 'NONE',
      'position.quantity': '0',
      'position.entry_price': '0',
      'position.current_price': '0',
      'position.unrealized_pnl': '0',
      'position.leverage': '0',
      'position.margin': '0',
      'position.liquidation_price': '0',
      'position.stop_loss': 'N/A',
      'position.profit_target': 'N/A',
      'position.exposure': '0',
    };

  block = replaceTemplatePlaceholders(block, fallbackPositionReplacements);

  return block.trim();
}

function replaceTemplatePlaceholders(
  template: string,
  replacements: Record<string, string | number | undefined>
): string {
  let output = template;

  for (const [key, value] of Object.entries(replacements)) {
    if (value === undefined || value === null) {
      continue;
    }

    const regex = new RegExp(`\\{\\{\s*${escapeRegExp(key)}\s*\\}\\}`, 'g');
    output = output.replace(regex, String(value));
  }

  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPositionReplacements(position: Position): Record<string, string> {
  return {
    'position.side': position.side,
    'position.quantity': formatNumber(position.quantity, 4),
    'position.entry_price': formatNumber(position.entryPrice, 2),
    'position.current_price': formatNumber(position.currentPrice, 2),
    'position.unrealized_pnl': formatNumber(position.unrealizedPnl, 2),
    'position.leverage': String(position.leverage),
    'position.margin': formatNumber(position.margin, 2),
    'position.liquidation_price': formatNumber(position.liquidationPrice, 2),
    'position.stop_loss': 'N/A',
    'position.profit_target': 'N/A',
    'position.exposure': formatNumber(position.quantity * position.entryPrice, 2),
  };
}

function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return (0).toFixed(decimals);
  }
  return value.toFixed(decimals);
}

function formatSeries(values?: number[], decimals = 3, maxLength = 10): string | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const slice = values.slice(-maxLength);
  const formatted = slice.map(value => formatNumber(value, decimals));
  return `[${formatted.join(', ')}]`;
}

export function buildTradingPrompt(
  template: string,
  contexts: TradingContext[]
): string {
  return populatePromptTemplate(template, contexts);
}

/**
 * Parse AI response to extract trading decisions
 */
function parseAIResponse(response: string, symbols: string[]): ParsedAIResponse {
  const decisions: TradingDecision[] = [];
  let summary: string | undefined;
  let thinking: string | undefined;

  try {
    // Try to parse as JSON first
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const leadingText = jsonMatch.index !== undefined && jsonMatch.index >= 0
        ? response.slice(0, jsonMatch.index).trim()
        : undefined;
      if (typeof parsed.summary === 'string') {
        summary = parsed.summary.trim();
      }
      if (typeof parsed.analysis === 'string') {
        thinking = parsed.analysis.trim();
      }
      if (Array.isArray(parsed.decisions)) {
        if (!summary && leadingText) {
          summary = leadingText;
        }
        if (!thinking && summary) {
          thinking = summary;
        }
        return {
          decisions: parsed.decisions,
          summary,
          thinking,
        };
      }
    }

    // Fallback: Parse text-based response
    for (const symbol of symbols) {
      const symbolName = symbol.replace('USDT', '');
      const symbolRegex = new RegExp(`${symbolName}[:\\s]+(BUY|SELL|HOLD|CLOSE)`, 'i');
      const match = response.match(symbolRegex);

      if (match) {
        const action = match[1].toUpperCase() as TradingDecision['action'];

        // Extract reasoning (look for text after the action)
        const reasoningRegex = new RegExp(`${symbolName}[:\\s]+${action}[:\\s]+([^\\n]+)`, 'i');
        const reasoningMatch = response.match(reasoningRegex);
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No specific reasoning provided';

        // Extract confidence if mentioned
        const confidenceRegex = /confidence[:\\s]+(\\d+(?:\\.\\d+)?)/i;
        const confidenceMatch = response.match(confidenceRegex);
        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.5;

        decisions.push({
          action,
          symbol,
          reasoning,
          confidence,
        });
      } else {
        // Default to HOLD if no clear action found
        decisions.push({
          action: 'HOLD',
          symbol,
          reasoning: 'No clear signal from AI',
          confidence: 0.3,
        });
      }
    }

    if (!summary) {
      const idx = jsonMatch?.index ?? -1;
      const leadingText = idx >= 0 ? response.slice(0, idx).trim() : response.trim();
      summary = leadingText || undefined;
    }
    if (!thinking && summary) {
      thinking = summary;
    }
  } catch (error) {
    console.error('Error parsing AI response:', error);
    // Return HOLD for all symbols on parse error
    return {
      decisions: symbols.map(symbol => ({
        action: 'HOLD',
        symbol,
        reasoning: 'Error parsing AI response',
        confidence: 0,
      })),
      summary,
      thinking,
    };
  }

  return {
    decisions,
    summary,
    thinking,
  };
}

/**
 * Get trading decisions from AI model using Vercel AI SDK
 */
export async function getAIDecisions(
  contexts: TradingContext[],
  aiModel: string,
  customPrompt: string,
  openRouterApiKey: string
): Promise<TradingDecisionResult> {
  const populatedPrompt = buildTradingPrompt(customPrompt, contexts);
  return getDecisionsFromPrompt(populatedPrompt, contexts, aiModel, openRouterApiKey);
}

export async function getDecisionsFromPrompt(
  prompt: string,
  contexts: TradingContext[],
  aiModel: string,
  openRouterApiKey: string
): Promise<TradingDecisionResult> {
  const maxAttempts = 3;
  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: openRouterApiKey,
    headers: {
      'HTTP-Referer': 'https://roboz.trade',
      'X-Title': 'RobozTrade AI Trading Bot',
    },
  });

  const symbols = contexts.map(ctx => ctx.symbol);
  let lastError: unknown;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { text } = await generateText({
        model: openrouter(aiModel),
        system:
          'You are an expert cryptocurrency futures trader. Analyze the market data and provide clear trading decisions (BUY, SELL, HOLD, or CLOSE) for each symbol with reasoning. Format your response as JSON with a "decisions" array containing objects with: action, symbol, reasoning, confidence (0-1), and optional suggestedQuantity, suggestedLeverage, suggestedStopLoss, suggestedTakeProfit. Include an optional "summary" field for a concise narrative of your outlook and an optional "analysis" field capturing your thinking process.',
        prompt,
        temperature: 0.7,
        maxRetries: 0,
      });

      const parsed = parseAIResponse(text, symbols);
      const runtimeMs = Date.now() - startTime;

      return {
        decisions: parsed.decisions,
        prompt,
        rawResponse: text,
        summary: parsed.summary,
        thinking: parsed.thinking,
        runtimeMs,
        invocations: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        console.error('AI SDK error:', error);
        throw new Error(`AI decision error: ${(error as any)?.message || 'Unknown error'}`);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown AI error');
}

/**
 * Determine target notional based on leverage constraints and configured limits.
 */
export function calculateTargetNotional(
  price: number,
  leverage: number,
  minNotional: number,
  maxNotional: number,
  availableBalance: number
): number {
  if (price <= 0 || leverage <= 0 || maxNotional <= 0 || availableBalance <= 0) {
    return 0;
  }

  const maxAffordableNotional = availableBalance * leverage * 0.9;
  if (maxAffordableNotional < minNotional) {
    return 0;
  }

  const boundedMax = Math.min(maxNotional, maxAffordableNotional);
  return Math.max(minNotional, boundedMax);
}

/**
 * Calculate stop loss and take profit levels
 */
export function calculateRiskLevels(
  entryPrice: number,
  side: 'BUY' | 'SELL',
  leverage: number
): { stopLoss: number; takeProfit: number } {
  // Conservative risk management: 2% stop loss, 4% take profit
  const stopLossPercent = 0.02;
  const takeProfitPercent = 0.04;

  let stopLoss: number;
  let takeProfit: number;

  if (side === 'BUY') {
    stopLoss = entryPrice * (1 - stopLossPercent);
    takeProfit = entryPrice * (1 + takeProfitPercent);
  } else {
    stopLoss = entryPrice * (1 + stopLossPercent);
    takeProfit = entryPrice * (1 - takeProfitPercent);
  }

  return { stopLoss, takeProfit };
}

