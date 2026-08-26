import type { DispatchStatus } from "@prisma/client";

/**
 * Dispatch lifecycle state machine.
 * PENDING → PROCESSING → READY → DISPATCHED, CANCELLED allowed until dispatched.
 */
const TRANSITIONS: Record<DispatchStatus, readonly DispatchStatus[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: [],
  CANCELLED: [],
};

export function canTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DispatchStatus, to: DispatchStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid dispatch transition: ${from} → ${to}`);
  }
}

/** Pure status resolver - throws typed strings consumed by the service layer. */
export function nextStatusError(from: DispatchStatus, to: DispatchStatus): string | null {
  if (from === to) return `Dispatch is already ${from.toLowerCase()}`;
  if (!canTransition(from, to)) {
    return `Cannot move dispatch from ${from} to ${to}`;
  }
  return null;
}

/** Reservations are held while the dispatch is en-route to completion. */
export function holdsReservation(status: DispatchStatus): boolean {
  return status === "PENDING" || status === "PROCESSING" || status === "READY";
}

export const STATUS_ORDER: Record<DispatchStatus, number> = {
  PENDING: 0,
  PROCESSING: 1,
  READY: 2,
  DISPATCHED: 3,
  CANCELLED: 3,
};
