"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { createWarehouseSchema, updateWarehouseSchema } from "@/lib/validations/catalog";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";

export async function createWarehouseAction(formData: FormData) {
  const user = await requirePermission("warehouses:write");
  const parsed = createWarehouseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    location: formData.get("location"),
    capacity: formData.get("capacity"),
    managerName: formData.get("managerName") ?? undefined,
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

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

  revalidatePath("/warehouses");
  return { ok: true as const };
}

export async function updateWarehouseAction(id: string, formData: FormData) {
  const user = await requirePermission("warehouses:write");
  const parsed = updateWarehouseSchema.safeParse({
    name: formData.get("name") ?? undefined,
    code: formData.get("code") ?? undefined,
    location: formData.get("location") ?? undefined,
    capacity: formData.get("capacity") ?? undefined,
    managerName: formData.get("managerName") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false as const, error: "Nothing to update" };
  }

  const existing = await db.warehouse.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Warehouse");

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const clash = await db.warehouse.findUnique({ where: { code: parsed.data.code } });
    if (clash) throw new ConflictError(`Warehouse code ${parsed.data.code} already exists`);
  }

  await db.warehouse.update({ where: { id }, data: parsed.data });
  await writeAudit({
    userId: user.id,
    userEmail: user.email,
    action: "WAREHOUSE_UPDATED",
    entity: "Warehouse",
    entityId: id,
    metadata: { changes: parsed.data },
  });

  revalidatePath("/warehouses");
  return { ok: true as const };
}

export async function toggleWarehouseActiveAction(id: string, isActive: boolean) {
  const user = await requirePermission("warehouses:write");
  const warehouse = await db.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw new NotFoundError("Warehouse");

  await db.warehouse.update({ where: { id }, data: { isActive } });
  await writeAudit({
    userId: user.id,
    userEmail: user.email,
    action: isActive ? "WAREHOUSE_ACTIVATED" : "WAREHOUSE_DEACTIVATED",
    entity: "Warehouse",
    entityId: id,
    metadata: { code: warehouse.code },
  });

  revalidatePath("/warehouses");
  return { ok: true as const };
}
