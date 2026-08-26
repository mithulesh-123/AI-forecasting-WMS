import "server-only";
import type { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

interface LowStockParams {
  productId: string;
  productName: string;
  sku: string;
  warehouseName?: string;
  quantity: number;
  reorderLevel: number;
  actorId?: string;
}

/**
 * Creates a low-stock notification when inventory crosses the reorder level.
 * Deduplicates: only one unread notification per product within 24h.
 */
export async function notifyLowStock(params: LowStockParams): Promise<void> {
  try {
    const type: NotificationType = params.quantity <= 0 ? "CRITICAL" : "WARNING";
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db.notification.findFirst({
      where: {
        entityType: "Product",
        entityId: params.productId,
        readAt: null,
        createdAt: { gte: cutoff },
      },
    });
    if (existing) return;

    await db.notification.create({
      data: {
        title: params.quantity <= 0 ? `Out of stock: ${params.productName}` : `Low stock: ${params.productName}`,
        message:
          params.quantity <= 0
            ? `${params.sku} is out of stock${params.warehouseName ? ` at ${params.warehouseName}` : ""}.`
            : `${params.sku} dropped to ${params.quantity} units (reorder level ${params.reorderLevel})${params.warehouseName ? ` at ${params.warehouseName}` : ""}.`,
        type,
        entityType: "Product",
        entityId: params.productId,
      },
    });

    if (params.actorId) {
      await writeAudit({
        userId: params.actorId,
        action: "NOTIFICATION_LOW_STOCK",
        entity: "Product",
        entityId: params.productId,
        metadata: { quantity: params.quantity, reorderLevel: params.reorderLevel },
      });
    }
  } catch (error) {
    console.error("[notifications] failed:", error);
  }
}
