import { type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { updateWarehouseSchema } from "@/lib/validations/catalog";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

const idSchema = z.string().cuid();

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("warehouses:read");
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const warehouse = await db.warehouse.findUnique({
      where: { id },
      include: { inventories: true },
    });
    if (!warehouse) throw new NotFoundError("Warehouse");
    return ok(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("warehouses:write");
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const parsed = updateWarehouseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Invalid payload", 422, "VALIDATION_ERROR");

    const existing = await db.warehouse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Warehouse");
    if (parsed.data.code && parsed.data.code !== existing.code) {
      const clash = await db.warehouse.findUnique({ where: { code: parsed.data.code } });
      if (clash) throw new ConflictError(`Warehouse code ${parsed.data.code} already exists`);
    }

    const warehouse = await db.warehouse.update({ where: { id }, data: parsed.data });
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: "WAREHOUSE_UPDATED",
      entity: "Warehouse",
      entityId: id,
      metadata: { changes: parsed.data },
    });
    return ok(warehouse);
  } catch (error) {
    return handleApiError(error);
  }
}
