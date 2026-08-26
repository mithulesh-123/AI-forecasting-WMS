"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { applyStockOperation } from "@/lib/inventory/service";
import { stockOperationSchema } from "@/lib/validations/inventory";
import { writeAudit } from "@/lib/audit";
import { notifyLowStock } from "@/lib/notifications";
import { db } from "@/lib/db";

export async function applyStockOperationAction(formData: FormData) {
  const user = await requirePermission("inventory:write");

  const parsed = stockOperationSchema.safeParse({
    type: formData.get("type"),
    productId: formData.get("productId"),
    warehouseId: formData.get("warehouseId"),
    destinationWarehouseId: formData.get("destinationWarehouseId") ?? "",
    quantity: formData.get("quantity"),
    reason: formData.get("reason") ?? "",
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  try {
    const result = await applyStockOperation(parsed.data, { userId: user.id });

    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: `STOCK_${parsed.data.type}`,
      entity: "Inventory",
      entityId: parsed.data.productId,
      metadata: {
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        warehouseId: parsed.data.warehouseId,
        destinationWarehouseId: parsed.data.destinationWarehouseId || null,
        reference: parsed.data.reference || null,
      },
    });

    // Low-stock notification after commit
    const product = await db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { name: true, sku: true, reorderLevel: true },
    });
    const warehouse = await db.warehouse.findUnique({
      where: { id: parsed.data.warehouseId },
      select: { name: true },
    });
    if (product && result.productInventory.quantity <= product.reorderLevel) {
      await notifyLowStock({
        productId: parsed.data.productId,
        productName: product.name,
        sku: product.sku,
        warehouseName: warehouse?.name,
        quantity: result.productInventory.quantity,
        reorderLevel: product.reorderLevel,
        actorId: user.id,
      });
    }

    revalidatePath("/inventory");
    revalidatePath("/stock-movements");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Stock operation failed",
    };
  }
}
