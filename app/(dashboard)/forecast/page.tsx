import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BrainCircuit, Gauge, RefreshCcw, ShoppingCart, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { HISTORY_WINDOW_DAYS } from "@/lib/constants";
import { getDemandHistory, runProductForecast, runTopForecasts, type ProductForecast } from "@/lib/ai/service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ForecastChart, type ForecastChartData } from "@/components/charts/forecast-chart";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Forecast" };
export const dynamic = "force-dynamic";

const HORIZONS = [7, 14, 30] as const;

function RiskBadge({ risk }: { risk: ProductForecast["stockoutRisk"] }) {
  const variant =
    risk === "CRITICAL" ? "destructive" : risk === "HIGH" ? "warning" : risk === "MEDIUM" ? "default" : "success";
  return <Badge variant={variant}>{risk}</Badge>;
}

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePagePermission("forecast:read", "/forecast");
  const params = await searchParams;
  const horizon = (HORIZONS as readonly number[]).includes(Number(params.horizon))
    ? (Number(params.horizon) as 7 | 14 | 30)
    : 30;
  const shouldPersist = can(user.role, "forecast:run");

  // Candidate products = those with outbound activity in the last 60 days
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const usage = await db.stockMovement.groupBy({
    by: ["productId"],
    where: { type: "OUT", createdAt: { gte: since } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 40,
  });
  const candidates = await db.product.findMany({
    where: { id: { in: usage.map((u) => u.productId) }, isActive: true },
    select: { id: true, sku: true, name: true },
    orderBy: { name: "asc" },
  });

  if (candidates.length === 0) {
    return (
      <div>
        <PageHeader title="AI Demand Forecast" description="Statistical demand forecasting & stockout risk" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <BrainCircuit className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Not enough history yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              The forecasting engine needs outbound stock movements to learn demand. Record Stock OUT
              operations or complete dispatches, then return here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedId =
    params.productId && candidates.some((c) => c.id === params.productId)
      ? params.productId
      : candidates[0]!.id;

  // Run the deterministic engine for the selected product (+ persist latest)
  const forecast = await runProductForecast(selectedId, horizon, { persist: shouldPersist });

  // Chart series: last 45 days of actuals joined with predictions
  const history = await getDemandHistory(selectedId);
  const chartData: ForecastChartData[] = [];
  for (const point of history.slice(-45)) {
    chartData.push({ date: point.date.slice(5), actual: point.demand, predicted: null });
  }
  // Bridge the series so the dashed line connects visually
  const lastActual = history[history.length - 1];
  if (lastActual) {
    chartData.push({ date: lastActual.date.slice(5), actual: lastActual.demand, predicted: forecast.predictions[0]?.demand ?? null });
  }
  for (const p of forecast.predictions.slice(1)) {
    chartData.push({ date: p.date.slice(5), actual: null, predicted: p.demand });
  }

  const atRisk = await db.forecast.findMany({
    where: { stockoutRisk: { in: ["HIGH", "CRITICAL"] }, horizon: "D30" },
    include: { product: { select: { id: true, sku: true, name: true } } },
    orderBy: [{ stockoutRisk: "desc" }, { predictedDemand: "desc" }],
    take: 10,
  });
  let topRisky: Array<{ id: string; sku: string; name: string; risk: string; reorderQty: number; confidence: number }> =
    atRisk.map((f) => ({
      id: f.product.id,
      sku: f.product.sku,
      name: f.product.name,
      risk: f.stockoutRisk,
      reorderQty: f.recommendedReorderQty,
      confidence: f.confidence,
    }));

  // Fallback when no persisted forecasts exist yet
  if (topRisky.length === 0 && shouldPersist) {
    const runs = await runTopForecasts(8, 30);
    topRisky = runs
      .filter((r) => r.stockoutRisk === "HIGH" || r.stockoutRisk === "CRITICAL")
      .map((r) => ({
        id: r.productId,
        sku: r.sku,
        name: r.name,
        risk: r.stockoutRisk,
        reorderQty: r.recommendedReorderQty,
        confidence: r.confidence,
      }));
  }

  function linkWith(mutate: (sp: URLSearchParams) => void): string {
    const sp = new URLSearchParams();
    sp.set("productId", selectedId);
    sp.set("horizon", String(horizon));
    mutate(sp);
    return `/forecast?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Demand Forecast"
        description={`Deterministic statistical engine · ${HISTORY_WINDOW_DAYS}-day demand window`}
        actions={
          <>
            <div className="flex items-center rounded-lg border p-1">
              {HORIZONS.map((h) => (
                <Link
                  key={h}
                  href={linkWith((sp) => sp.set("horizon", String(h)))}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    horizon === h ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {h}-day
                </Link>
              ))}
            </div>
            {shouldPersist && (
              <Button asChild variant="outline">
                <Link href={`/forecast?productId=${selectedId}&horizon=${horizon}&t=${Date.now()}`}>
                  <RefreshCcw /> Recompute
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Product selector pills (top movers) */}
      <div className="flex flex-wrap gap-1.5">
        {candidates.slice(0, 12).map((c) => (
          <Link
            key={c.id}
            href={`/forecast?productId=${c.id}&horizon=${horizon}`}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              c.id === selectedId ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
            }`}
          >
            {c.name.length > 22 ? `${c.name.slice(0, 21)}…` : c.name}
          </Link>
        ))}
      </div>

      {/* Headline metrics - mirrors the spec's example block */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current stock</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{formatNumber(forecast.availableStock)}</p>
            <p className="text-xs text-muted-foreground">{forecast.sku}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{horizon}-day forecast</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
              <TrendingUp className="h-5 w-5 text-primary" />
              {formatNumber(Math.round(forecast.predictedDemandTotal))}
            </p>
            <p className="text-xs text-muted-foreground">{forecast.dailyAvgDemand}/day avg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stockout risk</p>
            <p className="mt-1.5 text-2xl font-bold">
              <RiskBadge risk={forecast.stockoutRisk} />
            </p>
            <p className="text-xs text-muted-foreground">
              {forecast.breakdown.daysOfCover >= 0 ? `${forecast.breakdown.daysOfCover} days of cover` : "No demand yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended reorder</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {formatNumber(forecast.recommendedReorderQty)}
            </p>
            <p className="text-xs text-muted-foreground">ROP {formatNumber(forecast.breakdown.reorderPoint)} units</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
              <Gauge className="h-5 w-5 text-primary" />
              {forecast.confidence}%
            </p>
            <p className="truncate text-xs text-muted-foreground" title={forecast.method}>
              model: {forecast.method}
            </p>
          </CardContent>
        </Card>
      </div>

      {forecast.stockoutRisk === "CRITICAL" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Critical: available stock cannot cover the next {Math.min(7, horizon)} days of projected demand.
          Reorder immediately ({formatNumber(forecast.recommendedReorderQty)} units recommended).
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Demand history vs prediction</CardTitle>
          <CardDescription>
            Solid: actual outbound units/day · Dashed: Holt smoothing projection with weekly seasonality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForecastChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Model breakdown</CardTitle>
            <CardDescription>How the recommendation was computed</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                ["Avg daily demand (28d)", `${forecast.breakdown.avgDailyDemand} u`],
                ["Trend", `${forecast.breakdown.trendPerDay >= 0 ? "+" : ""}${forecast.breakdown.trendPerDay} u/day`],
                ["Demand volatility σ", `${forecast.breakdown.sigmaDemand} u`],
                ["Lead time", `${forecast.breakdown.leadTimeDays} days`],
                ["Safety stock (z=1.65)", `${forecast.breakdown.safetyStock} u`],
                ["Reorder point", `${forecast.breakdown.reorderPoint} u`],
                [`Predicted demand (${horizon}d)`, `${formatNumber(forecast.predictedDemandTotal)} u`],
                ["Available now", `${formatNumber(forecast.availableStock)} u`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-1.5 last:border-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <dt className="font-semibold">Suggested order</dt>
                <dd className="font-bold tabular-nums text-primary">
                  max(0, ROP + forecast − stock) → {formatNumber(forecast.recommendedReorderQty)} u
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products at risk (30-day)</CardTitle>
            <CardDescription>Highest stockout exposure across the catalog</CardDescription>
          </CardHeader>
          <CardContent>
            {topRisky.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No high-risk products. Everything is well stocked.
              </p>
            ) : (
              <ul className="divide-y">
                {topRisky.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/forecast?productId=${p.id}&horizon=30`}
                      className="flex items-center justify-between py-2.5 hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sku} · confidence {p.confidence}%
                        </p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">+{formatNumber(p.reorderQty)}</span>
                        <RiskBadge risk={p.risk as ProductForecast["stockoutRisk"]} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
