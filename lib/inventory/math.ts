import type { MovementType } from "@prisma/client";
import { AppError } from "@/lib/errors";

/**
 * Pure business rules for stock quantities - no database access so they can
 * be unit-tested and reused across services.
 */

/** Signed effect on source warehouse quantity for a movement type. */
export function computeQuantityDelta(
  type: MovementType,
  quantity: number,
  currentQuantity: number,
): number {
  switch (type) {
    case "IN":
    case "RETURN":
      return quantity;
    case "OUT":
    case "TRANSFER":
      return -quantity;
    case "ADJUSTMENT":
      return quantity - currentQuantity;
    default:
      throw new AppError(`Unsupported movement type: ${type}`);
  }
}

export function assertNonNegative(newQuantity: number, context: string): void {
  if (!Number.isInteger(newQuantity)) {
    throw new AppError(`${context}: stock must be a whole number`, 422, "INVALID_QUANTITY");
  }
  if (newQuantity < 0) {
    throw new AppError(
      `${context}: operation would result in negative stock (${newQuantity})`,
      422,
      "NEGATIVE_STOCK",
    );
  }
}

export function availableQuantity(quantity: number, reservedQuantity: number): number {
  return Math.max(0, quantity - reservedQuantity);
}

/** Guard used before OUT / reservation: never allow overselling. */
export function assertSufficientStock(
  requested: number,
  quantity: number,
  reservedQuantity: number,
  context: string,
): void {
  const available = availableQuantity(quantity, reservedQuantity);
  if (requested > available) {
    throw new AppError(
      `${context}: insufficient stock (requested ${requested}, available ${available})`,
      422,
      "INSUFFICIENT_STOCK",
      { requested, available },
    );
  }
}
