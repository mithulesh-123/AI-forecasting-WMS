import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  BrainCircuit,
  DollarSign,
  Package,
  PackageX,
  Truck,
} from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guards";
import { getDashboardData } from "@/lib/dashboard/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DispatchTrendChart,
  InOutChart,
  InventoryTrendChart,
  TopMovingChart,
  WarehousePie,
} from "@/components/charts/dashboard-charts";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { EmptyState } from "@/components/layout/empty-state";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-[var(--success)]/15 text-[var(--success)]",
    warning: "bg-[var(--warning)]/20 text-[color-mix(in_oklab,var(--warning),black_20%)] dark:text-[var(--warning)]",
    destructive: "bg-destructive/12 text-destructive",
    primary: "bg-primary/12 text-primary",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tabular-nums">{value}</p>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className={`ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard:read", "/dashboard");
  const data = await getDashboardData();
  const k = data.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Operational overview across all warehouses"
      />

      <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Products" value={formatNumber(k.totalProducts)} icon={Package} />
        <KpiCard
          label="Total Inventory"
          value={`${formatNumber(k.totalUnits)} u`}
          icon={Boxes}
          sub={<span><ArrowUpRight className="mb-0.5 inline h-3 w-3 text-[var(--success)]" /> on hand</span>}
        />
        <KpiCard label="Inventory Value" value={formatCurrency(k.totalValue)} icon={DollarSign} tone="primary" />
        <KpiCard
          label="Low Stock"
          value={formatNumber(k.lowStockCount)}
          icon={AlertTriangle}
          tone={k.lowStockCount > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Out of Stock"
          value={formatNumber(k.outOfStockCount)}
          icon={PackageX}
          tone={k.outOfStockCount > 0 ? "destructive" : "default"}
        />
        <KpiCard
          label="Pending Dispatches"
          value={formatNumber(k.pendingDispatches)}
          icon={Truck}
          tone="primary"
        />
        <KpiCard
          label="Today Stock In"
          value={`${formatNumber(k.todaysIn)} u`}
          icon={ArrowDownRight}
          tone="success"
        />
        <KpiCard
          label="Today Stock Out"
          value={`${formatNumber(k.todaysOut)} u`}
          icon={ArrowUpRight}
          tone="destructive"
        />
        <KpiCard
          label="Forecasted Demand (30d)"
          value={k.forecastCount > 0 ? `${formatNumber(k.forecastedDemand30d)} u` : "—"}
          icon={BrainCircuit}
          tone="primary"
          sub={
            k.forecastCount > 0 ? (
              <span>{k.highRiskForecasts} product{k.highRiskForecasts === 1 ? "" : "s"} at risk</span>
            ) : (
              <Link href="/forecast" className="text-primary hover:underline">Run forecasts →</Link>
            )
          }
        />
        <KpiCard
          label="High-Risk Forecasts"
          value={k.forecastCount > 0 ? formatNumber(k.highRiskForecasts) : "—"}
          icon={AlertTriangle}
          tone={k.highRiskForecasts > 0 ? "warning" : "default"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Inventory Value Trend</CardTitle>
            <CardDescription>Total stock valuation over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryTrendChart data={data.inventoryTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inventory by Warehouse</CardTitle>
            <CardDescription>Stock value distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {data.inventoryByWarehouse.length > 0 ? (
              <WarehousePie data={data.inventoryByWarehouse} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No inventory yet</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock In vs Stock Out</CardTitle>
            <CardDescription>Daily units received vs shipped (14 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <InOutChart data={data.inVsOut} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Moving Products</CardTitle>
            <CardDescription>Highest outbound volume (30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topMoving.length > 0 ? (
              <TopMovingChart data={data.topMoving} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">No outbound activity in the last 30 days</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dispatch Trend</CardTitle>
            <CardDescription>Created vs completed dispatches (14 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <DispatchTrendChart data={data.dispatchTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Low-Stock Products</CardTitle>
              <CardDescription>At or below reorder level</CardDescription>
            </div>
            <Badge variant={data.lowStockItems.length > 0 ? "warning" : "secondary"}>
              {data.lowStockItems.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {data.lowStockItems.length === 0 ? (
              <EmptyState icon={Package} title="All stocked up" description="No products are below their reorder level." />
            ) : (
              <ul className="divide-y">
                {data.lowStockItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <Badge variant={item.quantity <= 0 ? "destructive" : "warning"} className="tabular-nums">
                      {item.quantity} / {item.reorderLevel}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
