import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { createWarehouseSchema, warehouseQuerySchema } from "@/lib/validations/catalog";
import { writeAudit } from "@/lib/audit";
import { ConflictError } from "@/lib/errors";
import { created, fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("warehouses:read");
    const query = warehouseQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const where = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { code: { contains: query.q, mode: "insensitive" as const } },
            { location: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      db.warehouse.findMany({
        where,
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      db.warehouse.count({ where }),
    ]);
    return ok({ items, total, page: query.page, perPage: query.perPage });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("warehouses:write");
    const parsed = createWarehouseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Invalid warehouse payload", 422, "VALIDATION_ERROR");

    const clash = await db.warehouse.findUnique({ where: { code: parsed.data.code } });
    if (clash) throw new ConflictError(`Warehouse code ${parsed.data.code} already exists`);

    const warehouse = await db.warehouse.create({ data: parsed.data });
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: "WAREHOUSE_CREATED",
      entity: "Warehouse",
      entityId: warehouse.id,
      metadata: { code: warehouse.code },
    });
    return created(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}
