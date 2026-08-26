import "server-only";
import { db } from "@/lib/db";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayKey(offsetFromToday: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetFromToday);
  return isoDay(d);
}

export async function getDashboardData() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const d30 = new Date(startOfToday);
  d30.setDate(d30.getDate() - 29);
  const d14 = new Date(startOfToday);
  d14.setDate(d14.getDate() - 13);

  const [
    totalProducts,
    inventories,
    movementsWindow,
    todayMovements,
    pendingDispatches,
    forecasts,
    dispatchRows,
  ] = await Promise.all([
    db.product.count({ where: { isActive: true } }),
    db.inventory.findMany({
      select: {
        quantity: true,
        reservedQuantity: true,
        warehouse: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, price: true, reorderLevel: true } },
      },
    }),
    db.stockMovement.findMany({
      where: { createdAt: { gte: d30 } },
      select: { createdAt: true, quantityDelta: true, quantity: true, type: true, productId: true },
    }),
    db.stockMovement.groupBy({
      by: ["type"],
      where: { createdAt: { gte: startOfToday }, type: { in: ["IN", "OUT"] } },
      _sum: { quantity: true },
    }),
    db.dispatch.count({ where: { status: { in: ["PENDING", "PROCESSING", "READY"] } } }),
    db.forecast.findMany({
      where: { horizon: "D30" },
      select: { productId: true, predictedDemand: true, confidence: true, stockoutRisk: true },
    }),
    db.dispatch.findMany({
      where: { OR: [{ createdAt: { gte: d14 } }, { dispatchedAt: { gte: d14 } }] },
      select: { createdAt: true, dispatchedAt: true },
    }),
  ]);

  // ---- KPIs ---------------------------------------------------------------
  let totalUnits = 0;
  let totalValue = 0;
  const warehouseAgg = new Map<string, { name: string; value: number; units: number }>();
  for (const inv of inventories) {
    const price = parseFloat(inv.product.price.toString());
    totalUnits += inv.quantity;
    totalValue += inv.quantity * price;
    const wh = warehouseAgg.get(inv.warehouse.id) ?? { name: inv.warehouse.name, value: 0, units: 0 };
    wh.value += inv.quantity * price;
    wh.units += inv.quantity;
    warehouseAgg.set(inv.warehouse.id, wh);
  }

  const stockByProduct = new Map<string, number>();
  for (const inv of inventories) {
    stockByProduct.set(
      inv.product.id,
      (stockByProduct.get(inv.product.id) ?? 0) + inv.quantity,
    );
  }
  const lowStockSet = new Set<string>();
  const outOfStockSet = new Set<string>();
  for (const inv of inventories) {
    if (inv.quantity <= 0) outOfStockSet.add(inv.product.id);
    else if (inv.quantity <= inv.product.reorderLevel) lowStockSet.add(inv.product.id);
  }

  const todaysIn = todayMovements.find((t) => t.type === "IN")?._sum.quantity ?? 0;
  const todaysOut = todayMovements.find((t) => t.type === "OUT")?._sum.quantity ?? 0;

  const forecastedDemand30d = Math.round(forecasts.reduce((a, f) => a + f.predictedDemand, 0));

  // ---- Series --------------------------------------------------------------
  const priceByProduct = new Map<string, number>();
  const seenProducts = new Set<string>();
  for (const inv of inventories) {
    if (!seenProducts.has(inv.product.id)) {
      seenProducts.add(inv.product.id);
      priceByProduct.set(inv.product.id, parseFloat(inv.product.price.toString()));
    }
  }

  // Inventory value trend (last 30 days), reconstructed backwards from today.
  const dayKeys = Array.from({ length: 30 }, (_, i) => dayKey(-29 + i));
  const netByDay = new Map<string, number>();
  for (const m of movementsWindow) {
    const key = isoDay(m.createdAt);
    const price = priceByProduct.get(m.productId) ?? 0;
    netByDay.set(key, (netByDay.get(key) ?? 0) + m.quantityDelta * price);
  }
  const windowNet = [...netByDay.values()].reduce((a, b) => a + b, 0);
  let running = totalValue - windowNet;
  const inventoryTrend = dayKeys.map((key) => {
    running += netByDay.get(key) ?? 0;
    return { date: key.slice(5), value: Math.round(running * 100) / 100 };
  });

  // Stock In vs Out (last 14 days)
  const inByDay = new Map<string, number>();
  const outByDay = new Map<string, number>();
  for (const m of movementsWindow) {
    if (m.type !== "IN" && m.type !== "OUT") continue;
    const key = isoDay(m.createdAt);
    if (m.type === "IN") inByDay.set(key, (inByDay.get(key) ?? 0) + m.quantity);
    else outByDay.set(key, (outByDay.get(key) ?? 0) + m.quantity);
  }
  const inVsOut = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(-13 + i);
    return {
      date: key.slice(5),
      inbound: inByDay.get(key) ?? 0,
      outbound: outByDay.get(key) ?? 0,
    };
  });

  // Top moving products (last 30 days)
  const usageByProduct = new Map<string, number>();
  for (const m of movementsWindow) {
    if (m.type !== "OUT") continue;
    usageByProduct.set(m.productId, (usageByProduct.get(m.productId) ?? 0) + m.quantity);
  }
  const productNames = new Map(inventories.map((i) => [i.product.id, i.product]));
  const topMoving = [...usageByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([pid, qty]) => ({
      name: productNames.get(pid)?.name ?? pid,
      quantity: qty,
    }));

  // Dispatch trend (created vs completed per day, 14d)
  const createdMap = new Map<string, number>();
  const dispatchedMap = new Map<string, number>();
  for (const d of dispatchRows) {
    const ck = isoDay(d.createdAt);
    createdMap.set(ck, (createdMap.get(ck) ?? 0) + 1);
    if (d.dispatchedAt) {
      const dk = isoDay(d.dispatchedAt);
      dispatchedMap.set(dk, (dispatchedMap.get(dk) ?? 0) + 1);
    }
  }
  const dispatchTrend = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(-13 + i);
    return {
      date: key.slice(5),
      created: createdMap.get(key) ?? 0,
      completed: dispatchedMap.get(key) ?? 0,
    };
  });

  const inventoryByWarehouse = [...warehouseAgg.values()]
    .sort((a, b) => b.value - a.value)
    .map((w) => ({ name: w.name, value: Math.round(w.value * 100) / 100 }));

  // Low stock list (product-level, worst first)
  const lowStockItems = [...lowStockSet, ...outOfStockSet]
    .map((pid) => {
      const inv = inventories.filter((i) => i.product.id === pid);
      const qty = inv.reduce((a, i) => a + i.quantity, 0);
      return {
        id: pid,
        sku: inv[0]?.product.sku ?? "",
        name: inv[0]?.product.name ?? "",
        quantity: qty,
        reorderLevel: inv[0]?.product.reorderLevel ?? 0,
      };
    })
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 8);

  const highRisks = forecasts.filter((f) => f.stockoutRisk === "HIGH" || f.stockoutRisk === "CRITICAL").length;

  return {
    kpis: {
      totalProducts,
      totalUnits,
      totalValue,
      lowStockCount: lowStockSet.size,
      outOfStockCount: outOfStockSet.size,
      pendingDispatches,
      todaysIn,
      todaysOut,
      forecastedDemand30d,
      highRiskForecasts: highRisks,
      forecastCount: forecasts.length,
    },
    inventoryTrend,
    inVsOut,
    topMoving,
    dispatchTrend,
    inventoryByWarehouse,
    lowStockItems,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
