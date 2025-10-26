/**
 * Trading Bot Executor Service
 * Main orchestrator for automated trading bot execution
 */

import { nanoid } from 'nanoid';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DEFAULT_PROMPT_TEMPLATE } from '@roboz-trade/shared-types';
import { tradingBots, tradeHistory, botExecutions, positionSnapshots, botMetrics, apiKeys } from '../db/schema';
import { decrypt } from '../lib/crypto';
import * as AsterAPI from './aster-api';
import * as AITrader from './ai-trader';
import { calculateIndicators, calculateATR } from './indicators';
import type { TradingContext, TradingDecision } from './ai-trader';
import type { DbClient } from '../lib/db';
import type { AccountInfo } from './aster-api';

export interface BotExecutionResult {
  botId: string;
  success: boolean;
  tradesExecuted: number;
  errors: string[];
  decisions: TradingDecision[];
  aiPrompt?: string | null;
  aiRawResponse?: string | null;
  aiThinking?: string | null;
  aiRuntimeMs?: number | null;
  aiInvocations?: number | null;
}

/**
 * Shared market data cache to reduce API calls across multiple bot executions
 */
export interface SharedMarketDataCache {
  symbolMetadata: Map<string, AsterAPI.SymbolMetadata>;
  marketData: Map<string, AsterAPI.MarketData>;
  intradayCandles: Map<string, AsterAPI.Candle[]>;
  higherTimeframeCandles: Map<string, AsterAPI.Candle[]>;
}

/**
 * Execute trading logic for a single bot
 */
export async function executeBot(
  botId: string,
  db: DbClient,
  encryptionKey: string,
  pbkdf2Iterations = 100000,
  sharedCache?: SharedMarketDataCache
): Promise<BotExecutionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let tradesExecuted = 0;
  let decisions: TradingDecision[] = [];
  let aiPrompt: string | null = null;
  let aiRawResponse: string | null = null;
  let aiThinking: string | null = null;
  let aiRuntimeMs: number | null = null;
  let aiInvocations: number | null = null;
  let accountInfo: AccountInfo | null = null;
  let totalExposure = 0;

  try {
    // Fetch bot configuration
    const bot = await db.select().from(tradingBots).where(eq(tradingBots.id, botId)).get();

    if (!bot) {
      throw new Error(`Bot ${botId} not found`);
    }

    if (bot.status !== 'active') {
      throw new Error(`Bot ${botId} is not active (status: ${bot.status})`);
    }

    // Resolve encrypted credentials. Support both new (inline) and legacy (shared API key) flows.
    let asterApiKey: string | null = null;
    let asterApiSecret: string | null = null;
    let openRouterApiKey: string | null = null;

    if (bot.asterApiKey && bot.asterApiSecret) {
      asterApiKey = await decrypt(bot.asterApiKey, encryptionKey, pbkdf2Iterations);
      asterApiSecret = await decrypt(bot.asterApiSecret, encryptionKey, pbkdf2Iterations);
    }

    if (bot.openRouterApiKey) {
      openRouterApiKey = await decrypt(bot.openRouterApiKey, encryptionKey, pbkdf2Iterations);
    }

    if ((!asterApiKey || !asterApiSecret) && bot.apiKeyId) {
      const apiKeyRecord = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, bot.apiKeyId))
        .get();

      if (!apiKeyRecord) {
        throw new Error('API credential record not found for bot');
      }

      asterApiKey = await decrypt(apiKeyRecord.apiKey, encryptionKey, pbkdf2Iterations);
      asterApiSecret = await decrypt(apiKeyRecord.apiSecret, encryptionKey, pbkdf2Iterations);
    }

    if (!asterApiKey || !asterApiSecret) {
      throw new Error('Aster credentials not configured for bot');
    }

    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured for bot');
    }

    const credentials: AsterAPI.AsterCredentials = {
      apiKey: asterApiKey,
      apiSecret: asterApiSecret,
    };

    // Get account info
    accountInfo = await AsterAPI.getAccountInfo(credentials);

    // Get current positions
    const allPositions = await AsterAPI.getPositions(credentials);

    // Enrich positions with entry time from trade history
    const enrichedPositions = await Promise.all(
      allPositions.map(async (position) => {
        // Find the open trade for this symbol to get entry time
        const openTrade = await db
          .select()
          .from(tradeHistory)
          .where(
            and(
              eq(tradeHistory.botId, botId),
              eq(tradeHistory.symbol, position.symbol),
              eq(tradeHistory.status, 'OPEN')
            )
          )
          .orderBy(desc(tradeHistory.openedAt))
          .limit(1)
          .get();

        return {
          ...position,
          entryTime: openTrade?.openedAt || undefined,
        };
      })
    );

    totalExposure = enrichedPositions.reduce((sum, position) => {
      return sum + Math.abs(position.quantity * position.entryPrice);
    }, 0);

    // Get bot metrics for performance tracking
    let metrics = await db.select().from(botMetrics).where(eq(botMetrics.botId, botId)).get();
    if (!metrics) {
      // Initialize metrics if not exists
      await db.insert(botMetrics).values({
        id: nanoid(),
        botId,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalReturn: 0,
        totalPnl: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        lastUpdated: new Date(),
      });
      metrics = await db.select().from(botMetrics).where(eq(botMetrics.botId, botId)).get();
    }

    const invocationAggregate = await db
      .select({
        invocationSum: sql<number>`coalesce(sum(${botExecutions.aiInvocations}), 0)`,
        executionCount: sql<number>`count(*)`,
      })
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .get();

    const totalInvocationSum = invocationAggregate?.invocationSum ?? 0;
    const totalExecutionCount = invocationAggregate?.executionCount ?? 0;
    const totalInvocations = totalInvocationSum || totalExecutionCount;

    const executionTimestamp = new Date();
    const executionTimeIso = executionTimestamp.toISOString();
    const botCreationDate = bot.createdAt ? new Date(bot.createdAt) : executionTimestamp;
    const minutesTrading = Math.max(
      0,
      Math.floor((executionTimestamp.getTime() - botCreationDate.getTime()) / 60000)
    );

    // Get initial balance from first execution
    const firstExecution = await db
      .select({ totalBalance: botExecutions.totalBalance })
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .orderBy(botExecutions.executionTime)
      .limit(1)
      .get();

    const initialBalance = firstExecution?.totalBalance || accountInfo.totalBalance;

    // Prepare trading contexts for each symbol
    const tradingSymbols = (bot.tradingSymbols as string[]) || [];
    const contexts: TradingContext[] = [];
    const marketDataSnapshot: Record<string, any> = {};

    // Use shared cache if available, otherwise fetch fresh data
    let symbolMetadataMap: Map<string, AsterAPI.SymbolMetadata>;
    if (sharedCache?.symbolMetadata) {
      symbolMetadataMap = sharedCache.symbolMetadata;
    } else {
      try {
        symbolMetadataMap = await AsterAPI.getSymbolMetadata(credentials);
      } catch (metadataError: any) {
        errors.push(`Failed to load exchange metadata: ${metadataError.message}`);
        console.error('Error fetching symbol metadata:', metadataError);
        symbolMetadataMap = new Map();
      }
    }

    for (const symbol of tradingSymbols) {
      try {
        // Fetch market data - use cache if available
        let marketData: AsterAPI.MarketData;
        let intradayCandles: AsterAPI.Candle[];
        let higherTimeframeCandles: AsterAPI.Candle[];

        if (sharedCache) {
          // Use cached data
          const cachedMarketData = sharedCache.marketData.get(symbol);
          const cachedIntradayCandles = sharedCache.intradayCandles.get(symbol);
          const cachedHigherTimeframeCandles = sharedCache.higherTimeframeCandles.get(symbol);

          if (!cachedMarketData || !cachedIntradayCandles || !cachedHigherTimeframeCandles) {
            throw new Error('Market data not available in cache');
          }

          marketData = cachedMarketData;
          intradayCandles = cachedIntradayCandles;
          higherTimeframeCandles = cachedHigherTimeframeCandles;
        } else {
          // Fetch fresh data
          marketData = await AsterAPI.getMarketData(symbol, credentials);
          intradayCandles = await AsterAPI.getCandles(symbol, '15m', 120, credentials);
          higherTimeframeCandles = await AsterAPI.getCandles(symbol, '4h', 120, credentials);
        }

        const instrument = symbolMetadataMap.get(symbol);

        if (intradayCandles.length === 0) {
          throw new Error('Insufficient intraday candle data');
        }

        if (higherTimeframeCandles.length === 0) {
          throw new Error('Insufficient higher timeframe candle data');
        }

        // Calculate technical indicators
        const indicators = calculateIndicators(intradayCandles);
        const higherTimeframeIndicators = calculateIndicators(higherTimeframeCandles);

        const intradayMidPrices = intradayCandles.map(candle => (candle.high + candle.low) / 2);
        const higherTimeframeAtr3 = calculateATR(higherTimeframeCandles, 3);
        const higherTimeframeAtr14 = calculateATR(higherTimeframeCandles, 14);
        const higherTimeframeVolume = higherTimeframeCandles[higherTimeframeCandles.length - 1]?.volume ?? 0;
        const higherTimeframeVolumeAverage = higherTimeframeCandles
          .slice(-10)
          .reduce((sum, candle) => sum + candle.volume, 0) /
          Math.max(1, Math.min(10, higherTimeframeCandles.length));

        // Find position for this symbol
        const position = enrichedPositions.find(p => p.symbol === symbol);

        const minNotionalPerTrade = bot.minNotionalPerTrade ?? 150;
        // Calculate max affordable notional based on available balance and leverage
        const maxLeverageValue = bot.maxLeverage || 20;
        const maxAffordableNotional = accountInfo.availableBalance * maxLeverageValue * 0.9;
        const configuredMaxNotional = bot.maxNotionalPerTrade ?? Math.max(minNotionalPerTrade, 500);
        // Use the minimum of configured max and what's affordable
        const maxNotionalPerTrade = Math.min(
          Math.max(configuredMaxNotional, minNotionalPerTrade),
          maxAffordableNotional
        );

        const context: TradingContext = {
          symbol,
          currentPrice: marketData.price,
          marketData,
          indicators,
          position,
          currentTimeIso: executionTimeIso,
          accountBalance: accountInfo.availableBalance,
          accountValue: accountInfo.totalBalance,
          initialBalance,
          totalReturn: metrics?.totalReturn || 0,
          sharpeRatio: metrics?.sharpeRatio || 0,
          winRate: metrics?.winRate || 0,
          cycleCount: metrics?.totalTrades || 0,
          minutesTrading,
          totalInvocations,
          totalExecutions: totalExecutionCount,
          maxLeverage: bot.maxLeverage || 20,
          minNotionalPerTrade,
          maxNotionalPerTrade,
          maxOpenTrades: bot.maxOpenTrades || 5,
          currentOpenTrades: enrichedPositions.length,
          accountExposure: totalExposure,
          instrument,
          intradayMidPrices,
          intradayEma20Series: indicators.ema20Series,
          intradayMacdSeries: indicators.macdSeries,
          intradayRsi7Series: indicators.rsi7Series,
          intradayRsi14Series: indicators.rsi14Series,
          higherTimeframeEma20: higherTimeframeIndicators.ema20,
          higherTimeframeEma50: higherTimeframeIndicators.ema50,
          higherTimeframeAtr3: higherTimeframeAtr3,
          higherTimeframeAtr14: higherTimeframeAtr14,
          higherTimeframeVolume,
          higherTimeframeVolumeAverage,
          higherTimeframeMacdSeries: higherTimeframeIndicators.macdSeries,
          higherTimeframeRsi14Series: higherTimeframeIndicators.rsi14Series,
        };

        contexts.push(context);
        marketDataSnapshot[symbol] = {
          marketData,
          intradayIndicators: indicators,
          higherTimeframeIndicators,
          position,
          instrument,
        };

      } catch (error: any) {
        errors.push(`Error fetching data for ${symbol}: ${error.message}`);
        console.error(`Error processing ${symbol}:`, error);
      }
    }

    if (contexts.length === 0) {
      throw new Error('No valid market data available for any symbol');
    }

    // Get AI trading decisions
    const customPrompt = bot.customPrompt || getDefaultPrompt();
    aiPrompt = AITrader.buildTradingPrompt(customPrompt, contexts);
    const aiResult = await AITrader.getDecisionsFromPrompt(
      aiPrompt,
      contexts,
      bot.aiModel || 'anthropic/claude-3.5-sonnet',
      openRouterApiKey
    );
    decisions = aiResult.decisions;
    aiRawResponse = aiResult.rawResponse;
    aiThinking = aiResult.thinking ?? aiResult.summary ?? null;
    aiRuntimeMs = aiResult.runtimeMs ?? null;
    aiInvocations = aiResult.invocations ?? null;

    // Execute trades based on AI decisions
    // IMPORTANT: Sort decisions to execute CLOSE actions first to free up margin
    // This prevents "insufficient margin" errors when closing and opening positions simultaneously
    const sortedDecisions = [...decisions].sort((a, b) => {
      const priority = { CLOSE: 0, SELL: 1, BUY: 2, HOLD: 3 };
      return (priority[a.action] || 99) - (priority[b.action] || 99);
    });

    console.log(`Executing ${sortedDecisions.length} decisions in priority order: ${sortedDecisions.map(d => `${d.action} ${d.symbol}`).join(', ')}`);

    for (const decision of sortedDecisions) {
      try {
        const context = contexts.find(ctx => ctx.symbol === decision.symbol);
        if (!context) continue;

        // Skip if confidence is below threshold
        if (decision.confidence < 0.65) {
          console.log(`Skipping ${decision.symbol} - low confidence: ${decision.confidence}`);
          continue;
        }

        if (decision.action === 'BUY' && context.currentOpenTrades < context.maxOpenTrades) {
          // Open long position
          await executeBuyOrder(decision, context, credentials, db, botId);
          tradesExecuted++;
        } else if (decision.action === 'SELL' && context.currentOpenTrades < context.maxOpenTrades) {
          // Open short position
          await executeSellOrder(decision, context, credentials, db, botId);
          tradesExecuted++;
        } else if (decision.action === 'CLOSE' && context.position) {
          // Close existing position
          await executeCloseOrder(decision, context, credentials, db, botId);
          tradesExecuted++;
        }
        // HOLD - do nothing

      } catch (error: any) {
        errors.push(`Error executing trade for ${decision.symbol}: ${error.message}`);
        console.error(`Error executing trade for ${decision.symbol}:`, error);
      }
    }

    // Save execution log
    await db.insert(botExecutions).values({
      id: nanoid(),
      botId,
      executionTime: new Date(),
      symbolsProcessed: tradingSymbols,
      marketData: marketDataSnapshot,
      aiDecisions: decisions,
      aiPrompt,
      aiResponse: aiRawResponse,
      aiThinking,
      aiRuntimeMs,
      aiInvocations,
      accountBalance: accountInfo?.availableBalance ?? null,
      totalBalance: accountInfo?.totalBalance ?? null,
      unrealizedPnl: accountInfo?.unrealizedPnl ?? null,
      accountExposure: totalExposure,
      tradesExecuted,
      errors: errors.length > 0 ? errors : null,
      executionDuration: Date.now() - startTime,
      status: errors.length === 0 ? 'SUCCESS' : tradesExecuted > 0 ? 'PARTIAL' : 'FAILED',
    });

    // Update position snapshots
    for (const position of enrichedPositions) {
      await db.insert(positionSnapshots).values({
        id: nanoid(),
        botId,
        tradeId: null, // Link to trade if available
        symbol: position.symbol,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        liquidationPrice: position.liquidationPrice,
        unrealizedPnl: position.unrealizedPnl,
        leverage: position.leverage,
        margin: position.margin,
        stopLoss: null,
        takeProfit: null,
        snapshotTime: new Date(),
      });
    }

    return {
      botId,
      success: errors.length === 0,
      tradesExecuted,
      errors,
      decisions,
      aiPrompt,
      aiRawResponse,
      aiThinking,
      aiRuntimeMs,
      aiInvocations,
    };

  } catch (error: any) {
    errors.push(`Fatal error: ${error.message}`);
    console.error(`Fatal error executing bot ${botId}:`, error);

    // Log failed execution
    try {
      await db.insert(botExecutions).values({
        id: nanoid(),
        botId,
        executionTime: new Date(),
        symbolsProcessed: [],
        marketData: {},
        aiDecisions: decisions,
        aiPrompt,
        aiResponse: aiRawResponse,
        aiThinking,
        aiRuntimeMs,
        aiInvocations,
        accountBalance: accountInfo?.availableBalance ?? null,
        totalBalance: accountInfo?.totalBalance ?? null,
        unrealizedPnl: accountInfo?.unrealizedPnl ?? null,
        accountExposure: totalExposure,
        tradesExecuted: 0,
        errors,
        executionDuration: Date.now() - startTime,
        status: 'FAILED',
      });
    } catch (logError) {
      console.error('Error logging failed execution:', logError);
    }

    return {
      botId,
      success: false,
      tradesExecuted: 0,
      errors,
      decisions: [],
      aiPrompt,
      aiRawResponse,
      aiThinking,
      aiRuntimeMs,
      aiInvocations,
    };
  }
}

// Helper functions for executing different order types
async function executeBuyOrder(
  decision: TradingDecision,
  context: TradingContext,
  credentials: AsterAPI.AsterCredentials,
  db: DbClient,
  botId: string
) {
  const leverage = sanitizeLeverage(decision.suggestedLeverage, context.maxLeverage);
  const { quantity, notional } = determineOrderQuantity(decision, context, leverage);

  const order = await AsterAPI.placeOrder(
    {
      symbol: context.symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity,
      leverage,
    },
    credentials
  );

  const entryPrice = order.avgPrice || context.currentPrice;
  const defaultRisk = AITrader.calculateRiskLevels(entryPrice, 'BUY', leverage);
  const rawStopLoss = decision.suggestedStopLoss ?? defaultRisk.stopLoss;
  const rawTakeProfit = decision.suggestedTakeProfit ?? defaultRisk.takeProfit;

  const stopLoss = normalizeStopPrice(rawStopLoss, context.instrument, 'floor');
  const takeProfit = normalizeStopPrice(rawTakeProfit, context.instrument, 'ceil');

  let stopLossOrderId: string | undefined;
  if (stopLoss > 0 && stopLoss < entryPrice) {
    try {
      const slOrder = await AsterAPI.placeOrder(
        {
          symbol: context.symbol,
          side: 'SELL',
          type: 'STOP_MARKET',
          quantity,
          stopPrice: stopLoss,
        },
        credentials
      );
      stopLossOrderId = slOrder.orderId;
    } catch (error) {
      console.error('Error placing stop loss:', error);
    }
  }

  let takeProfitOrderId: string | undefined;
  if (takeProfit > 0 && takeProfit > entryPrice) {
    try {
      const tpOrder = await AsterAPI.placeOrder(
        {
          symbol: context.symbol,
          side: 'SELL',
          type: 'TAKE_PROFIT_MARKET',
          quantity,
          stopPrice: takeProfit,
        },
        credentials
      );
      takeProfitOrderId = tpOrder.orderId;
    } catch (error) {
      console.error('Error placing take profit:', error);
    }
  }

  await db.insert(tradeHistory).values({
    id: nanoid(),
    botId,
    symbol: context.symbol,
    side: 'BUY',
    orderType: 'MARKET',
    quantity,
    entryPrice,
    leverage,
    margin: notional / leverage,
    orderId: order.orderId,
    stopLossOrderId,
    takeProfitOrderId,
    aiReasoning: decision.reasoning,
    status: 'OPEN',
    openedAt: new Date(),
  });
}

async function executeSellOrder(
  decision: TradingDecision,
  context: TradingContext,
  credentials: AsterAPI.AsterCredentials,
  db: DbClient,
  botId: string
) {
  const leverage = sanitizeLeverage(decision.suggestedLeverage, context.maxLeverage);
  const { quantity, notional } = determineOrderQuantity(decision, context, leverage);

  const order = await AsterAPI.placeOrder(
    {
      symbol: context.symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity,
      leverage,
    },
    credentials
  );

  const entryPrice = order.avgPrice || context.currentPrice;
  const defaultRisk = AITrader.calculateRiskLevels(entryPrice, 'SELL', leverage);
  const rawStopLoss = decision.suggestedStopLoss ?? defaultRisk.stopLoss;
  const rawTakeProfit = decision.suggestedTakeProfit ?? defaultRisk.takeProfit;

  const stopLoss = normalizeStopPrice(rawStopLoss, context.instrument, 'ceil');
  const takeProfit = normalizeStopPrice(rawTakeProfit, context.instrument, 'floor');

  let stopLossOrderId: string | undefined;
  if (stopLoss > 0 && stopLoss > entryPrice) {
    try {
      const slOrder = await AsterAPI.placeOrder(
        {
          symbol: context.symbol,
          side: 'BUY',
          type: 'STOP_MARKET',
          quantity,
          stopPrice: stopLoss,
        },
        credentials
      );
      stopLossOrderId = slOrder.orderId;
    } catch (error) {
      console.error('Error placing stop loss:', error);
    }
  }

  let takeProfitOrderId: string | undefined;
  if (takeProfit > 0 && takeProfit < entryPrice) {
    try {
      const tpOrder = await AsterAPI.placeOrder(
        {
          symbol: context.symbol,
          side: 'BUY',
          type: 'TAKE_PROFIT_MARKET',
          quantity,
          stopPrice: takeProfit,
        },
        credentials
      );
      takeProfitOrderId = tpOrder.orderId;
    } catch (error) {
      console.error('Error placing take profit:', error);
    }
  }

  await db.insert(tradeHistory).values({
    id: nanoid(),
    botId,
    symbol: context.symbol,
    side: 'SELL',
    orderType: 'MARKET',
    quantity,
    entryPrice,
    leverage,
    margin: notional / leverage,
    orderId: order.orderId,
    stopLossOrderId,
    takeProfitOrderId,
    aiReasoning: decision.reasoning,
    status: 'OPEN',
    openedAt: new Date(),
  });
}

async function executeCloseOrder(
  decision: TradingDecision,
  context: TradingContext,
  credentials: AsterAPI.AsterCredentials,
  db: DbClient,
  botId: string
) {
  if (!context.position) {
    throw new Error(`No position to close for ${context.symbol}`);
  }

  // Get bot configuration for minimum hold time
  const bot = await db.select().from(tradingBots).where(eq(tradingBots.id, botId)).get();
  const MIN_HOLD_MINUTES = bot?.minHoldMinutes ?? 30;
  const EMERGENCY_LOSS_THRESHOLD = -5; // Allow early close if losing >5%

  // Enforce minimum hold time
  const minutesHeld = context.position.entryTime
    ? Math.floor((Date.now() - new Date(context.position.entryTime).getTime()) / 60000)
    : 0;

  if (minutesHeld < MIN_HOLD_MINUTES) {
    const pnlPercent = (context.position.unrealizedPnl / context.position.margin) * 100;

    if (pnlPercent > EMERGENCY_LOSS_THRESHOLD) {
      console.log(
        `⚠️ Rejecting premature close for ${context.symbol}: ` +
        `position only ${minutesHeld} minutes old (min: ${MIN_HOLD_MINUTES}), ` +
        `PnL: ${pnlPercent.toFixed(2)}% (not emergency loss)`
      );
      return; // Skip this close action
    } else {
      console.log(
        `⚠️ Allowing emergency close for ${context.symbol}: ` +
        `${minutesHeld} min old with ${pnlPercent.toFixed(2)}% loss`
      );
    }
  }

  // Close the position
  const closeOrder = await AsterAPI.closePosition(context.symbol, credentials);

  // Find the open trade in database
  const openTrade = await db
    .select()
    .from(tradeHistory)
    .where(
      and(
        eq(tradeHistory.botId, botId),
        eq(tradeHistory.symbol, context.symbol),
        eq(tradeHistory.status, 'OPEN')
      )
    )
    .get();

  if (openTrade) {
    // Calculate realized PnL based on entry/exit prices and position side
    // For LONG positions (BUY): PnL = (exitPrice - entryPrice) * quantity
    // For SHORT positions (SELL): PnL = (entryPrice - exitPrice) * quantity
    let exitPrice = closeOrder.avgPrice;
    const entryPrice = openTrade.entryPrice;
    const quantity = openTrade.quantity;
    const side = openTrade.side;

    // If avgPrice is 0 or missing, try to get current market price as fallback
    if (!exitPrice || exitPrice === 0) {
      console.warn(`⚠️ Close order avgPrice is ${exitPrice} for ${context.symbol}, using current price from position`);
      exitPrice = context.position?.currentPrice || entryPrice;
    }

    let realizedPnl: number;
    if (side === 'BUY') {
      // LONG position
      realizedPnl = (exitPrice - entryPrice) * quantity;
    } else {
      // SHORT position
      realizedPnl = (entryPrice - exitPrice) * quantity;
    }

    // Subtract fees if available
    const fees = openTrade.fees || 0;
    realizedPnl -= fees;

    console.log(`Closing position for ${context.symbol}:`, {
      side,
      entryPrice,
      exitPrice,
      quantity,
      fees,
      realizedPnl: realizedPnl.toFixed(2),
    });

    // Update trade record
    await db
      .update(tradeHistory)
      .set({
        exitPrice,
        realizedPnl,
        status: 'CLOSED',
        closedAt: new Date(),
      })
      .where(eq(tradeHistory.id, openTrade.id));

    // Update bot metrics
    await updateBotMetrics(db, botId, realizedPnl);
  }
}

async function updateBotMetrics(
  db: DbClient,
  botId: string,
  realizedPnl: number
) {
  const metrics = await db.select().from(botMetrics).where(eq(botMetrics.botId, botId)).get();

  if (metrics) {
    const totalTrades = metrics.totalTrades + 1;
    const winningTrades = realizedPnl > 0 ? metrics.winningTrades + 1 : metrics.winningTrades;
    const losingTrades = realizedPnl < 0 ? metrics.losingTrades + 1 : metrics.losingTrades;
    const totalPnl = metrics.totalPnl + realizedPnl;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

    // Calculate average win/loss
    const totalWinAmount = (metrics.averageWin || 0) * metrics.winningTrades + (realizedPnl > 0 ? realizedPnl : 0);
    const totalLossAmount = (metrics.averageLoss || 0) * metrics.losingTrades + (realizedPnl < 0 ? Math.abs(realizedPnl) : 0);
    const averageWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;

    // Calculate profit factor
    const totalWins = averageWin * winningTrades;
    const totalLosses = averageLoss * losingTrades;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

    // Get initial balance to calculate total return
    const firstExecution = await db
      .select({ totalBalance: botExecutions.totalBalance })
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .orderBy(botExecutions.executionTime)
      .limit(1)
      .get();

    const initialBalance = firstExecution?.totalBalance || 1000; // Default to 1000 if not found
    const totalReturn = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;

    // Calculate Sharpe Ratio from trade history
    const closedTrades = await db
      .select({ realizedPnl: tradeHistory.realizedPnl, margin: tradeHistory.margin })
      .from(tradeHistory)
      .where(and(eq(tradeHistory.botId, botId), eq(tradeHistory.status, 'CLOSED')))
      .all();

    let sharpeRatio = 0;
    if (closedTrades.length > 0) {
      // Calculate returns as percentage of margin for each trade
      const returns = closedTrades
        .filter(t => t.realizedPnl !== null && t.margin > 0)
        .map(t => (t.realizedPnl! / t.margin));

      if (returns.length > 1) {
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev > 0) {
          // Annualize assuming trades happen every 2 hours on average
          const tradesPerYear = 365 * 12; // ~12 trades per day
          const annualizedReturn = avgReturn * tradesPerYear;
          const annualizedStdDev = stdDev * Math.sqrt(tradesPerYear);
          const riskFreeRate = 0.02; // 2% annual risk-free rate
          sharpeRatio = (annualizedReturn - riskFreeRate) / annualizedStdDev;
        }
      }
    }

    // Calculate max drawdown from execution history
    const executions = await db
      .select({ totalBalance: botExecutions.totalBalance })
      .from(botExecutions)
      .where(eq(botExecutions.botId, botId))
      .orderBy(botExecutions.executionTime)
      .all();

    let maxDrawdown = 0;
    if (executions.length > 1) {
      let peak = executions[0]?.totalBalance || initialBalance;
      for (const exec of executions) {
        if (exec.totalBalance && exec.totalBalance > peak) {
          peak = exec.totalBalance;
        }
        if (exec.totalBalance && peak > 0) {
          const drawdown = ((peak - exec.totalBalance) / peak) * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }
      }
    }

    await db
      .update(botMetrics)
      .set({
        totalTrades,
        winningTrades,
        losingTrades,
        totalPnl,
        totalReturn,
        sharpeRatio,
        maxDrawdown,
        winRate,
        averageWin,
        averageLoss,
        profitFactor,
        lastUpdated: new Date(),
      })
      .where(eq(botMetrics.botId, botId));
  }
}

function getDefaultPrompt(): string {
  return DEFAULT_PROMPT_TEMPLATE;
}

function sanitizeLeverage(suggested: number | undefined, maxLeverage: number): number {
  const candidate = suggested && suggested > 0 ? suggested : maxLeverage;
  const clamped = Math.min(candidate, maxLeverage);
  return Math.max(1, clamped);
}

function determineOrderQuantity(
  decision: TradingDecision,
  context: TradingContext,
  leverage: number
): { quantity: number; notional: number } {
  const { instrument } = context;
  const price = context.currentPrice;

  if (price <= 0) {
    throw new Error('Invalid market price');
  }

  const minConfigNotional = Math.max(0, context.minNotionalPerTrade);
  const maxConfigNotional = Math.max(context.maxNotionalPerTrade, minConfigNotional);

  const minNotional = Math.max(minConfigNotional, instrument?.minNotional ?? minConfigNotional);
  const maxNotional = Math.min(maxConfigNotional, instrument?.maxNotional ?? maxConfigNotional);

  if (maxNotional < minNotional) {
    throw new Error('Configured maximum notional is below minimum requirement');
  }

  // Calculate max affordable notional with the actual leverage being used
  const maxAffordableWithLeverage = context.accountBalance * leverage * 0.95;
  const effectiveMaxNotional = Math.min(maxNotional, maxAffordableWithLeverage);

  let targetNotional: number;

  // Check if AI provided target_notional (preferred)
  const aiTargetNotional = (decision as any).targetNotional;
  if (aiTargetNotional && aiTargetNotional > 0) {
    // AI suggested a target notional value
    targetNotional = aiTargetNotional;
    console.log(`Using AI target notional: $${targetNotional.toFixed(2)}`);

    // Cap it to what we can actually afford with this leverage
    if (targetNotional > effectiveMaxNotional) {
      console.log(`AI target notional $${targetNotional.toFixed(2)} exceeds affordable $${effectiveMaxNotional.toFixed(2)} with ${leverage}x leverage - adjusting down`);
      targetNotional = effectiveMaxNotional;
    }

    // Ensure it meets minimum requirements
    if (targetNotional < minNotional) {
      console.log(`AI target notional $${targetNotional.toFixed(2)} below minimum $${minNotional.toFixed(2)} - adjusting up`);
      targetNotional = minNotional;
    }
  } else if (decision.suggestedQuantity && decision.suggestedQuantity > 0) {
    // AI suggested a quantity - calculate its notional value
    targetNotional = decision.suggestedQuantity * price;
    console.log(`Using AI suggested quantity ${decision.suggestedQuantity} -> notional $${targetNotional.toFixed(2)}`);

    // Cap it to what we can actually afford with this leverage
    if (targetNotional > effectiveMaxNotional) {
      console.log(`AI suggested notional $${targetNotional.toFixed(2)} exceeds affordable $${effectiveMaxNotional.toFixed(2)} with ${leverage}x leverage - adjusting down`);
      targetNotional = effectiveMaxNotional;
    }
  } else {
    // No AI suggestion - calculate based on risk parameters
    targetNotional = AITrader.calculateTargetNotional(
      price,
      leverage,
      minNotional,
      effectiveMaxNotional,
      context.accountBalance
    );
    console.log(`Calculated target notional: $${targetNotional.toFixed(2)} (leverage: ${leverage}x, balance: $${context.accountBalance.toFixed(2)})`);
  }

  if (targetNotional <= 0) {
    throw new Error('Insufficient balance to satisfy minimum notional requirement');
  }

  // Ensure we're within bounds
  targetNotional = Math.min(Math.max(targetNotional, minNotional), effectiveMaxNotional);

  // Calculate quantity from target notional (don't use suggestedQuantity if we have targetNotional)
  let quantity: number;

  if (aiTargetNotional && aiTargetNotional > 0) {
    // Use target notional to calculate quantity
    quantity = targetNotional / price;
    console.log(`Calculated quantity from target notional: ${quantity.toFixed(6)} (notional: $${targetNotional.toFixed(2)}, price: $${price.toFixed(2)})`);
  } else if (decision.suggestedQuantity && decision.suggestedQuantity > 0) {
    // Use AI's suggested quantity directly
    quantity = decision.suggestedQuantity;
    console.log(`Using AI suggested quantity: ${quantity.toFixed(6)}`);
  } else {
    // Calculate from target notional
    quantity = targetNotional / price;
    console.log(`Calculated quantity: ${quantity.toFixed(6)} (notional: $${targetNotional.toFixed(2)}, price: $${price.toFixed(2)})`);
  }

  if (instrument) {
    const minQtyBasedOnNotional = minNotional / price;
    const maxQtyBasedOnNotional = maxNotional / price;
    const minQty = Math.max(instrument.minQty, minQtyBasedOnNotional);
    const maxQty = Math.min(instrument.maxQty ?? Number.POSITIVE_INFINITY, maxQtyBasedOnNotional);

    quantity = Math.min(quantity, maxQty);
    quantity = roundDownToStep(quantity, instrument.stepSize);

    if (quantity < minQty) {
      quantity = roundUpToStep(minQty, instrument.stepSize);
    }

    const maxQtyAdjusted = roundDownToStep(maxQty, instrument.stepSize);
    if (quantity > maxQtyAdjusted) {
      quantity = maxQtyAdjusted;
    }

    const postRoundNotional = quantity * price;
    if (postRoundNotional < minNotional - 1e-6) {
      const requiredQty = minNotional / price;
      quantity = roundUpToStep(requiredQty, instrument.stepSize);
    }
  }

  const precision = instrument?.quantityPrecision ?? 6;
  const normalizedQuantity = Number(quantity.toFixed(Math.min(precision, 8)));
  const finalNotional = normalizedQuantity * price;

  if (finalNotional < minNotional - 1e-4) {
    throw new Error(`Quantity below minimum notional requirement (${finalNotional.toFixed(2)} < ${minNotional.toFixed(2)})`);
  }

  // Final safety check: ensure margin requirement doesn't exceed available balance
  // (This should rarely trigger since we capped targetNotional earlier, but good to have)
  const marginRequired = finalNotional / leverage;
  const maxMargin = context.accountBalance * 0.95;
  if (marginRequired > maxMargin) {
    throw new Error(`Insufficient margin: need $${marginRequired.toFixed(2)} but only $${maxMargin.toFixed(2)} available (balance: $${context.accountBalance.toFixed(2)}, leverage: ${leverage}x)`);
  }

  return {
    quantity: normalizedQuantity,
    notional: finalNotional,
  };
}

function countDecimals(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const valueString = value.toString().toLowerCase();
  if (valueString.includes('e-')) {
    const [base, exponent] = valueString.split('e-');
    const baseDecimals = base.includes('.') ? base.split('.')[1].length : 0;
    return parseInt(exponent, 10) + baseDecimals;
  }

  const parts = valueString.split('.');
  return parts[1]?.length ?? 0;
}

function roundDownToStep(value: number, step: number): number {
  if (step <= 0) {
    return value;
  }
  const decimals = countDecimals(step);
  const scaled = Math.floor(value / step + 1e-9);
  return Number((scaled * step).toFixed(decimals));
}

function roundUpToStep(value: number, step: number): number {
  if (step <= 0) {
    return value;
  }
  const decimals = countDecimals(step);
  const scaled = Math.ceil(value / step - 1e-9);
  return Number((scaled * step).toFixed(decimals));
}

function roundToTick(value: number, tickSize: number, mode: 'round' | 'ceil' | 'floor' = 'round'): number {
  if (tickSize <= 0) {
    return value;
  }
  const decimals = countDecimals(tickSize);
  const ratio = value / tickSize;
  let adjusted: number;

  if (mode === 'ceil') {
    adjusted = Math.ceil(ratio - 1e-9);
  } else if (mode === 'floor') {
    adjusted = Math.floor(ratio + 1e-9);
  } else {
    adjusted = Math.round(ratio);
  }

  return Number((adjusted * tickSize).toFixed(decimals));
}

function normalizeStopPrice(
  price: number,
  instrument: AsterAPI.SymbolMetadata | undefined,
  mode: 'round' | 'ceil' | 'floor'
): number {
  if (!instrument) {
    return price;
  }

  return roundToTick(price, instrument.tickSize, mode);
}

