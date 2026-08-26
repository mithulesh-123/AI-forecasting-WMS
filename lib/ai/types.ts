/**
 * Forecasting domain types.
 *
 * The forecasting engine is a deterministic statistical implementation
 * (Holt double-exponential smoothing with weekly seasonality + safety-stock
 * reorder math). It does NOT call an LLM. The provider interface below exists
 * so a real ML model/API can be swapped in later without touching callers.
 */

export type StockoutRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DemandPoint {
  date: string; // ISO yyyy-mm-dd
  demand: number;
}

export interface ForecastInput {
  /** Daily customer demand, oldest first. Zeros included. */
  history: number[];
  /** ISO start date matching history[0]. */
  startDate: string;
  horizonDays: 7 | 14 | 30;
  /** Sellable stock right now (quantity - reserved). */
  availableStock: number;
  /** Round reorder suggestions up to this pack multiple (0 disables). */
  packSize: number;
}

export interface ForecastBreakdown {
  avgDailyDemand: number;
  trendPerDay: number;
  sigmaDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  daysOfCover: number;
}

export interface ForecastResult {
  method: string;
  predictions: { date: string; demand: number }[];
  predictedDemandTotal: number;
  dailyAvgDemand: number;
  confidence: number;
  stockoutRisk: StockoutRisk;
  recommendedReorderQty: number;
  breakdown: ForecastBreakdown;
}
