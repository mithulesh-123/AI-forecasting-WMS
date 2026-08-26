import "server-only";
import { Prisma, type DispatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, InsufficientStockError, InvalidTransitionError, NotFoundError } from "@/lib/errors";
import { withTransactionRetry } from "@/lib/inventory/service";
import type { CreateDispatchInput } from "@/lib/validations/dispatch";
import { canTransition, holdsReservation } from "./state-machine";

function dispatchNumber(date = new Date(), seq: number): string {
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `DSP-${ymd}-${String(seq).padStart(4, "0")}`;
}

export async function generateDispatchNumber(tx: Prisma.TransactionClient): Promise<string> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const countToday = await tx.dispatch.count({
    where: { createdAt: { gte: startOfDay } },
  });
  // Sequence + random tail keeps the human-readable format collision-safe.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${dispatchNumber(new Date(), countToday + 1)}${attempt > 0 ? `-${attempt}` : ""}`;
    const exists = await tx.dispatch.findUnique({ where: { number: candidate } });
    if (!exists) return candidate;
  }
  throw new AppError("Unable to allocate a dispatch number");
}

export async function createDispatch(
  input: CreateDispatchInput,
  userId: string,
) {
  const warehouse = await db.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse || !warehouse.isActive) throw new NotFoundError("Warehouse");

  const productIds = input.items.map((i) => i.productId);
  const products = await db.product.findMany({ where: { id: { in: productIds }, isActive: true } });
  if (products.length !== new Set(productIds).size) {
    throw new NotFoundError("One or more products");
  }

  return withTransactionRetry(async (tx) => {
    const number = await generateDispatchNumber(tx);

    // Atomic reservation guard: available = quantity - reserved >= qty
    for (const item of input.items) {
      const inv = await tx.inventory.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: warehouse.id } },
      });
      const available = (inv?.quantity ?? 0) - (inv?.reservedQuantity ?? 0);
      if (item.quantity > available) {
        const product = products.find((p) => p.id === item.productId)!;
        throw new InsufficientStockError({
          productId: product.id,
          sku: product.sku,
          requested: item.quantity,
          available,
        });
      }
    }

    const dispatch = await tx.dispatch.create({
      data: {
        number,
        customerName: input.customerName,
        customerRef: input.customerRef || null,
        status: "PENDING",
        warehouseId: warehouse.id,
        notes: input.notes || null,
        createdBy: userId,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    // Reserve stock
    for (const item of input.items) {
      await tx.inventory.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: warehouse.id } },
        create: {
          productId: item.productId,
          warehouseId: warehouse.id,
          quantity: 0,
          reservedQuantity: 0,
        },
        update: { reservedQuantity: { increment: item.quantity } },
      });
    }

    return dispatch;
  });
}

export async function updateDispatchStatus(
  dispatchId: string,
  target: DispatchStatus,
  userId: string,
  note?: string,
) {
  const result = await withTransactionRetry(async (tx) => {
    const dispatch = await tx.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: { include: { product: true } } },
    });
    if (!dispatch) throw new NotFoundError("Dispatch");

    if (dispatch.status === target) {
      throw new InvalidTransitionError(dispatch.status, target);
    }
    if (!canTransition(dispatch.status, target)) {
      throw new InvalidTransitionError(dispatch.status, target);
    }

    const now = new Date();

    if (target === "CANCELLED") {
      if (holdsReservation(dispatch.status)) {
        for (const item of dispatch.items) {
          await tx.inventory.updateMany({
            where: { productId: item.productId, warehouseId: dispatch.warehouseId, reservedQuantity: { gte: item.quantity } },
            data: { reservedQuantity: { decrement: item.quantity } },
          });
        }
      }
      await tx.dispatch.update({
        where: { id: dispatch.id },
        data: { status: target, cancelledAt: now },
      });
      return { id: dispatch.id, number: dispatch.number, status: target };
    }

    if (target === "PROCESSING" || target === "READY") {
      await tx.dispatch.update({
        where: { id: dispatch.id },
        data: { status: target },
      });
      return { id: dispatch.id, number: dispatch.number, status: target };
    }

    // DISPATCHED - commit the stock deduction and write immutable movements
    if (target === "DISPATCHED") {
      if (!holdsReservation(dispatch.status)) {
        throw new InvalidTransitionError(dispatch.status, target);
      }
      for (const item of dispatch.items) {
        const inv = await tx.inventory.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: dispatch.warehouseId } },
        });
        if (!inv || inv.reservedQuantity < item.quantity || inv.quantity < item.quantity) {
          throw new AppError(
            `Inventory inconsistency while completing ${dispatch.number} (${item.product.sku})`,
            422,
            "INVENTORY_INCONSISTENT",
          );
        }
      }
      for (const item of dispatch.items) {
        await tx.inventory.updateMany({
          where: { productId: item.productId, warehouseId: dispatch.warehouseId },
          data: {
            quantity: { decrement: item.quantity },
            reservedQuantity: { decrement: item.quantity },
          },
        });
      }
      await tx.stockMovement.createMany({
        data: dispatch.items.map((item) => ({
          productId: item.productId,
          warehouseId: dispatch.warehouseId,
          type: "OUT" as const,
          quantityDelta: -item.quantity,
          quantity: item.quantity,
          reason: note || `Dispatch ${dispatch.number} completed for ${dispatch.customerName}`,
          reference: dispatch.number,
          userId,
        })),
      });
      await tx.dispatch.update({
        where: { id: dispatch.id },
        data: { status: "DISPATCHED", dispatchedAt: now },
      });
      return { id: dispatch.id, number: dispatch.number, status: target };
    }

    throw new AppError(`Unsupported transition to ${target}`);
  });

  // Audit outside of the transaction - best effort
  try {
    const { writeAudit } = await import("@/lib/audit");
    await writeAudit({
      userId,
      action: `DISPATCH_${target}`,
      entity: "Dispatch",
      entityId: result.id,
      metadata: { number: result.number },
    });
  } catch {
    /* audit must never break the flow */
  }

  return result;
}
