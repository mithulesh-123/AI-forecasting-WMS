import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { reportTypeSchema, reportQuerySchema } from "@/lib/validations/misc";
import {
  buildDispatchReport,
  buildForecastReport,
  buildInventoryReport,
  buildMovementReport,
} from "@/lib/reports/queries";
import { csvResponse, toCsv } from "@/lib/reports/csv";
import { handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(request: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  try {
    await requirePermission("reports:read");
    const { type } = await ctx.params;
    const parsedType = reportTypeSchema.safeParse(type);
    if (!parsedType.success) {
      return new Response("Unknown report type. Use inventory | stock-movement | dispatch | forecast", {
        status: 400,
      });
    }
    const filters = reportQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const reportFilters = {
      from: filters.from,
      to: filters.to,
      warehouseId: filters.warehouseId || undefined,
      productId: filters.productId || undefined,
      category: filters.category || undefined,
    };

    switch (parsedType.data) {
      case "inventory":
        return exportCsv(await buildInventoryReport(reportFilters), "inventory-report");
      case "stock-movement":
        return exportCsv(await buildMovementReport(reportFilters), "stock-movement-report");
      case "dispatch":
        return exportCsv(await buildDispatchReport(reportFilters), "dispatch-report");
      case "forecast":
        return exportCsv(await buildForecastReport(reportFilters), "ai-forecast-report");
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function exportCsv(
  report: { title: string; columns: { key: string; label: string }[]; rows: Record<string, string | number>[] },
  filename: string,
): Response {
  const csv = toCsv(
    report.columns.map((c) => c.label),
    report.rows.map((row) => report.columns.map((c) => row[c.key])),
  );
  return csvResponse(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
