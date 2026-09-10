import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { runProductForecast, type ProductForecast } from "@/lib/ai/service";
import {
  ForecastClient,
  type WarehouseForecastItem,
  type ForecastSummaryStats,
} from "./forecast-client";
import { Card, CardContent } from "@/components/ui/card";
import { BrainCircuit } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "AI Demand Forecasting" };
export const dynamic = "force-dynamic";

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePagePermission("forecast:read", "/forecast");
  const params = await searchParams;
  const shouldPersist = can(user.role, "forecast:run");

  // Fetch all active products and warehouses
  const [products, warehouses] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      include: {
        inventories: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.warehouse.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
  ]);

  if (products.length === 0 || warehouses.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Demand Forecasting"
          description="AI-driven stockout prediction, safety limits optimization, and lead-time depletion charts."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <BrainCircuit className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No active products or warehouses configured</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Add products and warehouses to your inventory system to generate AI-driven demand projections.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Generate forecasts across products
  const productForecasts = new Map<string, { f7: ProductForecast; f14: ProductForecast; f30: ProductForecast }>();

  await Promise.all(
    products.map(async (product) => {
      try {
        const [f7, f14, f30] = await Promise.all([
          runProductForecast(product.id, 7, { persist: shouldPersist }),
          runProductForecast(product.id, 14, { persist: shouldPersist }),
          runProductForecast(product.id, 30, { persist: shouldPersist }),
        ]);
        productForecasts.set(product.id, { f7, f14, f30 });
      } catch {
        // Fallback for products with no demand history
        const dummyForecast = (h: 7 | 14 | 30): ProductForecast => ({
          method: "local-statistical",
          predictedDemandTotal: 0,
          dailyAvgDemand: 0,
          confidence: 45,
          stockoutRisk: "LOW",
          recommendedReorderQty: 0,
          predictions: Array.from({ length: h }, (_, i) => ({
            date: new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
            demand: 0,
          })),
          breakdown: {
            avgDailyDemand: 0,
            trendPerDay: 0,
            sigmaDemand: 0,
            safetyStock: 0,
            leadTimeDays: 7,
            reorderPoint: product.reorderLevel || 10,
            daysOfCover: 999,
          },
          productId: product.id,
          sku: product.sku,
          name: product.name,
          horizonDays: h,
          currentStock: product.inventories.reduce((sum, inv) => sum + inv.quantity, 0),
          availableStock: Math.max(
            0,
            product.inventories.reduce((sum, inv) => sum + (inv.quantity - inv.reservedQuantity), 0)
          ),
        });

        productForecasts.set(product.id, {
          f7: dummyForecast(7),
          f14: dummyForecast(14),
          f30: dummyForecast(30),
        });
      }
    })
  );

  // Build warehouse-level forecast items
  const items: WarehouseForecastItem[] = [];

  for (const product of products) {
    const fc = productForecasts.get(product.id);
    const f30 = fc?.f30;

    for (const warehouse of warehouses) {
      const inv = product.inventories.find((i) => i.warehouseId === warehouse.id);
      const stock = inv ? inv.quantity : 0;
      const reorderLevel = product.reorderLevel || 10;
      const reorderQuantity = product.reorderQuantity || 50;

      // Warehouse-level demand velocity based on operational profile
      const whFactor = warehouse.code.includes("EAST") ? 1.25 : warehouse.code.includes("WEST") ? 1.0 : 0.75;
      const baseNetworkDailyDemand = f30?.dailyAvgDemand || (reorderLevel / 7);
      const dailyDemand = Math.max(0.5, Math.round(((baseNetworkDailyDemand / Math.max(1, warehouses.length)) * whFactor) * 10) / 10);

      const forecast7d = Math.round(dailyDemand * 7);
      const forecast14d = Math.round(dailyDemand * 14);
      const forecast30d = Math.round(dailyDemand * 30);

      // Days until stockout
      let daysUntilStockout: number | "Never" = "Never";
      if (stock <= 0) {
        daysUntilStockout = 0;
      } else if (dailyDemand > 0) {
        daysUntilStockout = Math.floor(stock / dailyDemand);
      } else {
        daysUntilStockout = "Never";
      }

      // Risk classification across CRITICAL, HIGH, MEDIUM, and LOW bands
      let risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
      if (stock <= 0 || (typeof daysUntilStockout === "number" && daysUntilStockout <= 7) || stock <= reorderLevel * 0.4) {
        risk = "CRITICAL";
      } else if ((typeof daysUntilStockout === "number" && daysUntilStockout <= 14) || stock <= reorderLevel * 0.95) {
        risk = "HIGH";
      } else if ((typeof daysUntilStockout === "number" && daysUntilStockout <= 30) || stock <= reorderLevel * 1.6) {
        risk = "MEDIUM";
      } else {
        risk = "LOW";
      }

      // Recommended reorder calculation
      let recommendedReorderQty = 0;
      if (risk === "CRITICAL" || risk === "HIGH" || stock <= reorderLevel) {
        const needed = Math.max(0, reorderLevel * 2 + forecast30d - stock);
        recommendedReorderQty =
          reorderQuantity > 0 ? Math.ceil(needed / reorderQuantity) * reorderQuantity : needed;
      }

      // Confidence score
      const confScore = f30?.confidence ?? 65;
      const confidence: "LOW" | "MEDIUM" | "HIGH" =
        confScore >= 75 ? "HIGH" : confScore >= 50 ? "MEDIUM" : "LOW";

      const itemId = `${product.id}_${warehouse.id}`;

      items.push({
        id: itemId,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        currentStock: stock,
        avgDailyDemand: dailyDemand,
        forecast7d,
        forecast14d,
        forecast30d,
        daysUntilStockout,
        risk,
        reorderQuantity,
        recommendedReorderQty,
        confidence,
        reorderPoint: f30?.breakdown.reorderPoint ?? reorderLevel,
        leadTimeDays: f30?.breakdown.leadTimeDays ?? 7,
      });
    }
  }

  // Calculate summary stats
  const stats: ForecastSummaryStats = {
    totalForecasted: items.length,
    highRiskDepletions: items.filter((i) => i.risk === "CRITICAL" || i.risk === "HIGH").length,
    predictedStockouts14d: items.filter(
      (i) => i.daysUntilStockout !== "Never" && (i.daysUntilStockout === 0 || (typeof i.daysUntilStockout === "number" && i.daysUntilStockout <= 14))
    ).length,
    reorderRecommendations: items.filter((i) => i.recommendedReorderQty > 0 || i.currentStock <= i.reorderPoint).length,
  };

  const initialSelectedId = params.productId
    ? items.find((i) => i.productId === params.productId)?.id ?? items[0]?.id
    : items[0]?.id;

  return (
    <ForecastClient
      items={items}
      stats={stats}
      initialSelectedId={initialSelectedId}
    />
  );
}
