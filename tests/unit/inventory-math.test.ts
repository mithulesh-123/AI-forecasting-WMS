import { describe, expect, it } from "vitest";
import { computeQuantityDelta, assertNonNegative, assertSufficientStock, availableQuantity } from "@/lib/inventory/math";

describe("inventory math - movement deltas", () => {
  it("IN and RETURN add stock", () => {
    expect(computeQuantityDelta("IN", 25, 100)).toBe(25);
    expect(computeQuantityDelta("RETURN", 7, 100)).toBe(7);
  });

  it("OUT removes stock", () => {
    expect(computeQuantityDelta("OUT", 30, 100)).toBe(-30);
  });

  it("ADJUSTMENT sets absolute counted quantity via delta", () => {
    expect(computeQuantityDelta("ADJUSTMENT", 80, 100)).toBe(-20); // shrink
    expect(computeQuantityDelta("ADJUSTMENT", 120, 100)).toBe(20); // grow
    expect(computeQuantityDelta("ADJUSTMENT", 100, 100)).toBe(0);
  });
});

describe("inventory math - negative stock prevention", () => {
  it("accepts non-negative results", () => {
    expect(() => assertNonNegative(0, "SKU-1")).not.toThrow();
    expect(() => assertNonNegative(50, "SKU-1")).not.toThrow();
  });

  it("throws when a result would go negative", () => {
    expect(() => assertNonNegative(-1, "SKU-1")).toThrow(/negative stock/);
    expect(() => assertNonNegative(-99, "SKU-2")).toThrow(/negative stock/);
  });
});

describe("inventory math - availability & sufficiency guard", () => {
  it("available = quantity − reserved (floored at zero)", () => {
    expect(availableQuantity(100, 30)).toBe(70);
    expect(availableQuantity(10, 40)).toBe(0);
  });

  it("rejects OUT requests above available (reserved stock is protected)", () => {
    // 100 on hand, 60 reserved → 40 sellable
    expect(() => assertSufficientStock(41, 100, 60, "SKU-3")).toThrow(/insufficient stock/i);
    expect(() => assertSufficientStock(40, 100, 60, "SKU-3")).not.toThrow();
  });

  it("rejects requests with no inventory row at all", () => {
    expect(() => assertSufficientStock(1, 0, 0, "SKU-4")).toThrow(/insufficient stock/i);
  });
});
