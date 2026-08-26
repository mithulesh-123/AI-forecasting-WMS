import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guards";
import { runProductForecast, runTopForecasts } from "@/lib/ai/service";
import { hasExternalProvider } from "@/lib/ai/provider";
import { fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

const horizonSchema = z.preprocess(
  (v) => (typeof v === "string" ? Number(v) : v),
  z.union([z.literal(7), z.literal(14), z.literal(30)]),
);

const forecastQuerySchema = z.object({
  productId: z.string().trim().min(1).optional(),
  horizon: horizonSchema.optional(),
  top: z.coerce.number().int().min(1).max(25).optional(),
});

/**
 * GET /api/forecasting?productId=&horizon=7|14|30   → single product forecast
 * GET /api/forecasting?top=10&horizon=30            → forecasts for top movers
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("forecast:read");
    const parsed = forecastQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return fail("Invalid query", 422, "VALIDATION_ERROR");

    const { productId, horizon = 30, top } = parsed.data;

    if (!productId && !top) {
      return ok({
        provider: hasExternalProvider() ? "external+local-fallback" : "local-statistical",
        horizons: [7, 14, 30],
        usage: "Pass ?productId=<id>&horizon=30 for one product or ?top=10 for the busiest movers.",
      });
    }

    if (productId) {
      const forecast = await runProductForecast(productId, horizon);
      return ok(forecast);
    }

    const results = await runTopForecasts(top ?? 10, horizon);
    return ok({ items: results, count: results.length });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/forecasting - compute AND persist a forecast */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("forecast:run");
    const body = await request.json().catch(() => null);
    const parsed = forecastQuerySchema.extend({ persist: z.boolean().optional() }).safeParse(body);
    if (!parsed.success || !parsed.data.productId || !parsed.data.horizon) {
      return fail("Body must include productId and horizon (7|14|30)", 422, "VALIDATION_ERROR");
    }

    const forecast = await runProductForecast(parsed.data.productId, parsed.data.horizon, {
      persist: parsed.data.persist ?? true,
    });

    void user; // actor recorded via audit in future iterations of this endpoint

    return ok(forecast);
  } catch (error) {
    return handleApiError(error);
  }
}
