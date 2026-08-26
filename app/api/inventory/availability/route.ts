import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("dispatch:read");
    const warehouseId = request.nextUrl.searchParams.get("warehouseId") ?? "";
    if (!warehouseId) return ok({ availability: {} });

    const inventories = await db.inventory.findMany({
      where: { warehouseId },
      select: { productId: true, quantity: true, reservedQuantity: true },
    });
    const availability: Record<string, number> = {};
    for (const inv of inventories) {
      availability[inv.productId] = Math.max(0, inv.quantity - inv.reservedQuantity);
    }
    return ok({ availability });
  } catch (error) {
    return handleApiError(error);
  }
}
