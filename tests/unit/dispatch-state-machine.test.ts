import { describe, expect, it } from "vitest";
import {
  canTransition,
  assertTransition,
  holdsReservation,
  nextStatusError,
} from "@/lib/dispatch/state-machine";
import type { DispatchStatus } from "@prisma/client";

const ALL: DispatchStatus[] = ["PENDING", "PROCESSING", "READY", "DISPATCHED", "CANCELLED"];

describe("dispatch state machine", () => {
  it("allows the happy path PENDING → PROCESSING → READY → DISPATCHED", () => {
    expect(canTransition("PENDING", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "READY")).toBe(true);
    expect(canTransition("READY", "DISPATCHED")).toBe(true);
  });

  it("allows cancellation until dispatched", () => {
    for (const from of ["PENDING", "PROCESSING", "READY"] as const) {
      expect(canTransition(from, "CANCELLED")).toBe(true);
    }
  });

  it("rejects skipping steps and terminal transitions", () => {
    const forbidden: Array<[DispatchStatus, DispatchStatus]> = [
      ["PENDING", "READY"],
      ["PENDING", "DISPATCHED"],
      ["PROCESSING", "DISPATCHED"],
      ["DISPATCHED", "CANCELLED"],
      ["CANCELLED", "PROCESSING"],
      ["CANCELLED", "DISPATCHED"],
      ["DISPATCHED", "PROCESSING"],
    ];
    for (const [from, to] of forbidden) {
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it("treats every self-transition as invalid", () => {
    for (const s of ALL) {
      expect(canTransition(s, s)).toBe(false);
    }
  });

  it("assertTransition throws on invalid paths", () => {
    expect(() => assertTransition("PENDING", "DISPATCHED")).toThrow();
    expect(() => assertTransition("CANCELLED", "READY")).toThrow(/Invalid dispatch transition/);
  });

  it("holds reservations only while en route to completion", () => {
    expect(holdsReservation("PENDING")).toBe(true);
    expect(holdsReservation("PROCESSING")).toBe(true);
    expect(holdsReservation("READY")).toBe(true);
    expect(holdsReservation("DISPATCHED")).toBe(false);
    expect(holdsReservation("CANCELLED")).toBe(false);
  });

  it("nextStatusError explains same-status and illegal jumps", () => {
    expect(nextStatusError("READY", "READY")).toMatch(/already ready/i);
    expect(nextStatusError("PENDING", "DISPATCHED")).toMatch(/Cannot move dispatch/i);
    expect(nextStatusError("PENDING", "PROCESSING")).toBeNull();
  });
});
