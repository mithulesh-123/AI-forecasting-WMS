import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AppError,
  InsufficientStockError,
  NotFoundError,
} from "@/lib/errors";
import { computeQuantityDelta, assertNonNegative } from "@/lib/inventory/math";
import type { StockOperationInput } from "@/lib/validations/inventory";

export interface AppliedMovement {
  movementIds: string[];
  productInventory: { quantity: number; reservedQuantity: number };
}

interface ApplyOptions {
  userId: string;
  skipNotification?: boolean;
}

/** Retry wrapper for Prisma transaction conflicts under concurrency. */
export async function withTransactionRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      // P2034 = transaction conflict, safe to retry
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        await new Promise((r) => setTimeout(r, 50 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Applies a stock operation atomically:
 *  - validates availability (never allows negative inventory)
 *  - mutates the Inventory row
 *  - appends an immutable StockMovement record
 *
 * TRANSFER moves stock between two warehouses within one transaction.
 */
export async function applyStockOperation(
  input: StockOperationInput,
  options: ApplyOptions,
): Promise<AppliedMovement> {
  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.isActive) throw new NotFoundError("Product");

  const sourceWarehouse = await db.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!sourceWarehouse || !sourceWarehouse.isActive) throw new NotFoundError("Warehouse");

  let destinationWarehouseId: string | null = null;
  if (input.type === "TRANSFER") {
    if (!input.destinationWarehouseId) {
      throw new AppError("Destination warehouse is required for transfers");
    }
    if (input.destinationWarehouseId === input.warehouseId) {
      throw new AppError("Destination warehouse must differ from source");
    }
    const dest = await db.warehouse.findUnique({ where: { id: input.destinationWarehouseId } });
    if (!dest || !dest.isActive) throw new NotFoundError("Destination warehouse");
    destinationWarehouseId = dest.id;
  }

  return withTransactionRetry(async (tx) => {
    const inv = await tx.inventory.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: sourceWarehouse.id } },
    });

    const currentQuantity = inv?.quantity ?? 0;

    if (input.type === "OUT") {
      const available = (inv?.quantity ?? 0) - (inv?.reservedQuantity ?? 0);
      if (input.quantity > available) {
        throw new InsufficientStockError({
          productId: product.id,
          sku: product.sku,
          requested: input.quantity,
          available,
        });
      }
    }

    const delta = computeQuantityDelta(input.type, input.quantity, currentQuantity);
    assertNonNegative(currentQuantity + delta, product.sku);

    const sourceInventory = await tx.inventory.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: sourceWarehouse.id } },
      create: {
        productId: product.id,
        warehouseId: sourceWarehouse.id,
        quantity: Math.max(0, currentQuantity + delta),
        reservedQuantity: 0,
      },
      update: { quantity: { increment: delta } },
    });

    if (destinationWarehouseId) {
      const destInv = await tx.inventory.findUnique({
        where: { productId_warehouseId: { productId: product.id, warehouseId: destinationWarehouseId } },
      });
      assertNonNegative((destInv?.quantity ?? 0) + input.quantity, product.sku);
      await tx.inventory.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: destinationWarehouseId } },
        create: {
          productId: product.id,
          warehouseId: destinationWarehouseId,
          quantity: input.quantity,
          reservedQuantity: 0,
        },
        update: { quantity: { increment: input.quantity } },
      });
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        warehouseId: sourceWarehouse.id,
        destinationWarehouseId,
        type: input.type,
        quantityDelta: delta,
        quantity: input.quantity,
        reason: input.reason || null,
        reference: input.reference || null,
        userId: options.userId,
      },
    });

    return {
      movementIds: [movement.id],
      productInventory: {
        quantity: sourceInventory.quantity,
        reservedQuantity: sourceInventory.reservedQuantity,
      },
    };
  });
}
