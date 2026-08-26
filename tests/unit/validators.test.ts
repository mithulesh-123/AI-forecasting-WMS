import { describe, expect, it } from "vitest";
import { stockOperationSchema, inventoryQuerySchema } from "@/lib/validations/inventory";
import { createDispatchSchema } from "@/lib/validations/dispatch";
import { createProductSchema } from "@/lib/validations/catalog";
import { loginSchema } from "@/lib/validations/auth";

describe("stock operation validation", () => {
  it("accepts a valid IN operation", () => {
    const parsed = stockOperationSchema.safeParse({
      type: "IN",
      productId: "p1",
      warehouseId: "w1",
      quantity: 50,
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a destination warehouse for TRANSFER", () => {
    const missing = stockOperationSchema.safeParse({
      type: "TRANSFER",
      productId: "p1",
      warehouseId: "w1",
      quantity: 10,
    });
    expect(missing.success).toBe(false);

    const sameWarehouse = stockOperationSchema.safeParse({
      type: "TRANSFER",
      productId: "p1",
      warehouseId: "w1",
      destinationWarehouseId: "w1",
      quantity: 10,
    });
    expect(sameWarehouse.success).toBe(false);

    const valid = stockOperationSchema.safeParse({
      type: "TRANSFER",
      productId: "p1",
      warehouseId: "w1",
      destinationWarehouseId: "w2",
      quantity: 10,
    });
    expect(valid.success).toBe(true);
  });

  it("rejects zero, negative or fractional quantities", () => {
    for (const qty of [0, -5, 2.5]) {
      const parsed = stockOperationSchema.safeParse({
        type: "OUT",
        productId: "p1",
        warehouseId: "w1",
        quantity: qty,
      });
      expect(parsed.success).toBe(false);
    }
  });
});

describe("dispatch creation validation", () => {
  const base = {
    customerName: "Acme Corp",
    warehouseId: "w1",
    items: [{ productId: "p1", quantity: 3 }],
  };

  it("accepts a well-formed dispatch", () => {
    expect(createDispatchSchema.safeParse(base).success).toBe(true);
  });

  it("rejects empty item lists and duplicate product lines", () => {
    expect(
      createDispatchSchema.safeParse({ ...base, items: [] }).success,
    ).toBe(false);
    expect(
      createDispatchSchema.safeParse({
        ...base,
        items: [
          { productId: "p1", quantity: 3 },
          { productId: "p1", quantity: 4 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive quantities", () => {
    expect(
      createDispatchSchema.safeParse({ ...base, items: [{ productId: "p1", quantity: 0 }] })
        .success,
    ).toBe(false);
  });
});

describe("catalog + auth validation", () => {
  it("normalizes SKU case and rejects bad SKUs", () => {
    const ok = createProductSchema.safeParse({
      sku: "wm-1001",
      name: "Wireless Mouse",
      category: "Electronics",
      unit: "pcs",
      price: "24.99",
      reorderLevel: 10,
      reorderQuantity: 50,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.sku).toBe("WM-1001");

    const bad = createProductSchema.safeParse({
      sku: "bad sku!",
      name: "X",
      category: "Y",
      price: 1,
      reorderLevel: 0,
      reorderQuantity: 1,
    });
    expect(bad.success).toBe(false);
  });

  it("lowercases login emails", () => {
    const parsed = loginSchema.parse({ email: "Admin@NexusWMS.io", password: "x" });
    expect(parsed.email).toBe("admin@nexuswms.io");
  });

  it("bounds page sizes on list queries", () => {
    expect(inventoryQuerySchema.safeParse({ perPage: "500" }).success).toBe(false);
    expect(inventoryQuerySchema.safeParse({}).success).toBe(true);
  });
});
