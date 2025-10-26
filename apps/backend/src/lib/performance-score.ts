/**
 * Performance Score Calculation
 * 
 * Formula: Performance Score = (Total P&L % / Max Drawdown %) × ln(N - N_min)
 * 
 * Where:
 * - Total P&L %: The bot's total percentage gain/loss
 * - Max Drawdown %: The bot's worst loss from peak
 * - N: Total number of trades
 * - N_min: Minimum trades required to qualify (50)
 * - ln: Natural logarithm (provides diminishing returns for more trades)
 * 
 * This is a modified Calmar Ratio with a confidence score based on trade count.
 */

export const MIN_TRADES_TO_QUALIFY = 50;

export interface PerformanceScoreInput {
  totalPnl: number;           // Total realized P&L in dollars
  initialBalance: number;     // Initial account balance
  maxDrawdown: number;        // Maximum drawdown in dollars
  totalTrades: number;        // Total number of closed trades
}

export interface PerformanceScoreResult {
  score: number;              // Final performance score
  totalPnlPercent: number;    // Total P&L as percentage
  maxDrawdownPercent: number; // Max drawdown as percentage
  calmarRatio: number;        // Core ratio (P&L % / MDD %)
  confidenceScore: number;    // ln(N - N_min)
  qualifies: boolean;         // Whether bot meets minimum trade requirement
  totalTrades: number;        // Number of trades
}

/**
 * Calculate performance score for a trading bot
 */
export function calculatePerformanceScore(
  input: PerformanceScoreInput
): PerformanceScoreResult {
  const { totalPnl, initialBalance, maxDrawdown, totalTrades } = input;

  // Check if bot qualifies
  const qualifies = totalTrades >= MIN_TRADES_TO_QUALIFY;

  // Calculate percentages
  const totalPnlPercent = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;
  const maxDrawdownPercent = initialBalance > 0 ? (Math.abs(maxDrawdown) / initialBalance) * 100 : 0;

  // Prevent division by zero and handle edge cases
  if (!qualifies) {
    return {
      score: 0,
      totalPnlPercent,
      maxDrawdownPercent,
      calmarRatio: 0,
      confidenceScore: 0,
      qualifies: false,
      totalTrades,
    };
  }

  // Calculate Calmar Ratio (reward/risk)
  // Use a minimum drawdown of 1% to prevent extreme scores
  const effectiveDrawdown = Math.max(maxDrawdownPercent, 1);
  const calmarRatio = totalPnlPercent / effectiveDrawdown;

  // Calculate confidence score with diminishing returns
  // ln(N - N_min) rewards more trades but with logarithmic scaling
  const confidenceScore = Math.log(totalTrades - MIN_TRADES_TO_QUALIFY + 1);

  // Final performance score
  // Allow negative scores for bots with losses
  const score = calmarRatio * confidenceScore;

  return {
    score, // Can be negative for losing bots
    totalPnlPercent,
    maxDrawdownPercent,
    calmarRatio,
    confidenceScore,
    qualifies: true,
    totalTrades,
  };
}

/**
 * Calculate max drawdown from trade history
 * This tracks the worst peak-to-trough decline
 */
export function calculateMaxDrawdown(trades: Array<{ realizedPnl: number | null }>): number {
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;

  trades.forEach((trade) => {
    runningPnl += trade.realizedPnl || 0;

    // Update peak if we've reached a new high
    if (runningPnl > peak) {
      peak = runningPnl;
    }

    // Calculate current drawdown from peak
    const drawdown = peak - runningPnl;

    // Update max drawdown if current is worse
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return maxDrawdown;
}

/**
 * Get the formula as a string for display
 */
export function getPerformanceScoreFormula(): string {
  return `Performance Score = (Total P&L % / Max Drawdown %) × ln(N - ${MIN_TRADES_TO_QUALIFY})`;
}

/**
 * Get a detailed explanation of the formula
 */
export function getPerformanceScoreExplanation(): string {
  return `The Performance Score is a modified Calmar Ratio that measures risk-adjusted returns with a confidence factor:

• Total P&L %: Your bot's total percentage gain or loss
• Max Drawdown %: The worst peak-to-trough decline (risk measure)
• N: Total number of closed trades
• Minimum Trades: ${MIN_TRADES_TO_QUALIFY} trades required to qualify

The natural logarithm (ln) provides diminishing returns for trade count, preventing bots with thousands of trades from dominating the leaderboard unfairly.`;
}

