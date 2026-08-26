import { describe, expect, it } from "vitest";
import { generateForecast } from "@/lib/ai/forecaster";
import { ceilToMultiple } from "@/lib/ai/stats";
import type { ForecastInput } from "@/lib/ai/types";

function makeHistory(days: number, fn: (i: number) => number): number[] {
  return Array.from({ length: days }, (_, i) => fn(i));
}

function baseInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  const history = makeHistory(90, (i) => (i % 7 === 0 || i % 7 === 6 ? 2 : 10));
  return {
    history,
    startDate: "2026-05-29", // a Friday
    horizonDays: 30,
    availableStock: 400,
    packSize: 50,
    ...overrides,
  };
}

describe("generateForecast - deterministic statistical engine", () => {
  it("is deterministic: same input → identical output", () => {
    const input = baseInput();
    const a = generateForecast(input);
    const b = generateForecast(input);
    expect(a).toEqual(b);
  });

  it("produces exactly horizonDays predictions with non-negative demand", () => {
    for (const horizon of [7, 14, 30] as const) {
      const result = generateForecast(baseInput({ horizonDays: horizon }));
      expect(result.predictions).toHaveLength(horizon);
      for (const p of result.predictions) {
        expect(p.demand).toBeGreaterThanOrEqual(0);
        expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(result.predictedDemandTotal).toBeCloseTo(
        result.predictions.reduce((acc, p) => acc + p.demand, 0),
        1,
      );
    }
  });

  it("captures upward trend (forecast exceeds flat-history mean)", () => {
    // Linear growth 4→16 units/day over 90 days
    const rising = generateForecast(
      baseInput({ history: makeHistory(90, (i) => 4 + (12 * i) / 89) }),
    );
    expect(rising.breakdown.trendPerDay).toBeGreaterThan(0.05);
    expect(rising.predictedDemandTotal / 30).toBeGreaterThan(14);
  });

  it("returns zero predictions when there is no demand history", () => {
    const empty = generateForecast(baseInput({ history: Array.from({ length: 90 }, () => 0) }));
    expect(empty.predictedDemandTotal).toBe(0);
    expect(empty.dailyAvgDemand).toBe(0);
    expect(empty.stockoutRisk).toBe("LOW"); // no demand → no stockout risk
    expect(empty.recommendedReorderQty).toBe(0);
    expect(empty.confidence).toBeLessThanOrEqual(70);
  });

  it("classifies CRITICAL when stock is zero or cover is below lead time floor", () => {
    const zero = generateForecast(baseInput({ availableStock: 0 }));
    expect(zero.stockoutRisk).toBe("CRITICAL");

    // ~1 unit/day avg vs 3 units available → under 4-day floor
    const thin = generateForecast(
      baseInput({ history: makeHistory(90, () => 1), availableStock: 3 }),
    );
    expect(thin.stockoutRisk).toBe("CRITICAL");
  });

  it("classifies HIGH risk when cover is well inside the horizon", () => {
    const result = generateForecast(
      baseInput({
        history: makeHistory(90, (i) => (i % 7 === 6 ? 3 : 9)), // ≈8/day
        availableStock: 100, // ≈12 days of cover < 30*0.6
        horizonDays: 30,
      }),
    );
    expect(["HIGH", "CRITICAL"]).toContain(result.stockoutRisk);
    expect(result.recommendedReorderQty).toBeGreaterThan(0);
  });

  it("recommends reorder = ceil-to-pack(ROP + forecast − available)", () => {
    const input = baseInput({ availableStock: 150, packSize: 50 });
    const result = generateForecast(input);
    if (result.breakdown.reorderPoint + result.predictedDemandTotal > 150) {
      const raw =
        result.breakdown.reorderPoint + result.predictedDemandTotal - input.availableStock;
      expect(result.recommendedReorderQty).toBe(Math.ceil(raw / 50) * 50);
      expect(result.recommendedReorderQty).toBeGreaterThanOrEqual(raw - 49);
    }
  });

  it("keeps confidence within sane bounds and lowers it on sparse data", () => {
    const dense = generateForecast(baseInput());
    expect(dense.confidence).toBeGreaterThanOrEqual(35);
    expect(dense.confidence).toBeLessThanOrEqual(96);

    const sparse = generateForecast(
      baseInput({
        history: [5, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 6],
      }),
    );
    expect(sparse.confidence).toBeLessThanOrEqual(dense.confidence);
  });

  it("weekly seasonality lifts weekday forecasts over weekend ones", () => {
    // Strong weekday/weekend split in history
    const history = makeHistory(84, (i) => {
      const dow = (new Date(`2026-03-06T00:00:00Z`).getUTCDay() + i) % 7; // start Friday
      return dow === 0 || dow === 6 ? 2 : 12;
    });
    const result = generateForecast(
      baseInput({ history, startDate: "2026-05-29", horizonDays: 7 }),
    );
    const weekend = result.predictions.filter((p) => {
      const dow = new Date(`${p.date}T00:00:00Z`).getUTCDay();
      return dow === 0 || dow === 6;
    });
    const weekdays = result.predictions.filter((p) => {
      const dow = new Date(`${p.date}T00:00:00Z`).getUTCDay();
      return dow !== 0 && dow !== 6;
    });
    const avgWeekend = weekend.reduce((a, p) => a + p.demand, 0) / Math.max(1, weekend.length);
    const avgWeekday = weekdays.reduce((a, p) => a + p.demand, 0) / Math.max(1, weekdays.length);
    expect(avgWeekday).toBeGreaterThan(avgWeekend * 1.5);
  });
});

describe("ceilToMultiple", () => {
  it("rounds up to the nearest pack size", () => {
    expect(ceilToMultiple(101, 50)).toBe(150);
    expect(ceilToMultiple(150, 50)).toBe(150);
    expect(ceilToMultiple(1, 50)).toBe(50);
  });

  it("handles disabled/malformed multiples and non-positive values", () => {
    expect(ceilToMultiple(0, 50)).toBe(0);
    expect(ceilToMultiple(-10, 50)).toBe(0);
    expect(ceilToMultiple(10.4, 1)).toBe(11);
    expect(ceilToMultiple(10.4, 0)).toBe(11);
  });
});
