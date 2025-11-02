/**
 * Enhanced Risk Management for Bear Markets
 * Add these functions to your ai-trader.ts or create a new risk-management.ts file
 */

import type { TradingContext } from './ai-trader';
import type { Candle } from './aster-api';

export type MarketRegime = 'BULLISH' | 'BEARISH' | 'SIDEWAYS';

export interface MarketRegimeAnalysis {
    regime: MarketRegime;
    confidence: number; // 0-1, how confident we are in this regime
    bearishSignals: number; // count of bearish indicators
    bullishSignals: number; // count of bullish indicators
    reasons: string[];
}

/**
 * Detect market regime based on multiple timeframe analysis
 * More sophisticated than just looking at one indicator
 */
export function detectMarketRegime(
    context: TradingContext
): MarketRegimeAnalysis {
    let bearishSignals = 0;
    let bullishSignals = 0;
    const reasons: string[] = [];

    // 1. Check 4h EMA alignment (strongest signal)
    if (context.higherTimeframeEma20 && context.higherTimeframeEma50) {
        if (context.higherTimeframeEma20 < context.higherTimeframeEma50) {
            bearishSignals += 2; // Double weight for higher timeframe
            reasons.push('4h death cross active (EMA20 < EMA50)');
        } else {
            bullishSignals += 2;
            reasons.push('4h golden cross active (EMA20 > EMA50)');
        }
    }

    // 2. Check current price vs 4h EMA50
    if (context.higherTimeframeEma50) {
        if (context.currentPrice < context.higherTimeframeEma50) {
            bearishSignals++;
            reasons.push(`Price below 4h EMA50 (${context.currentPrice.toFixed(2)} < ${context.higherTimeframeEma50.toFixed(2)})`);
        } else {
            bullishSignals++;
            reasons.push(`Price above 4h EMA50 (${context.currentPrice.toFixed(2)} > ${context.higherTimeframeEma50.toFixed(2)})`);
        }
    }

    // 3. Check 15m trend direction
    if (context.indicators.ema20 < context.indicators.ema50) {
        bearishSignals++;
        reasons.push('15m death cross (short-term trend down)');
    } else {
        bullishSignals++;
        reasons.push('15m golden cross (short-term trend up)');
    }

    // 4. Check RSI levels on 4h
    if (context.higherTimeframeRsi14Series && context.higherTimeframeRsi14Series.length > 0) {
        const latestRsi = context.higherTimeframeRsi14Series[context.higherTimeframeRsi14Series.length - 1];
        if (latestRsi < 45) {
            bearishSignals++;
            reasons.push(`4h RSI bearish (${latestRsi.toFixed(1)} < 45)`);
        } else if (latestRsi > 55) {
            bullishSignals++;
            reasons.push(`4h RSI bullish (${latestRsi.toFixed(1)} > 55)`);
        }
    }

    // 5. Check MACD trend on 4h
    if (context.higherTimeframeMacdSeries && context.higherTimeframeMacdSeries.length >= 3) {
        const latestMacd = context.higherTimeframeMacdSeries[context.higherTimeframeMacdSeries.length - 1];
        const prevMacd = context.higherTimeframeMacdSeries[context.higherTimeframeMacdSeries.length - 2];

        if (latestMacd < 0 && latestMacd < prevMacd) {
            bearishSignals++;
            reasons.push('4h MACD negative and declining');
        } else if (latestMacd > 0 && latestMacd > prevMacd) {
            bullishSignals++;
            reasons.push('4h MACD positive and rising');
        }
    }

    // 6. Check funding rate (sentiment indicator)
    if (context.marketData.fundingRate < -0.01) { // Negative funding = bearish sentiment
        bearishSignals++;
        reasons.push(`Negative funding rate (${context.marketData.fundingRate.toFixed(4)}%) - shorts paying longs`);
    } else if (context.marketData.fundingRate > 0.01) {
        bullishSignals++;
        reasons.push(`Positive funding rate (${context.marketData.fundingRate.toFixed(4)}%) - longs paying shorts`);
    }

    // 7. Check recent price action pattern (higher highs/lower lows)
    if (context.intradayMidPrices && context.intradayMidPrices.length >= 10) {
        const recent = context.intradayMidPrices.slice(-10);
        const firstHalf = recent.slice(0, 5);
        const secondHalf = recent.slice(5);

        const firstHigh = Math.max(...firstHalf);
        const secondHigh = Math.max(...secondHalf);
        const firstLow = Math.min(...firstHalf);
        const secondLow = Math.min(...secondHalf);

        if (secondHigh < firstHigh && secondLow < firstLow) {
            bearishSignals++;
            reasons.push('Lower highs and lower lows pattern');
        } else if (secondHigh > firstHigh && secondLow > firstLow) {
            bullishSignals++;
            reasons.push('Higher highs and higher lows pattern');
        }
    }

    // Determine regime
    let regime: MarketRegime;
    let confidence: number;

    const totalSignals = bearishSignals + bullishSignals;
    const bearishRatio = totalSignals > 0 ? bearishSignals / totalSignals : 0;
    const bullishRatio = totalSignals > 0 ? bullishSignals / totalSignals : 0;

    if (bearishSignals >= 3 && bearishRatio > 0.6) {
        regime = 'BEARISH';
        confidence = Math.min(bearishRatio, 0.95);
    } else if (bullishSignals >= 3 && bullishRatio > 0.6) {
        regime = 'BULLISH';
        confidence = Math.min(bullishRatio, 0.95);
    } else {
        regime = 'SIDEWAYS';
        confidence = 1 - Math.abs(bearishRatio - 0.5) * 2; // Lower confidence when unclear
    }

    return {
        regime,
        confidence,
        bearishSignals,
        bullishSignals,
        reasons,
    };
}

/**
 * Adjust risk parameters based on market regime
 */
export function getRegimeAdjustedRiskParams(
    regime: MarketRegime,
    regimeConfidence: number,
    baseMaxLeverage: number,
    baseMinNotional: number,
    baseMaxNotional: number
): {
    adjustedMaxLeverage: number;
    adjustedMinNotional: number;
    adjustedMaxNotional: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    positionSizeMultiplier: number;
} {
    let adjustedMaxLeverage = baseMaxLeverage;
    let stopLossPercent = 0.02; // 2% default
    let takeProfitPercent = 0.04; // 4% default
    let positionSizeMultiplier = 1.0;

    if (regime === 'BEARISH') {
        // More conservative in bear markets
        adjustedMaxLeverage = Math.floor(baseMaxLeverage * 0.5); // Use 50% of max leverage
        adjustedMaxLeverage = Math.max(adjustedMaxLeverage, 5); // Minimum 5x
        stopLossPercent = 0.015; // Tighter 1.5% stop
        takeProfitPercent = 0.03; // Quicker 3% target
        positionSizeMultiplier = 0.6; // Use 60% of normal size
    } else if (regime === 'BULLISH') {
        // Can be more aggressive in bull markets
        adjustedMaxLeverage = Math.floor(baseMaxLeverage * 0.75); // Use 75% of max leverage
        stopLossPercent = 0.025; // Standard 2.5% stop
        takeProfitPercent = 0.05; // Larger 5% target (let winners run)
        positionSizeMultiplier = 1.0; // Full size
    } else {
        // SIDEWAYS - very conservative
        adjustedMaxLeverage = Math.floor(baseMaxLeverage * 0.4); // Use 40% of max leverage
        adjustedMaxLeverage = Math.max(adjustedMaxLeverage, 3); // Minimum 3x
        stopLossPercent = 0.015; // Tight 1.5% stop
        takeProfitPercent = 0.02; // Quick 2% target (scalping)
        positionSizeMultiplier = 0.5; // Use 50% of normal size
    }

    // Adjust confidence - lower size further if regime confidence is low
    if (regimeConfidence < 0.7) {
        positionSizeMultiplier *= 0.8; // Further reduce by 20% if uncertain
    }

    const adjustedMinNotional = baseMinNotional; // Keep minimum the same
    const adjustedMaxNotional = baseMaxNotional * positionSizeMultiplier;

    return {
        adjustedMaxLeverage,
        adjustedMinNotional,
        adjustedMaxNotional,
        stopLossPercent,
        takeProfitPercent,
        positionSizeMultiplier,
    };
}

/**
 * Enhanced risk calculator that considers market regime
 */
export function calculateRegimeAwareRiskLevels(
    entryPrice: number,
    side: 'BUY' | 'SELL',
    leverage: number,
    regime: MarketRegime,
    stopLossPercent?: number,
    takeProfitPercent?: number
): { stopLoss: number; takeProfit: number } {
    // Use provided percentages or defaults based on regime
    let slPercent: number;
    let tpPercent: number;

    if (stopLossPercent !== undefined && takeProfitPercent !== undefined) {
        slPercent = stopLossPercent;
        tpPercent = takeProfitPercent;
    } else {
        // Default regime-based percentages
        if (regime === 'BEARISH') {
            slPercent = 0.015; // 1.5%
            tpPercent = 0.03; // 3%
        } else if (regime === 'BULLISH') {
            slPercent = 0.025; // 2.5%
            tpPercent = 0.05; // 5%
        } else {
            slPercent = 0.015; // 1.5%
            tpPercent = 0.02; // 2%
        }
    }

    // Adjust for leverage (higher leverage = tighter stops)
    if (leverage > 15) {
        slPercent *= 0.8; // Reduce stop distance by 20% for high leverage
    }

    let stopLoss: number;
    let takeProfit: number;

    if (side === 'BUY') {
        stopLoss = entryPrice * (1 - slPercent);
        takeProfit = entryPrice * (1 + tpPercent);
    } else {
        stopLoss = entryPrice * (1 + slPercent);
        takeProfit = entryPrice * (1 - tpPercent);
    }

    return { stopLoss, takeProfit };
}

/**
 * Determine if we should take a position given the market regime
 * Returns true if position aligns with regime, false otherwise
 */
export function shouldTakePosition(
    action: 'BUY' | 'SELL',
    regime: MarketRegime,
    regimeConfidence: number
): { allowed: boolean; reason: string } {
    // In sideways markets, be very selective
    if (regime === 'SIDEWAYS') {
        if (regimeConfidence > 0.6) {
            return {
                allowed: false,
                reason: 'Sideways market detected - waiting for clear directional move',
            };
        }
        // If confidence is low in sideways, might be transitioning - allow small trades
        return {
            allowed: true,
            reason: 'Low confidence sideways - allowing cautious entry',
        };
    }

    // In bear markets, favor shorts
    if (regime === 'BEARISH') {
        if (action === 'SELL') {
            return {
                allowed: true,
                reason: 'SHORT aligned with bearish regime - good setup',
            };
        } else {
            // LONG in bear market - only if regime confidence is low (might be reversing)
            if (regimeConfidence > 0.75) {
                return {
                    allowed: false,
                    reason: 'LONG rejected - strong bearish regime (catching falling knife)',
                };
            }
            return {
                allowed: true,
                reason: 'LONG allowed but risky - bearish regime weakening, using reduced size',
            };
        }
    }

    // In bull markets, favor longs
    if (regime === 'BULLISH') {
        if (action === 'BUY') {
            return {
                allowed: true,
                reason: 'LONG aligned with bullish regime - good setup',
            };
        } else {
            // SHORT in bull market - only if regime confidence is low
            if (regimeConfidence > 0.75) {
                return {
                    allowed: false,
                    reason: 'SHORT rejected - strong bullish regime (fighting the trend)',
                };
            }
            return {
                allowed: true,
                reason: 'SHORT allowed but risky - bullish regime weakening, using reduced size',
            };
        }
    }

    return { allowed: true, reason: 'Default allow' };
}

/**
 * Calculate volatility-adjusted position size
 * Higher volatility = smaller position size
 */
export function calculateVolatilityAdjustedSize(
    baseNotional: number,
    context: TradingContext
): number {
    if (!context.higherTimeframeAtr3 || !context.higherTimeframeAtr14) {
        return baseNotional; // No adjustment if no ATR data
    }

    // Calculate volatility ratio
    const volatilityRatio = context.higherTimeframeAtr3 / context.higherTimeframeAtr14;

    // If short-term volatility is significantly higher than longer-term, reduce size
    if (volatilityRatio > 1.5) {
        // High volatility - reduce to 50%
        return baseNotional * 0.5;
    } else if (volatilityRatio > 1.2) {
        // Elevated volatility - reduce to 70%
        return baseNotional * 0.7;
    } else if (volatilityRatio < 0.8) {
        // Low volatility - can increase to 110%
        return baseNotional * 1.1;
    }

    return baseNotional; // Normal volatility
}
