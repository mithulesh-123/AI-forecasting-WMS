import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface ReportFilters {
  from?: string;
  to?: string;
  warehouseId?: string;
  productId?: string;
  category?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportData {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
}

function parseDate(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

export async function buildInventoryReport(filters: ReportFilters): Promise<ReportData> {
  const where: Prisma.InventoryWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.category) where.product = { category: filters.category };

  const rows = await db.inventory.findMany({
    where,
    orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
    select: {
      quantity: true,
      reservedQuantity: true,
      warehouse: { select: { code: true, name: true } },
      product: { select: { sku: true, name: true, category: true, unit: true, price: true, reorderLevel: true } },
    },
  });

  return {
    title: "Inventory Report",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "category", label: "Category" },
      { key: "warehouse", label: "Warehouse" },
      { key: "quantity", label: "Quantity" },
      { key: "reserved", label: "Reserved" },
      { key: "available", label: "Available" },
      { key: "unitPrice", label: "Unit Price" },
      { key: "value", label: "Stock Value" },
      { key: "status", label: "Status" },
    ],
    rows: rows.map((r) => {
      const price = parseFloat(r.product.price.toString());
      const status =
        r.quantity <= 0 ? "OUT_OF_STOCK" : r.quantity <= r.product.reorderLevel ? "LOW_STOCK" : "OK";
      return {
        sku: r.product.sku,
        product: r.product.name,
        category: r.product.category,
        warehouse: `${r.warehouse.code} - ${r.warehouse.name}`,
        quantity: r.quantity,
        reserved: r.reservedQuantity,
        available: r.quantity - r.reservedQuantity,
        unitPrice: price.toFixed(2),
        value: (r.quantity * price).toFixed(2),
        status,
      };
    }),
  };
}

export async function buildMovementReport(filters: ReportFilters): Promise<ReportData> {
  const where: Prisma.StockMovementWhereInput = {};
  const from = parseDate(filters.from);
  const to = parseDate(filters.to, true);
  if (from || to) where.createdAt = { gte: from, lte: to };
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.productId) where.productId = filters.productId;

  const movements = await db.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      createdAt: true,
      type: true,
      quantityDelta: true,
      quantity: true,
      reason: true,
      reference: true,
      warehouse: { select: { code: true } },
      destinationWarehouse: { select: { code: true } },
      product: { select: { sku: true, name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return {
    title: "Stock Movement Report",
    columns: [
      { key: "timestamp", label: "Timestamp" },
      { key: "type", label: "Type" },
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "warehouse", label: "Warehouse" },
      { key: "destination", label: "Destination" },
      { key: "unitsMoved", label: "Units" },
      { key: "stockEffect", label: "Stock Effect" },
      { key: "reason", label: "Reason" },
      { key: "reference", label: "Reference" },
      { key: "user", label: "User" },
    ],
    rows: movements.map((m) => ({
      timestamp: m.createdAt.toISOString(),
      type: m.type,
      sku: m.product.sku,
      product: m.product.name,
      warehouse: m.warehouse.code,
      destination: m.destinationWarehouse?.code ?? "",
      unitsMoved: m.quantity,
      stockEffect: m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta,
      reason: m.reason ?? "",
      reference: m.reference ?? "",
      user: m.user?.name ?? "",
    })),
  };
}

export async function buildDispatchReport(filters: ReportFilters): Promise<ReportData> {
  const where: Prisma.DispatchWhereInput = {};
  const from = parseDate(filters.from);
  const to = parseDate(filters.to, true);
  if (from || to) where.createdAt = { gte: from, lte: to };
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;

  const dispatches = await db.dispatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      number: true,
      customerName: true,
      status: true,
      requestedAt: true,
      dispatchedAt: true,
      warehouse: { select: { code: true, name: true } },
      createdByUser: { select: { name: true } },
      items: { select: { quantity: true, product: { select: { price: true } } } },
    },
  });

  return {
    title: "Dispatch Report",
    columns: [
      { key: "number", label: "Dispatch No" },
      { key: "customer", label: "Customer" },
      { key: "warehouse", label: "Warehouse" },
      { key: "status", label: "Status" },
      { key: "items", label: "Lines" },
      { key: "units", label: "Units" },
      { key: "value", label: "Value" },
      { key: "requestedAt", label: "Requested" },
      { key: "dispatchedAt", label: "Dispatched" },
      { key: "createdBy", label: "Created By" },
    ],
    rows: dispatches.map((d) => {
      const units = d.items.reduce((a, i) => a + i.quantity, 0);
      const value = d.items.reduce(
        (a, i) => a + i.quantity * parseFloat(i.product.price.toString()),
        0,
      );
      return {
        number: d.number,
        customer: d.customerName,
        warehouse: d.warehouse.code,
        status: d.status,
        items: d.items.length,
        units,
        value: value.toFixed(2),
        requestedAt: d.requestedAt.toISOString(),
        dispatchedAt: d.dispatchedAt?.toISOString() ?? "",
        createdBy: d.createdByUser.name,
      };
    }),
  };
}

export async function buildForecastReport(filters: ReportFilters): Promise<ReportData> {
  const where: Prisma.ForecastWhereInput = {};
  if (filters.category) where.product = { category: filters.category };
  if (filters.productId) where.productId = filters.productId;

  const forecasts = await db.forecast.findMany({
    where,
    orderBy: [{ product: { name: "asc" } }, { horizon: "asc" }],
    include: { product: { include: { inventories: true } } },
  });

  return {
    title: "AI Forecast Report",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "horizon", label: "Horizon (days)" },
      { key: "currentStock", label: "Current Stock" },
      { key: "predictedDemand", label: "Predicted Demand" },
      { key: "dailyAvgDemand", label: "Avg Daily Demand" },
      { key: "stockoutRisk", label: "Stockout Risk" },
      { key: "reorderQty", label: "Recommended Reorder" },
      { key: "confidence", label: "Confidence %" },
      { key: "method", label: "Method" },
      { key: "generatedAt", label: "Generated At" },
    ],
    rows: forecasts.map((f) => ({
      sku: f.product.sku,
      product: f.product.name,
      horizon: f.horizon === "D7" ? 7 : f.horizon === "D14" ? 14 : 30,
      currentStock: f.product.inventories.reduce((a, i) => a + i.quantity, 0),
      predictedDemand: Math.round(f.predictedDemand * 10) / 10,
      dailyAvgDemand: f.dailyAvgDemand,
      stockoutRisk: f.stockoutRisk,
      reorderQty: f.recommendedReorderQty,
      confidence: f.confidence,
      method: f.method,
      generatedAt: f.generatedAt.toISOString(),
    })),
  };
}
