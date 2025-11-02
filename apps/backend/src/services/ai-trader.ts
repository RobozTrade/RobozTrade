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
  currentTimeIso?: string;
  accountBalance: number;
  accountValue: number;
  initialBalance: number;
  totalReturn: number;
  sharpeRatio: number;
  winRate: number;
  cycleCount: number;
  minutesTrading: number;
  totalInvocations?: number;
  totalExecutions?: number;
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
  invalidationCondition?: string; // Conditions that would invalidate the position thesis
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
    current_time: firstContext.currentTimeIso ?? new Date().toISOString(),
    cycle_count: formatNumber(firstContext.cycleCount ?? 0, 0),
    minutes_trading: formatNumber(firstContext.minutesTrading ?? 0, 0),
    total_invocations: formatNumber(
      firstContext.totalInvocations ?? firstContext.totalExecutions ?? 0,
      0
    ),
    total_executions: formatNumber(firstContext.totalExecutions ?? 0, 0),
    available_cash: formatNumber(firstContext.accountBalance, 2),
    account_balance: formatNumber(firstContext.accountBalance, 2),
    balance: formatNumber(firstContext.accountBalance, 2),
    account_value: formatNumber(firstContext.accountValue, 2),
    initial_balance: formatNumber(firstContext.initialBalance, 2),
    total_return: formatNumber(firstContext.totalReturn, 2),
    sharpe_ratio: formatNumber(firstContext.sharpeRatio, 3),
    win_rate: formatNumber((firstContext.winRate ?? 0) * 100, 1),
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

  // Build numeric values map for conditional evaluation (before formatting)
  const numericValues: Record<string, number> = {
    current_price: ctx.currentPrice,
    current_ema20: ctx.indicators.ema20,
    current_ema50: ctx.indicators.ema50 ?? ctx.indicators.ema20,
    current_macd: ctx.indicators.macd,
    current_macd_signal: ctx.indicators.macdSignal,
    current_macd_histogram: ctx.indicators.macdHistogram,
    current_rsi: ctx.indicators.rsi7,
    current_rsi7: ctx.indicators.rsi7,
    current_rsi14: ctx.indicators.rsi14 ?? ctx.indicators.rsi7,
    ht_ema20: ctx.higherTimeframeEma20 ?? 0,
    ht_ema50: ctx.higherTimeframeEma50 ?? 0,
    ht_atr3: ctx.higherTimeframeAtr3 ?? 0,
    ht_atr14: ctx.higherTimeframeAtr14 ?? 0,
    ht_volume_current: ctx.higherTimeframeVolume ?? 0,
    ht_volume_average: ctx.higherTimeframeVolumeAverage ?? 0,
    'position.unrealized_pnl': ctx.position?.unrealizedPnl ?? 0,
  };

  // First, evaluate conditional expressions like {{#if (gt var1 var2)}}
  block = evaluateConditionals(block, numericValues, ctx.position);

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
    funding_rate: formatNumber(ctx.marketData.fundingRate, 4),
    funding_rate_decimal: formatNumber(ctx.marketData.fundingRate / 100, 6),
    funding_rate_percent: formatNumber(ctx.marketData.fundingRate, 4),
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
    ht_volume_average: ctx.higherTimeframeVolumeAverage !== undefined
      ? formatNumber(ctx.higherTimeframeVolumeAverage, 2)
      : undefined,
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
      'position.notional': '0',
      'position.liquidation_price': '0',
      'position.stop_loss': 'N/A',
      'position.profit_target': 'N/A',
      'position.exposure': '0',
      'position.entry_time': 'N/A',
      'position.minutes_held': 'N/A',
      'position.reasoning': 'N/A',
      'position.invalidation_condition': 'N/A',
    };

  block = replaceTemplatePlaceholders(block, fallbackPositionReplacements);

  return block.trim();
}

/**
 * Evaluate conditional expressions like {{#if (gt var1 var2)}}
 */
function evaluateConditionals(
  template: string,
  numericValues: Record<string, number>,
  position?: Position
): string {
  let output = template;
  let changed = true;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  // Process conditionals iteratively to handle nested cases
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Handle {{#if (gt var1 var2)}}...{{else}}...{{/if}}
    // Match: {{#if (gt var1 var2)}}...{{else}}...{{/if}}
    // or: {{#if (gt var1 var2)}}...{{/if}}
    const conditionalRegex = /\{\{#if\s+\((\w+)\s+([^\s\)]+)\s+([^\s\)]+)\)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/;

    const newOutput = output.replace(conditionalRegex, (match, operator, var1, var2, trueBlock, falseBlock = '') => {
      // Get numeric values for variables
      const val1 = getNumericValue(var1, numericValues, position);
      const val2 = getNumericValue(var2, numericValues, position);

      // Evaluate condition based on operator
      let condition = false;
      switch (operator) {
        case 'gt':
          condition = val1 > val2;
          break;
        case 'lt':
          condition = val1 < val2;
          break;
        case 'gte':
        case 'ge':
          condition = val1 >= val2;
          break;
        case 'lte':
        case 'le':
          condition = val1 <= val2;
          break;
        case 'eq':
          condition = Math.abs(val1 - val2) < 0.0001; // Floating point comparison
          break;
        case 'ne':
          condition = Math.abs(val1 - val2) >= 0.0001;
          break;
        default:
          console.warn(`Unknown conditional operator: ${operator}`);
          return match; // Return original if unknown operator
      }

      if (match !== (condition ? trueBlock : falseBlock)) {
        changed = true;
      }

      return condition ? trueBlock : falseBlock;
    });

    output = newOutput;
  }

  return output;
}

/**
 * Get numeric value for a variable, handling both simple variables and nested properties like position.unrealized_pnl
 */
function getNumericValue(
  variable: string,
  numericValues: Record<string, number>,
  position?: Position
): number {
  // Handle nested properties like position.unrealized_pnl
  if (variable.startsWith('position.')) {
    const prop = variable as keyof typeof numericValues;
    if (prop in numericValues) {
      return numericValues[prop];
    }
    // Fallback: try to get from position object
    if (position && variable === 'position.unrealized_pnl') {
      return position.unrealizedPnl ?? 0;
    }
    return 0;
  }

  // Handle simple variables
  if (variable in numericValues) {
    return numericValues[variable];
  }

  // Try to parse as number
  const parsed = parseFloat(variable);
  if (!isNaN(parsed)) {
    return parsed;
  }

  return 0;
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

    const regex = new RegExp(`\{\{\s*${escapeRegExp(key)}\s*\}\}`, 'g');
    output = output.replace(regex, String(value));
  }

  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPositionReplacements(position: Position): Record<string, string> {
  const minutesSinceEntry = position.entryTime
    ? Math.floor((Date.now() - new Date(position.entryTime).getTime()) / 60000)
    : null;

  const entryTimeFormatted = minutesSinceEntry !== null
    ? minutesSinceEntry < 60
      ? `${minutesSinceEntry} min`
      : minutesSinceEntry < 1440
        ? `${Math.floor(minutesSinceEntry / 60)}h ${minutesSinceEntry % 60}m`
        : `${Math.floor(minutesSinceEntry / 1440)}d ${Math.floor((minutesSinceEntry % 1440) / 60)}h`
    : 'N/A';

  const notional = position.quantity * position.entryPrice;

  return {
    'position.side': position.side,
    'position.quantity': formatNumber(position.quantity, 4),
    'position.entry_price': formatNumber(position.entryPrice, 2),
    'position.current_price': formatNumber(position.currentPrice, 2),
    'position.unrealized_pnl': formatNumber(position.unrealizedPnl, 2),
    'position.leverage': String(position.leverage),
    'position.margin': formatNumber(position.margin, 2),
    'position.notional': formatNumber(notional, 2),
    'position.liquidation_price': formatNumber(position.liquidationPrice, 2),
    'position.stop_loss': 'N/A',
    'position.profit_target': 'N/A',
    'position.exposure': formatNumber(notional, 2),
    'position.entry_time': entryTimeFormatted,
    'position.minutes_held': minutesSinceEntry !== null ? String(minutesSinceEntry) : 'N/A',
    'position.reasoning': position.reasoning || 'No reasoning available',
    'position.invalidation_condition': position.invalidationCondition || 'Not specified',
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

function sanitizeJsonString(input: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inString) {
      result += char;
      if (char === '"') {
        inString = true;
      }
      continue;
    }

    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = false;
      continue;
    }

    switch (char) {
      case '\n':
        result += '\\n';
        break;
      case '\r':
        result += '\\r';
        break;
      case '\t':
        result += '\\t';
        break;
      default: {
        const code = char.charCodeAt(0);
        if (code >= 0 && code < 32) {
          result += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
          result += char;
        }
      }
    }
  }

  return result;
}

/**
 * Parse AI response to extract trading decisions
 */
function parseAIResponse(response: string, symbols: string[]): ParsedAIResponse {
  const decisions: TradingDecision[] = [];
  let summary: string | undefined;
  let thinking: string | undefined;

  const tryParseJson = (input: string): any => {
    const sanitizedInput = sanitizeJsonString(input);
    try {
      return JSON.parse(sanitizedInput);
    } catch (error) {
      const controlStripped = sanitizedInput.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
      if (controlStripped !== sanitizedInput) {
        try {
          return JSON.parse(controlStripped);
        } catch (sanitizedError) {
          console.warn('Failed to parse sanitized AI JSON response:', sanitizedError);
        }
      }
      throw error;
    }
  };

  const extractJsonFromMarkdown = (input: string): string => {
    // Check for markdown code blocks
    const codeBlockRegex = /```(?:json|javascript)?\s*\n?([\s\S]*?)\n?```/i;
    const match = input.match(codeBlockRegex);
    if (match) {
      return match[1].trim();
    }
    return input;
  };

  const mapJsonDecision = (entry: any, index: number): TradingDecision | null => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const action = (entry.action ?? entry.Action ?? '').toString().toUpperCase();
    const symbol = (entry.symbol ?? entry.Symbol ?? symbols[index] ?? '').toString().toUpperCase();

    if (!['BUY', 'SELL', 'HOLD', 'CLOSE'].includes(action) || !symbol) {
      return null;
    }

    let confidenceValue = Number(entry.confidence ?? entry.Confidence ?? 0.5);
    if (!Number.isFinite(confidenceValue)) {
      confidenceValue = 0.5;
    }
    if (confidenceValue > 1 && confidenceValue <= 100) {
      confidenceValue /= 100;
    }
    confidenceValue = Math.max(0, Math.min(confidenceValue, 1));

    const decision: TradingDecision = {
      action: action as TradingDecision['action'],
      symbol,
      reasoning: (entry.reasoning ?? entry.Reasoning ?? '').toString(),
      invalidationCondition: (entry.invalidation_condition ?? entry.InvalidationCondition ?? '').toString(),
      confidence: confidenceValue,
    };

    if (entry.target_notional !== undefined) {
      const value = Number(entry.target_notional);
      if (Number.isFinite(value)) {
        (decision as any).targetNotional = value;
      }
    }

    if (entry.targetNotional !== undefined) {
      const value = Number(entry.targetNotional);
      if (Number.isFinite(value)) {
        (decision as any).targetNotional = value;
      }
    }

    if (entry.suggestedQuantity !== undefined) {
      const qty = Number(entry.suggestedQuantity);
      if (Number.isFinite(qty)) {
        if ((decision as any).targetNotional === undefined && qty >= 10 && qty <= 10000) {
          // Treat as notional in USDT when value looks like sizing
          (decision as any).targetNotional = qty;
        } else {
          decision.suggestedQuantity = qty;
        }
      }
    }

    if (entry.quantity !== undefined && decision.suggestedQuantity === undefined) {
      const qty = Number(entry.quantity);
      if (Number.isFinite(qty)) {
        decision.suggestedQuantity = qty;
      }
    }

    if (entry.leverage !== undefined) {
      const leverage = Number(entry.leverage);
      if (Number.isFinite(leverage)) {
        decision.suggestedLeverage = leverage;
      }
    }

    if (entry.suggestedLeverage !== undefined) {
      const leverage = Number(entry.suggestedLeverage);
      if (Number.isFinite(leverage)) {
        decision.suggestedLeverage = leverage;
      }
    }

    if (entry.stop_loss !== undefined) {
      const stop = Number(entry.stop_loss);
      if (Number.isFinite(stop)) {
        decision.suggestedStopLoss = stop;
      }
    }

    if (entry.suggestedStopLoss !== undefined) {
      const stop = Number(entry.suggestedStopLoss);
      if (Number.isFinite(stop)) {
        decision.suggestedStopLoss = stop;
      }
    }

    if (entry.take_profit !== undefined) {
      const take = Number(entry.take_profit);
      if (Number.isFinite(take)) {
        decision.suggestedTakeProfit = take;
      }
    }

    if (entry.suggestedTakeProfit !== undefined) {
      const take = Number(entry.suggestedTakeProfit);
      if (Number.isFinite(take)) {
        decision.suggestedTakeProfit = take;
      }
    }

    return decision;
  };

  try {
    // Try to parse as JSON first
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let parsed: any | null = null;
      try {
        parsed = tryParseJson(extractJsonFromMarkdown(jsonMatch[0]));
      } catch (jsonError) {
        console.warn('AI response included invalid JSON, falling back to text parsing:', jsonError);
      }

      if (parsed) {
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

          // Map AI response fields to expected interface fields
          const mappedDecisions = parsed.decisions
            .map((entry: any, index: number) => mapJsonDecision(entry, index))
            .filter((decision: TradingDecision | null): decision is TradingDecision => decision !== null);

          if (mappedDecisions.length > 0) {
            return {
              decisions: mappedDecisions,
              summary,
              thinking,
            };
          }
        }
      }
    }

    // Try parsing entire response as JSON if no braced block matched
    try {
      const parsed = tryParseJson(extractJsonFromMarkdown(response));
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.decisions)) {
        const mappedDecisions = parsed.decisions
          .map((entry: any, index: number) => mapJsonDecision(entry, index))
          .filter((decision: TradingDecision | null): decision is TradingDecision => decision !== null);

        if (mappedDecisions.length > 0) {
          if (typeof parsed.summary === 'string') {
            summary = parsed.summary.trim();
          }
          if (typeof parsed.analysis === 'string') {
            thinking = parsed.analysis.trim();
          }
          if (!thinking && summary) {
            thinking = summary;
          }

          return {
            decisions: mappedDecisions,
            summary,
            thinking,
          };
        }
      }
    } catch (fullParseError) {
      // Ignore and fall back to heuristics below
      console.warn('Full-response JSON parse failed, using heuristics:', fullParseError);
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

        const invalidationRegex = /invalidation_condition[:\\s]+([^\\n]+)/i;
        const invalidationMatch = response.match(invalidationRegex);
        const invalidationCondition = invalidationMatch ? invalidationMatch[1].trim() : undefined;

        // Extract confidence if mentioned
        const confidenceRegex = /confidence[:\\s]+(\\d+(?:\\.\\d+)?)/i;
        const confidenceMatch = response.match(confidenceRegex);
        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.5;

        decisions.push({
          action,
          symbol,
          reasoning,
          invalidationCondition,
          confidence,
        });
      } else {
        // Default to HOLD if no clear action found
        decisions.push({
          action: 'HOLD',
          symbol,
          reasoning: 'No clear signal from AI',
          confidence: 0.3,
          invalidationCondition: 'No clear signal from AI',
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
        invalidationCondition: 'Error parsing AI response',
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
        system: `You are a PATIENT and STRATEGIC cryptocurrency futures trader who values position development over rapid trading.

CRITICAL TRADING RULES:
1. MINIMUM HOLD TIME: Only close positions if:
   - Position held >30 minutes AND technical signals clearly reversed, OR
   - Stop loss/take profit levels reached, OR
   - Significant adverse market event (>3% move against position)

2. TRADING COSTS: Each trade incurs ~0.05% in fees. Frequent trading erodes profits. Quality over quantity.

3. POSITION MANAGEMENT: Let winning positions run. Cut losing positions quickly, but give trades time to develop their thesis.

4. AVOID FLIP-FLOPPING: Don't reverse positions rapidly. If you close a position, you should have strong conviction before reopening.

5. LEVERAGE & NOTIONAL: Remember that NOTIONAL = MARGIN * LEVERAGE. With the available balance and leverage, you can control much larger positions than the cash balance alone.

RESPONSE FORMAT REQUIREMENTS:
You MUST respond with valid JSON ONLY - no markdown code blocks, no explanations outside JSON.

Structure:
{
  "summary": "Brief market overview",
  "decisions": [
    {
      "symbol": "BTCUSDT",
      "action": "BUY" | "SELL" | "HOLD" | "CLOSE",
      "target_notional": 200,
      "leverage": 10,
      "stop_loss": 42000,
      "take_profit": 46000,
      "confidence": 0.75,
      "reasoning": "Detailed reasoning",
      "invalidation_condition": "Specific conditions"
    }
  ]
}

CRITICAL JSON RULES:
- NO markdown code blocks (no \`\`\`json or \`\`\`)
- Use double quotes for strings
- Numbers must be raw numbers, not strings
- Actions: "BUY", "SELL", "HOLD", "CLOSE" (uppercase)
- Confidence: 0-1 decimal (e.g., 0.75)
- target_notional is TOTAL POSITION SIZE in USDT (not margin, not quantity)

IMPORTANT: target_notional should be the desired position size in USDT (e.g., 150 means $150 worth of the asset), NOT the quantity of coins. This is the NOTIONAL value (total position size), and the system will calculate the required MARGIN by dividing by leverage.

Include an "summary" field for a concise narrative of your outlook and an optional "analysis" field capturing your thinking process.`,
        prompt,
        temperature: 0.4,
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

