"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

export interface ForecastChartData {
  date: string;
  actual: number | null;
  predicted: number | null;
  simulated?: number | null;
}

export interface SeasonalityChartData {
  day: string;
  factor: number;
  label: string;
  percentage: string;
}

/**
 * Historical demand vs statistical prediction & simulated surge scenario.
 */
export function ForecastChart({ data }: { data: ForecastChartData[] }) {
  const hasSimulation = data.some((d) => d.simulated !== undefined && d.simulated !== null);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2, #3b82f6)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--chart-2, #3b82f6)" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-4, #f59e0b)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--chart-4, #f59e0b)" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-15" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          formatter={(value: unknown, name: unknown) => [
            `${typeof value === "number" ? Math.round(value * 10) / 10 : String(value ?? "")} units`,
            String(name ?? ""),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area
          type="monotone"
          dataKey="actual"
          name="Historical demand"
          stroke="var(--chart-2, #3b82f6)"
          strokeWidth={2}
          fill="url(#actualGrad)"
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="predicted"
          name="AI baseline forecast"
          stroke="var(--chart-1, #10b981)"
          strokeWidth={2.5}
          strokeDasharray="5 4"
          dot={false}
          connectNulls={false}
        />
        {hasSimulation && (
          <Line
            type="monotone"
            dataKey="simulated"
            name="Simulated scenario (+surge)"
            stroke="var(--chart-4, #f59e0b)"
            strokeWidth={2.5}
            strokeDasharray="3 3"
            dot={{ r: 3, fill: "var(--chart-4, #f59e0b)" }}
            connectNulls={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Day-of-week seasonality multiplier visualizer.
 */
export function SeasonalityBarChart({ data }: { data: SeasonalityChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-15" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          domain={[0, 'dataMax + 0.3']}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: unknown, _: unknown, item: { payload?: { percentage?: string } }) => [
            `${item?.payload?.percentage ?? ""} (${typeof value === "number" ? value.toFixed(2) : String(value ?? "")}x base velocity)`,
            "Demand multiplier",
          ]}
        />
        <Bar dataKey="factor" name="Seasonal index" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.factor >= 1.25
                  ? "var(--chart-1, #10b981)"
                  : entry.factor <= 0.75
                  ? "var(--chart-4, #f59e0b)"
                  : "var(--chart-2, #3b82f6)"
              }
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface DepletionPoint {
  day: string;
  stock: number;
  reorderTrigger: number;
}

export interface DemandProjectionPoint {
  label: string;
  value: number;
}

/**
 * Stock Depletion curve with Reorder Trigger threshold line.
 */
export function StockDepletionChart({
  data,
  reorderTrigger,
}: {
  data: DepletionPoint[];
  reorderTrigger?: number;
}) {
  const maxStock = Math.max(...data.map((d) => Math.max(d.stock, d.reorderTrigger)), 10);
  const triggerVal = reorderTrigger ?? data[0]?.reorderTrigger ?? 10;

  return (
    <div className="flex flex-col h-full w-full">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 18, right: 24, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="depletionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "currentColor" }}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
            className="text-muted-foreground"
          />
          <YAxis
            domain={[0, Math.max(60, Math.ceil(maxStock * 1.15))]}
            tick={{ fontSize: 10, fill: "currentColor" }}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
            width={32}
            className="text-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: unknown, name: unknown) => [
              `${String(value ?? "")} units`,
              name === "stock" ? "Projected Stock" : "Reorder Trigger",
            ]}
          />
          {/* Reference Line for Reorder Trigger */}
          <ReferenceLine
            y={triggerVal}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: "-- Reorder Trigger --",
              position: "insideTop",
              fill: "#f59e0b",
              fontSize: 9,
            }}
          />
          {/* Projected Stock Area Curve */}
          <Area
            type="monotone"
            dataKey="stock"
            name="Projected Stock"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#depletionGrad)"
            dot={{ r: 2.5, fill: "#ef4444" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 pt-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          <span>Projected Stock</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-amber-500" />
          <span>Reorder Trigger</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Demand Target Projections Bar Chart (7-Day vs 30-Day Avg Projections)
 */
export function DemandTargetProjectionsChart({
  data,
}: {
  data: DemandProjectionPoint[];
}) {
  return (
    <div className="flex flex-col h-full w-full">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 18, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "currentColor" }}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
            className="text-muted-foreground"
          />
          <YAxis
            domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.25))]}
            tick={{ fontSize: 10, fill: "currentColor" }}
            tickLine={false}
            axisLine={{ stroke: "currentColor", opacity: 0.2 }}
            width={28}
            className="text-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: unknown) => [`${String(value ?? "")} units`, "Projected Demand"]}
          />
          <Bar dataKey="value" name="Projected Demand" radius={[4, 4, 0, 0]} maxBarSize={45}>
            {data.map((_, index) => (
              <Cell
                key={`proj-cell-${index}`}
                fill={index === 0 ? "var(--chart-2, #3b82f6)" : "var(--chart-1, #10b981)"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          <span>7-Day Period</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>30-Day Period</span>
        </div>
      </div>
    </div>
  );
}
