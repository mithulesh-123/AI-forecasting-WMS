"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ForecastChartData {
  date: string;
  actual: number | null;
  predicted: number | null;
}

/**
 * Historical demand vs statistical prediction.
 * The `predicted` series is produced by the deterministic Holt smoothing
 * engine - it is a projection, not an LLM output.
 */
export function ForecastChart({ data }: { data: ForecastChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="actual"
          name="Historical demand"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="var(--chart-2)"
          fillOpacity={0.12}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="predicted"
          name="AI forecast"
          stroke="var(--chart-1)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
