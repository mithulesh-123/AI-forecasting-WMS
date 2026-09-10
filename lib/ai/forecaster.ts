import { clamp, ceilToMultiple, dayOfWeek, addDaysIso, mape, mean, round, stddev } from "./stats";
import type { ForecastInput, ForecastResult, StockoutRisk } from "./types";

/**
 * LocalStatisticalForecaster
 * -------------------------
 * Deterministic demand forecasting:
 *   1. Holt double-exponential smoothing captures level + trend.
 *   2. Multiplicative weekly seasonality (weekday indices, shrunk toward 1
 *      when history is thin) modulates the base projection.
 *   3. One-step-ahead backtest MAPE yields a confidence score.
 *   4. Safety stock uses z=1.65 (~95% service level) over observed demand
 *      volatility; reorder point = lead-time demand + safety stock.
 *
 * Same inputs always produce the same outputs - no randomness involved.
 */

const ALPHA = 0.35; // level smoothing
const BETA = 0.12; // trend smoothing
export const LEAD_TIME_DAYS = 7;
export const SERVICE_LEVEL_Z = 1.65;

interface HoltState {
  fitted: number[]; // one-step-ahead fitted values for history[1..n]
  level: number;
  trend: number;
}

function holtLinear(history: number[]): HoltState {
  if (history.length === 0) return { fitted: [], level: 0, trend: 0 };
  let level = history[0]!;
  let trend = history.length > 1 ? (history[1]! - history[0]!) : 0;
  const fitted: number[] = [history[0]!];
  for (let i = 1; i < history.length; i++) {
    const forecast = level + trend;
    fitted.push(forecast);
    const prevLevel = level;
    level = ALPHA * history[i]! + (1 - ALPHA) * forecast;
    trend = BETA * (level - prevLevel) + (1 - BETA) * trend;
  }
  return { fitted, level, trend };
}

/** Multiplicative weekday factors shrunk toward 1.0 with limited data. */
export function weeklyFactors(history: number[], startDate: string): number[] {
  const sums = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);
  history.forEach((demand, i) => {
    const dow = dayOfWeek(addDaysIso(startDate, i));
    sums[dow]! += demand;
    counts[dow]! += 1;
  });
  const overall = mean(history);
  if (overall <= 0) return Array.from({ length: 7 }, () => 1);
  const raw = sums.map((s, i) => {
    const dayAvg = counts[i]! > 0 ? s / counts[i]! : overall;
    return dayAvg / overall;
  });
  // Shrink: fewer observations per weekday → closer to 1.
  const shrink = counts.map((c) => c / (c + 4));
  return raw.map((r, i) => 1 + shrink[i]! * (r - 1));
}

function classifyRisk(availableStock: number, avgDailyDemand: number, horizonDays: number): StockoutRisk {
  if (availableStock <= 0) return "CRITICAL";
  if (avgDailyDemand <= 0) return "LOW";
  const daysOfCover = availableStock / avgDailyDemand;
  if (daysOfCover < Math.min(LEAD_TIME_DAYS, 4)) return "CRITICAL";
  if (daysOfCover < horizonDays * 0.6) return "HIGH";
  if (daysOfCover < horizonDays * 1.1) return "MEDIUM";
  return "LOW";
}

export function generateForecast(input: ForecastInput): ForecastResult {
  const { history, startDate, horizonDays, availableStock, packSize } = input;

  const { fitted, level, trend } = holtLinear(history);
  const factors = weeklyFactors(history, startDate);

  // Recent demand is more representative than the full window average.
  const recentWindow = history.slice(-Math.min(28, history.length));
  const avgDailyDemand = mean(recentWindow);

  // Project forward with seasonal modulation.
  const predictions: { date: string; demand: number }[] = [];
  for (let h = 1; h <= horizonDays; h++) {
    const date = addDaysIso(startDate, history.length - 1 + h);
    const dow = dayOfWeek(date);
    const raw = Math.max(0, level + trend * h) * factors[dow]!;
    predictions.push({ date, demand: round(raw, 1) });
  }
  const predictedDemandTotal = round(
    predictions.reduce((acc, p) => acc + p.demand, 0),
    1,
  );

  // Confidence from one-step-ahead backtest accuracy.
  const actual = history.slice(1).map((v) => v as number);
  const oneStepFitted = fitted.slice(1);
  const errorPct = mape(actual, oneStepFitted);
  const nonZeroDays = history.filter((d) => d > 0).length;
  let confidence = clamp(Math.round(100 - errorPct), 35, 96);
  if (nonZeroDays < 10) confidence = Math.min(confidence, 70);
  if (nonZeroDays < 4) confidence = Math.min(confidence, 50);

  const sigmaDemand = stddev(history.slice(-42));
  const safetyStock = Math.ceil(SERVICE_LEVEL_Z * sigmaDemand * Math.sqrt(LEAD_TIME_DAYS));
  const reorderPoint = Math.ceil(avgDailyDemand * LEAD_TIME_DAYS + safetyStock);
  const daysOfCover =
    avgDailyDemand > 0 ? round(availableStock / avgDailyDemand, 1) : Number.POSITIVE_INFINITY;

  const recommendedReorderQty = ceilToMultiple(
    Math.max(0, reorderPoint + predictedDemandTotal - availableStock),
    packSize,
  );

  const stockoutRisk = classifyRisk(availableStock, avgDailyDemand, horizonDays);

  return {
    method: "holt-linear-weekly-v1",
    predictions,
    predictedDemandTotal,
    dailyAvgDemand: round(avgDailyDemand, 2),
    confidence,
    stockoutRisk,
    recommendedReorderQty,
    breakdown: {
      avgDailyDemand: round(avgDailyDemand, 2),
      trendPerDay: round(trend, 3),
      sigmaDemand: round(sigmaDemand, 2),
      leadTimeDays: LEAD_TIME_DAYS,
      safetyStock,
      reorderPoint,
      daysOfCover: Number.isFinite(daysOfCover) ? daysOfCover : -1,
    },
  };
}
