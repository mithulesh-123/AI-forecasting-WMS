import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/guards";
import { reportQuerySchema } from "@/lib/validations/misc";
import {
  buildDispatchReport,
  buildForecastReport,
  buildInventoryReport,
  buildMovementReport,
} from "@/lib/reports/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const REPORTS = [
  { key: "inventory", label: "Inventory" },
  { key: "stock-movement", label: "Stock Movement" },
  { key: "dispatch", label: "Dispatch" },
  { key: "forecast", label: "AI Forecast" },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission("reports:read", "/reports");
  const query = reportQuerySchema.parse(await searchParams);
  const filters = {
    from: query.from,
    to: query.to,
    warehouseId: query.warehouseId || undefined,
    productId: query.productId || undefined,
    category: query.category || undefined,
  };

  const [inventory, movements, dispatches, forecasts] = await Promise.all([
    buildInventoryReport(filters),
    buildMovementReport(filters),
    buildDispatchReport(filters),
    buildForecastReport(filters),
  ]);

  const datasets = [
    inventory,
    movements,
    dispatches,
    forecasts,
  ];

  const csvHref = (type: string) => {
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && sp.set(k, v));
    return `/api/reports/${type}?${sp.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Operational reporting with CSV export"
        actions={
          <div className="flex flex-wrap gap-2">
            {REPORTS.map((r) => (
              <Button key={r.key} asChild variant="outline" size="sm">
                <Link href={csvHref(r.key)} prefetch={false}>
                  <Download /> {r.label} CSV
                </Link>
              </Button>
            ))}
          </div>
        }
      />

      <form action="/reports" className="mb-5 grid gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
        <input type="date" name="from" defaultValue={query.from ?? ""} aria-label="From date" className="h-9 rounded-md border bg-card px-2 text-sm" />
        <input type="date" name="to" defaultValue={query.to ?? ""} aria-label="To date" className="h-9 rounded-md border bg-card px-2 text-sm" />
        <input
          name="category"
          defaultValue={query.category ?? ""}
          placeholder="Category filter"
          aria-label="Category"
          className="h-9 rounded-md border bg-card px-3 text-sm"
        />
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Apply filters
        </button>
        <span className="text-xs text-muted-foreground self-center">
          Date range applies to movement/dispatch reports; category to inventory & forecast.
        </span>
      </form>

      <div className="space-y-6">
        {datasets.map((dataset) => (
          <Card key={dataset.title}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h2 className="font-semibold">{dataset.title}</h2>
                <span className="text-xs text-muted-foreground">
                  {dataset.rows.length.toLocaleString()} rows
                </span>
              </div>
              {dataset.rows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">No data for the selected filters.</p>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        {dataset.columns.map((c) => (
                          <TableHead key={c.key}>{c.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dataset.rows.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          {dataset.columns.map((c) => (
                            <TableCell key={c.key} className="whitespace-nowrap text-xs tabular-nums">
                              {row[c.key]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {dataset.rows.length > 50 && (
                <p className="border-t px-5 py-2 text-xs text-muted-foreground">
                  Showing first 50 rows — export CSV for the full dataset.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
