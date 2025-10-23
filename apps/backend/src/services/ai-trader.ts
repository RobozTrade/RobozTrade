/**
 * AI Trading Decision Service
 * Uses Vercel AI SDK with OpenRouter to make trading decisions based on market data
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { MarketData, Position } from './aster-api';
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
  maxMarginPerTrade: number;
  maxOpenTrades: number;
  currentOpenTrades: number;
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
  let prompt = template;

  // Replace global variables
  const firstContext = contexts[0];
  prompt = prompt.replace(/\{\{current_time\}\}/g, new Date().toISOString());
  prompt = prompt.replace(/\{\{cycle_count\}\}/g, firstContext.cycleCount.toString());
  prompt = prompt.replace(/\{\{minutes_trading\}\}/g, firstContext.minutesTrading.toString());
  prompt = prompt.replace(/\{\{available_cash\}\}/g, firstContext.accountBalance.toFixed(2));
  prompt = prompt.replace(/\{\{account_value\}\}/g, firstContext.accountValue.toFixed(2));
  prompt = prompt.replace(/\{\{total_return\}\}/g, firstContext.totalReturn.toFixed(2));
  prompt = prompt.replace(/\{\{sharpe_ratio\}\}/g, firstContext.sharpeRatio.toFixed(3));
  prompt = prompt.replace(/\{\{max_leverage\}\}/g, firstContext.maxLeverage.toString());
  prompt = prompt.replace(/\{\{max_margin_per_trade\}\}/g, firstContext.maxMarginPerTrade.toString());
  prompt = prompt.replace(/\{\{max_open_trades\}\}/g, firstContext.maxOpenTrades.toString());

  // Build symbol-specific data
  let symbolsData = '';
  for (const ctx of contexts) {
    const symbolName = ctx.symbol.replace('USDT', '');
    symbolsData += `\n${symbolName}:\n`;
    symbolsData += `- Price: ${ctx.currentPrice.toFixed(2)} (EMA20: ${ctx.indicators.ema20.toFixed(2)})\n`;
    symbolsData += `- MACD: ${ctx.indicators.macd.toFixed(2)} | RSI(7): ${ctx.indicators.rsi7.toFixed(1)}\n`;
    symbolsData += `- Open Interest: ${ctx.marketData.openInterest.toFixed(0)} | Funding Rate: ${(ctx.marketData.fundingRate * 100).toFixed(4)}%\n`;

    if (ctx.position) {
      symbolsData += `- Current Position: ${ctx.position.quantity.toFixed(4)} @ ${ctx.position.entryPrice.toFixed(2)} (PnL: ${ctx.position.unrealizedPnl.toFixed(2)} USDT)\n`;
      symbolsData += `- Leverage: ${ctx.position.leverage}x | Liquidation: ${ctx.position.liquidationPrice.toFixed(2)}\n`;
    } else {
      symbolsData += `- No open position\n`;
    }
  }

  // Replace the {{#each symbols}} block with actual data
  prompt = prompt.replace(/\{\{#each symbols\}\}[\s\S]*?\{\{\/each\}\}/g, symbolsData);

  return prompt;
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
 * Calculate position size based on risk parameters
 */
export function calculatePositionSize(
  price: number,
  leverage: number,
  maxMarginPerTrade: number,
  availableBalance: number
): number {
  const maxMargin = Math.min(maxMarginPerTrade, availableBalance * 0.9); // Use max 90% of available balance
  const notionalValue = maxMargin * leverage;
  const quantity = notionalValue / price;

  return quantity;
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

