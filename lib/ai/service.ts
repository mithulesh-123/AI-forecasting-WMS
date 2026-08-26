import "server-only";
import type { ForecastHorizon, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { HISTORY_WINDOW_DAYS } from "@/lib/constants";
import { getForecastProvider } from "./provider";
import type { DemandPoint, ForecastInput, ForecastResult } from "./types";

type HorizonDays = 7 | 14 | 30;

function horizonToEnum(days: HorizonDays): ForecastHorizon {
  return days === 7 ? "D7" : days === 14 ? "D14" : "D30";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Builds a dense daily demand series (oldest → newest) from OUT movements.
 * Dispatch completions write OUT movements, so customer demand is captured
 * through the immutable ledger.
 */
export async function getDemandHistory(productId: string, days = HISTORY_WINDOW_DAYS): Promise<DemandPoint[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const grouped = await db.stockMovement.groupBy({
    by: ["createdAt"],
    where: {
      productId,
      type: "OUT",
      createdAt: { gte: since },
    },
    _sum: { quantity: true },
  });

  // groupBy on createdAt groups by exact timestamp; aggregate per day in JS
  const byDay = new Map<string, number>();
  for (const row of grouped) {
    const key = isoDate(row.createdAt);
    byDay.set(key, (byDay.get(key) ?? 0) + (row._sum.quantity ?? 0));
  }

  const series: DemandPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = isoDate(d);
    series.push({ date: key, demand: byDay.get(key) ?? 0 });
  }
  return series;
}

export interface ProductForecast extends ForecastResult {
  productId: string;
  sku: string;
  name: string;
  horizonDays: HorizonDays;
  currentStock: number;
  availableStock: number;
}

export async function runProductForecast(
  productId: string,
  horizonDays: HorizonDays,
  options: { persist?: boolean } = {},
): Promise<ProductForecast> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { inventories: true },
  });
  if (!product) throw new NotFoundError("Product");

  const history = await getDemandHistory(productId);
  const currentStock = product.inventories.reduce((acc, i) => acc + i.quantity, 0);
  const reserved = product.inventories.reduce((acc, i) => acc + i.reservedQuantity, 0);
  const availableStock = Math.max(0, currentStock - reserved);

  const input: ForecastInput = {
    history: history.map((p) => p.demand),
    startDate: history[0]!.date,
    horizonDays,
    availableStock,
    packSize: product.reorderQuantity || 1,
  };

  const provider = getForecastProvider();
  let result: ForecastResult;
  try {
    result = await provider.generate(input);
  } catch (error) {
    // External providers must never break forecasting - degrade to local math.
    if (provider.name === "local-statistical") throw error;
    console.warn("[forecast] external provider failed, using local engine:", error);
    const local = getForecastProvider();
    result = await (local.name === "local-statistical" ? local.generate(input) : Promise.reject(error));
  }

  if (options.persist) {
    const data = {
      predictedDemand: result.predictedDemandTotal,
      dailyAvgDemand: result.dailyAvgDemand,
      confidence: result.confidence,
      stockoutRisk: result.stockoutRisk,
      recommendedReorderQty: result.recommendedReorderQty,
      method: `${result.method}${provider.name !== "local-statistical" ? `+${provider.name}` : ""}`,
      history: JSON.parse(JSON.stringify(history.slice(-45))) as Prisma.InputJsonValue,
      predictions: JSON.parse(JSON.stringify(result.predictions)) as Prisma.InputJsonValue,
      generatedAt: new Date(),
    };
    await db.forecast.upsert({
      where: {
        productId_horizon: { productId, horizon: horizonToEnum(horizonDays) },
      },
      create: { productId, horizon: horizonToEnum(horizonDays), ...data },
      update: data,
    });
  }

  return {
    ...result,
    productId: product.id,
    sku: product.sku,
    name: product.name,
    horizonDays,
    currentStock,
    availableStock,
  };
}

/** Forecasts for the overview table: products with the most recent movement activity. */
export async function runTopForecasts(
  limit = 12,
  horizonDays: HorizonDays = 30,
): Promise<ProductForecast[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const active = await db.product.findMany({
    where: { isActive: true },
    select: { id: true },
    take: 200,
  });
  if (active.length === 0) return [];

  const usage = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { type: "OUT", createdAt: { gte: since }, productId: { in: active.map((p) => p.id) } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const ids = usage.map((u) => u.productId);
  const results = await Promise.all(ids.map((id) => runProductForecast(id, horizonDays)));
  return results;
}
