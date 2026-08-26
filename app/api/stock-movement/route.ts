import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { movementQuerySchema } from "@/lib/validations/inventory";
import { handleApiError, ok } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/** GET /api/stock-movement - immutable movement ledger */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("movements:read");
    const query = movementQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where: Prisma.StockMovementWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;
    const parseBound = (v?: string, eod = false) => {
      if (!v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : eod ? new Date(d.setHours(23, 59, 59, 999)) : new Date(d.setHours(0, 0, 0, 0));
    };
    const from = parseBound(query.from || undefined);
    const to = parseBound(query.to || undefined, true);
    if (from || to) where.createdAt = { gte: from, lte: to };
    if (query.q) {
      where.OR = [
        { reference: { contains: query.q, mode: "insensitive" } },
        { reason: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: {
          product: { select: { sku: true, name: true } },
          warehouse: { select: { code: true } },
          destinationWarehouse: { select: { code: true } },
          user: { select: { name: true } },
        },
      }),
      db.stockMovement.count({ where }),
    ]);

    return ok({ items, total, page: query.page, perPage: query.perPage });
  } catch (error) {
    return handleApiError(error);
  }
}
