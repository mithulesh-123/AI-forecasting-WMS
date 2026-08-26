"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { createDispatch, updateDispatchStatus } from "@/lib/dispatch/service";
import { createDispatchSchema } from "@/lib/validations/dispatch";
import type { DispatchStatus } from "@prisma/client";
import { db } from "@/lib/db";

export async function createDispatchAction(formData: FormData) {
  const user = await requirePermission("dispatch:write");

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false as const, error: "Invalid items payload" };
  }

  const parsed = createDispatchSchema.safeParse({
    customerName: formData.get("customerName"),
    customerRef: formData.get("customerRef") ?? "",
    warehouseId: formData.get("warehouseId"),
    notes: formData.get("notes") ?? "",
    items: rawItems,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid dispatch" };
  }

  try {
    const dispatch = await createDispatch(parsed.data, user.id);
    revalidatePath("/dispatch");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true as const, id: dispatch.id, number: dispatch.number };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to create dispatch",
    };
  }
}

export async function updateDispatchStatusAction(dispatchId: string, target: DispatchStatus, note?: string) {
  const permission = target === "CANCELLED" ? "dispatch:write" : "dispatch:process";
  const user = await requirePermission(permission);

  try {
    const result = await updateDispatchStatus(dispatchId, target, user.id, note);
    revalidatePath("/dispatch");
    revalidatePath(`/dispatch/${dispatchId}`);
    revalidatePath("/inventory");
    revalidatePath("/stock-movements");
    revalidatePath("/dashboard");
    return { ok: true as const, status: result.status, number: result.number };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Status update failed",
    };
  }
}

export async function getDispatchAvailability(warehouseId: string): Promise<
  { ok: true; availability: Record<string, number> } | { ok: false; error: string }
> {
  await requirePermission("dispatch:read");
  if (!warehouseId) return { ok: true, availability: {} };
  try {
    const inventories = await db.inventory.findMany({
      where: { warehouseId },
      select: { productId: true, quantity: true, reservedQuantity: true },
    });
    const availability: Record<string, number> = {};
    for (const inv of inventories) {
      availability[inv.productId] = Math.max(0, inv.quantity - inv.reservedQuantity);
    }
    return { ok: true, availability };
  } catch {
    return { ok: false, error: "Failed to load availability" };
  }
}
