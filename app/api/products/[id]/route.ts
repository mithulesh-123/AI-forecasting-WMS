import { type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { updateProductSchema } from "@/lib/validations/catalog";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

const idSchema = z.string().cuid();

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("products:read");
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const product = await db.product.findUnique({
      where: { id },
      include: { inventories: true },
    });
    if (!product) throw new NotFoundError("Product");
    return ok(product);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("products:write");
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const parsed = updateProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Invalid product payload", 422, "VALIDATION_ERROR", parsed.error.flatten());

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Product");
    if (parsed.data.sku && parsed.data.sku !== existing.sku) {
      const clash = await db.product.findUnique({ where: { sku: parsed.data.sku } });
      if (clash) throw new ConflictError(`SKU ${parsed.data.sku} already exists`);
    }

    const product = await db.product.update({ where: { id }, data: parsed.data });
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: "PRODUCT_UPDATED",
      entity: "Product",
      entityId: id,
      metadata: { changes: parsed.data },
    });
    return ok(product);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("products:write");
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const product = await db.product.findUnique({
      where: { id },
      include: { inventories: true, stockMovements: { take: 1 }, dispatchItems: { take: 1 } },
    });
    if (!product) throw new NotFoundError("Product");

    const hasStock = product.inventories.some((i) => i.quantity !== 0);
    if (hasStock) return fail("Cannot delete a product holding stock", 422, "STOCK_PRESENT");

    const hasHistory = product.stockMovements.length > 0 || product.dispatchItems.length > 0;
    if (hasHistory) {
      await db.product.update({ where: { id }, data: { isActive: false } });
      await writeAudit({
        userId: user.id,
        userEmail: user.email,
        action: "PRODUCT_ARCHIVED",
        entity: "Product",
        entityId: id,
        metadata: { sku: product.sku },
      });
      return ok({ archived: true });
    }

    await db.product.delete({ where: { id } });
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: "PRODUCT_DELETED",
      entity: "Product",
      entityId: id,
      metadata: { sku: product.sku },
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
