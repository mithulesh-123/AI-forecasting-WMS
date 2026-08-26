/** Small deterministic statistics helpers used by the forecasting engine. */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Mean Absolute Percentage Error over one-step-ahead residuals (%). */
export function mape(actual: number[], fitted: number[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i]!;
    if (a === 0) continue; // skip zero-demand days, MAPE undefined there
    sum += Math.abs((a - fitted[i]!) / a);
    count += 1;
  }
  if (count === 0) return 100;
  return (sum / count) * 100;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Deterministic weekday index helpers (0=Sunday … 6=Saturday). */
export function dayOfWeek(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Greatest multiple of `multiple` that is <= value, floored at 0. */
export function ceilToMultiple(value: number, multiple: number): number {
  if (value <= 0) return 0;
  if (!multiple || multiple <= 1) return Math.ceil(value);
  return Math.ceil(value / multiple) * multiple;
}
