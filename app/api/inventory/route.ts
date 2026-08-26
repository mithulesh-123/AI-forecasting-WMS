import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { inventoryQuerySchema, stockOperationSchema } from "@/lib/validations/inventory";
import { applyStockOperation } from "@/lib/inventory/service";
import { writeAudit } from "@/lib/audit";
import { created, fail, handleApiError, ok } from "@/lib/api/response";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/** GET /api/inventory - paginated stock levels */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("inventory:read");
    const query = inventoryQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where: Prisma.InventoryWhereInput = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.q) {
      where.product = {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { sku: { contains: query.q, mode: "insensitive" } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      db.inventory.findMany({
        where,
        include: {
          product: { select: { sku: true, name: true, unit: true, reorderLevel: true } },
          warehouse: { select: { code: true, name: true } },
        },
        orderBy: [{ product: { name: "asc" } }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      db.inventory.count({ where }),
    ]);

    let filtered = items;
    if (query.filter === "low") filtered = items.filter((i) => i.quantity <= i.product.reorderLevel);
    if (query.filter === "out") filtered = items.filter((i) => i.quantity <= 0);

    return ok({
      items: filtered.map((i) => ({
        ...i,
        availableQuantity: Math.max(0, i.quantity - i.reservedQuantity),
      })),
      total,
      page: query.page,
      perPage: query.perPage,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/inventory - apply a stock operation (IN/OUT/TRANSFER/ADJUSTMENT/RETURN)
 * Also serves as the documented /api/stock-movement mutation endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("inventory:write");
    const parsed = stockOperationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail("Invalid operation payload", 422, "VALIDATION_ERROR", parsed.error.flatten());
    }

    const result = await applyStockOperation(parsed.data, { userId: user.id });
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: `STOCK_${parsed.data.type}`,
      entity: "Inventory",
      entityId: parsed.data.productId,
      metadata: { type: parsed.data.type, quantity: parsed.data.quantity },
    });

    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT /api/inventory?mode=movements - movement ledger query helper */
export async function PUT(request: NextRequest) {
  // Kept minimal: ledger reads live under /api/stock-movement
  void request;
  return fail("Use /api/stock-movement for the ledger", 405, "METHOD_NOT_ALLOWED");
}
