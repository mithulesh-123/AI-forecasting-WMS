"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { createProductSchema, updateProductSchema } from "@/lib/validations/catalog";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";

export async function createProductAction(formData: FormData) {
  const user = await requirePermission("products:write");
  const parsed = createProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    category: formData.get("category"),
    unit: formData.get("unit") || undefined,
    price: formData.get("price"),
    reorderLevel: formData.get("reorderLevel"),
    reorderQuantity: formData.get("reorderQuantity"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const existing = await db.product.findUnique({ where: { sku: parsed.data.sku } });
  if (existing) return { ok: false as const, error: `SKU ${parsed.data.sku} already exists` };

  const product = await db.product.create({ data: parsed.data });
  await writeAudit({
    userId: user.id,
    userEmail: user.email,
    action: "PRODUCT_CREATED",
    entity: "Product",
    entityId: product.id,
    metadata: { sku: product.sku, name: product.name },
  });

  revalidatePath("/products");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function updateProductAction(id: string, formData: FormData) {
  const user = await requirePermission("products:write");
  const parsed = updateProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    category: formData.get("category"),
    unit: formData.get("unit") || undefined,
    price: formData.get("price"),
    reorderLevel: formData.get("reorderLevel"),
    reorderQuantity: formData.get("reorderQuantity"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Product");

  if (parsed.data.sku && parsed.data.sku !== existing.sku) {
    const clash = await db.product.findUnique({ where: { sku: parsed.data.sku } });
    if (clash) throw new ConflictError(`SKU ${parsed.data.sku} already exists`);
  }

  await db.product.update({ where: { id }, data: parsed.data });
  await writeAudit({
    userId: user.id,
    userEmail: user.email,
    action: "PRODUCT_UPDATED",
    entity: "Product",
    entityId: id,
    metadata: { changes: parsed.data },
  });

  revalidatePath("/products");
  return { ok: true as const };
}

export async function deleteProductAction(id: string) {
  const user = await requirePermission("products:write");

  const product = await db.product.findUnique({
    where: { id },
    include: { inventories: true, dispatchItems: { take: 1 }, stockMovements: { take: 1 } },
  });
  if (!product) throw new NotFoundError("Product");

  const hasHistory = product.stockMovements.length > 0 || product.dispatchItems.length > 0;
  const hasStock = product.inventories.some((i) => i.quantity !== 0);
  if (hasStock) {
    return {
      ok: false as const,
      error: "Cannot delete a product holding stock. Adjust quantities to zero first.",
    };
  }
  if (hasHistory) {
    // Preserve ledger integrity - soft delete instead of hard delete.
    await db.product.update({ where: { id }, data: { isActive: false } });
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: "PRODUCT_ARCHIVED",
      entity: "Product",
      entityId: id,
      metadata: { sku: product.sku, reason: "Has movement history" },
    });
    revalidatePath("/products");
    return { ok: true as const, archived: true };
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
  revalidatePath("/products");
  return { ok: true as const };
}
