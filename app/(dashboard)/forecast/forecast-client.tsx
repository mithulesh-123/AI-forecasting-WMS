"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BrainCircuit,
  Info,
  Layers,
  RefreshCcw,
  Search,
  TrendingUp,
  Truck,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  StockDepletionChart,
  DemandTargetProjectionsChart,
  type DepletionPoint,
  type DemandProjectionPoint,
} from "@/components/charts/forecast-chart";
import { cn } from "@/lib/utils";

export interface WarehouseForecastItem {
  id: string; // unique key (e.g. productId-warehouseId)
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  currentStock: number;
  avgDailyDemand: number;
  forecast7d: number;
  forecast14d: number;
  forecast30d: number;
  daysUntilStockout: number | "Never";
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reorderQuantity: number;
  recommendedReorderQty: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reorderPoint: number;
  leadTimeDays: number;
  logMessage?: string;
}

export interface ForecastSummaryStats {
  totalForecasted: number;
  highRiskDepletions: number;
  predictedStockouts14d: number;
  reorderRecommendations: number;
}

export interface ForecastClientProps {
  items: WarehouseForecastItem[];
  stats: ForecastSummaryStats;
  initialSelectedId?: string;
}

export function ForecastClient({
  items,
  stats,
  initialSelectedId,
}: ForecastClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string>(
    initialSelectedId || items[0]?.id || ""
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [warehouseFilter, setWarehouseFilter] = React.useState<string>("ALL");
  const [riskFilter, setRiskFilter] = React.useState<string>("ALL");
  const [isRecalculating, setIsRecalculating] = React.useState(false);

  // Keep selectedId valid if items change
  React.useEffect(() => {
    if (!items.some((i) => i.id === selectedId) && items.length > 0) {
      setSelectedId(items[0]!.id);
    }
  }, [items, selectedId]);

  const selectedItem =
    items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  // Warehouses list for filtering
  const uniqueWarehouses = React.useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.warehouseCode)));
    return list.sort();
  }, [items]);

  // Filtered items
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (
        searchQuery &&
        !item.productName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.productSku.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.warehouseCode.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (warehouseFilter !== "ALL" && item.warehouseCode !== warehouseFilter) {
        return false;
      }
      if (riskFilter !== "ALL" && item.risk !== riskFilter) {
        return false;
      }
      return true;
    });
  }, [items, searchQuery, warehouseFilter, riskFilter]);

  // Depletion chart calculation for the selected item
  const depletionData: DepletionPoint[] = React.useMemo(() => {
    if (!selectedItem) return [];
    const stock = selectedItem.currentStock;
    const dailyDemand = selectedItem.avgDailyDemand;
    const reorderTrigger = selectedItem.reorderPoint || 10;
    const days = [0, 3, 6, 12, 18, 24, 30];

    return days.map((day) => {
      let projected = stock;
      if (stock <= 0) {
        projected = 0;
      } else if (dailyDemand > 0) {
        projected = Math.max(0, Math.round(stock - dailyDemand * day));
      } else {
        // When no recorded demand history exists, project baseline half-life depletion curve
        projected = Math.max(0, Math.round(stock * (1 - day / 60)));
      }
      return {
        day: `Day ${day}`,
        stock: projected,
        reorderTrigger,
      };
    });
  }, [selectedItem]);

  // Target demand projections comparison
  const targetProjectionData: DemandProjectionPoint[] = React.useMemo(() => {
    if (!selectedItem) return [];
    return [
      { label: "7-Day Avg Projection", value: Math.round(selectedItem.forecast7d) },
      { label: "30-Day Avg Projection", value: Math.round(selectedItem.forecast30d) },
    ];
  }, [selectedItem]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await fetch("/api/forecasting", {
        method: "GET",
      }).catch(() => {});
      router.refresh();
    } finally {
      setTimeout(() => {
        setIsRecalculating(false);
      }, 600);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header with Title & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm ring-4 ring-blue-500/10">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              AI Demand Forecasting
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-driven stockout prediction, safety limits optimization, and lead-time depletion charts.
            </p>
          </div>
        </div>
        <Button
          onClick={handleRecalculate}
          disabled={isRecalculating}
          variant="outline"
          className="h-9 gap-2 border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCcw
            className={cn("h-4 w-4", isRecalculating && "animate-spin text-blue-600")}
          />
          <span>Re-calculate Forecasts</span>
        </Button>
      </div>

      {/* 2. Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* TOTAL FORECASTED */}
        <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-slate-950">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                TOTAL FORECASTED
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats.totalForecasted}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* HIGH RISK DEPLETIONS */}
        <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-slate-950">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                HIGH RISK DEPLETIONS
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                {stats.highRiskDepletions}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* PREDICTED STOCKOUTS (14D) */}
        <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-slate-950">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                PREDICTED STOCKOUTS (14D)
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                {stats.predictedStockouts14d}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* REORDER RECOMMENDATIONS */}
        <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow dark:border-slate-800 dark:bg-slate-950">
          <CardContent className="flex items-center justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                REORDER RECOMMENDATIONS
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats.reorderRecommendations}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Truck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Middle Section: Explainable Insights & Stock Depletion Charts */}
      {selectedItem && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left: EXPLAINABLE INSIGHTS */}
          <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:col-span-5">
            <CardContent className="flex flex-col justify-between p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <Info className="h-4 w-4" /> EXPLAINABLE INSIGHTS
                </div>

                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {selectedItem.productName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Depot: {selectedItem.warehouseCode}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 text-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800/80">
                    <span className="text-muted-foreground">Current Stock:</span>
                    <span className="font-semibold text-foreground">
                      {selectedItem.currentStock} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800/80">
                    <span className="text-muted-foreground">Average Daily Demand:</span>
                    <span className="font-semibold text-foreground">
                      {selectedItem.avgDailyDemand} units / day
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800/80">
                    <span className="text-muted-foreground">7-Day Forecast:</span>
                    <span className="font-semibold text-foreground">
                      {Math.round(selectedItem.forecast7d)} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800/80">
                    <span className="text-muted-foreground">Estimated Days to Stockout:</span>
                    <span
                      className={cn(
                        "font-bold",
                        selectedItem.daysUntilStockout === "Never"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : selectedItem.daysUntilStockout === 0 ||
                            (typeof selectedItem.daysUntilStockout === "number" &&
                              selectedItem.daysUntilStockout <= 7)
                          ? "text-red-600 dark:text-red-400"
                          : typeof selectedItem.daysUntilStockout === "number" &&
                            selectedItem.daysUntilStockout <= 14
                          ? "text-orange-600 dark:text-orange-400"
                          : typeof selectedItem.daysUntilStockout === "number" &&
                            selectedItem.daysUntilStockout <= 30
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {selectedItem.daysUntilStockout} Days
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800/80">
                    <span className="text-muted-foreground">Recommended Reorder:</span>
                    <span className="font-semibold text-foreground">
                      {selectedItem.recommendedReorderQty} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">Forecast Confidence:</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                        selectedItem.confidence === "HIGH"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : selectedItem.confidence === "MEDIUM"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      )}
                    >
                      {selectedItem.confidence}
                    </span>
                  </div>
                </div>
              </div>

              {/* Subcard: Forecasting Log */}
              <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Info className="h-3.5 w-3.5" /> Forecasting Log
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {selectedItem.logMessage ||
                    (selectedItem.avgDailyDemand <= 0.05
                      ? "Insufficient sales or stock-out history exists to establish an explainable forecast. Displaying baseline parameters."
                      : `Historical demand velocity indicates an average consumption of ${selectedItem.avgDailyDemand} units/day with projected replenishment threshold in ${selectedItem.daysUntilStockout} days.`)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right: STOCK DEPLETION & DEMAND TARGET PROJECTIONS */}
          <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:col-span-7">
            <CardContent className="p-6">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                STOCK DEPLETION & DEMAND TARGET PROJECTIONS
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-8">
                  <StockDepletionChart
                    data={depletionData}
                    reorderTrigger={selectedItem.reorderPoint}
                  />
                </div>
                <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/80 md:pl-3 pt-3 md:pt-0">
                  <DemandTargetProjectionsChart data={targetProjectionData} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Bottom Data Table */}
      <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by product, SKU, or warehouse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Depot:</span>
            </div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Warehouses</option>
              {uniqueWarehouses.map((wh) => (
                <option key={wh} value={wh}>
                  {wh}
                </option>
              ))}
            </select>

            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:border-slate-800 dark:bg-slate-900/40">
                <th className="px-5 py-3.5">PRODUCT</th>
                <th className="px-5 py-3.5">WAREHOUSE</th>
                <th className="px-5 py-3.5 text-center">CURRENT STOCK</th>
                <th className="px-5 py-3.5 text-center">AVG DAILY DEMAND</th>
                <th className="px-5 py-3.5 text-center">7-DAY FORECAST</th>
                <th className="px-5 py-3.5 text-center">14-DAY FORECAST</th>
                <th className="px-5 py-3.5 text-center">30-DAY FORECAST</th>
                <th className="px-5 py-3.5 text-center">DAYS UNTIL STOCKOUT</th>
                <th className="px-5 py-3.5 text-center">RISK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    No matching inventory items found for current filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50",
                        isSelected &&
                          "bg-blue-50/60 font-medium dark:bg-blue-950/20"
                      )}
                    >
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {item.productName}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {item.warehouseCode}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-foreground">
                        {item.currentStock}
                      </td>
                      <td className="px-5 py-3.5 text-center text-muted-foreground">
                        {item.avgDailyDemand}
                      </td>
                      <td className="px-5 py-3.5 text-center text-muted-foreground">
                        {Math.round(item.forecast7d)}
                      </td>
                      <td className="px-5 py-3.5 text-center text-muted-foreground">
                        {Math.round(item.forecast14d)}
                      </td>
                      <td className="px-5 py-3.5 text-center text-muted-foreground">
                        {Math.round(item.forecast30d)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={cn(
                            "font-bold",
                            item.daysUntilStockout === "Never"
                              ? "text-foreground"
                              : item.daysUntilStockout === 0 ||
                                (typeof item.daysUntilStockout === "number" && item.daysUntilStockout <= 7)
                              ? "text-red-600 dark:text-red-400"
                              : typeof item.daysUntilStockout === "number" && item.daysUntilStockout <= 14
                              ? "text-orange-600 dark:text-orange-400"
                              : typeof item.daysUntilStockout === "number" && item.daysUntilStockout <= 30
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-foreground"
                          )}
                        >
                          {item.daysUntilStockout}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            item.risk === "LOW"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/40"
                              : item.risk === "MEDIUM"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/40"
                              : item.risk === "HIGH"
                              ? "bg-orange-50 text-orange-700 border border-orange-200/60 dark:bg-orange-950/60 dark:text-orange-400 dark:border-orange-900/40"
                              : "bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900/40"
                          )}
                        >
                          {item.risk}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
