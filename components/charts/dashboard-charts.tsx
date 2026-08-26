"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";

const AXIS_STYLE = { fontSize: 11 } as const;

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--card-foreground)",
};

export function InventoryTrendChart({ data }: { data: { date: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={(v) => `$${formatNumber(v)}`} width={70} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatCurrency(Number(v)), "Stock value"]} />
        <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#invGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function InOutChart({ data }: { data: { date: string; inbound: number; outbound: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="inbound" name="Stock In" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="outbound" name="Stock Out" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopMovingChart({ data }: { data: { name: string; quantity: number }[] }) {
  const short = (s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data.map((d) => ({ ...d, shortName: short(d.name) }))} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${formatNumber(Number(v))} units`, "Shipped"]} />
        <Bar dataKey="quantity" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DispatchTrendChart({ data }: { data: { date: string; created: number; completed: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={AXIS_STYLE} tickLine={false} axisLine={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="created" name="Created" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="completed" name="Dispatched" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function WarehousePie({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={95}
            paddingAngle={3}
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, n) => [
              `${formatCurrency(Number(v))} (${total > 0 ? Math.round((Number(v) / total) * 100) : 0}%)`,
              String(n),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
        <p className="text-sm font-bold">{formatCurrency(total)}</p>
      </div>
    </div>
  );
}
