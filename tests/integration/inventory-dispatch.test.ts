import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * INTEGRATION TESTS — hit a REAL PostgreSQL database.
 *
 *   TEST_DATABASE_URL="postgresql://…/wms_test" npm run test:integration
 *
 * Skipped automatically when TEST_DATABASE_URL is not configured so CI and
 * offline unit runs stay green.
 */

const RUN = Boolean(process.env.TEST_DATABASE_URL);
const d = RUN ? describe : describe.skip;

let db: PrismaClient;
let warehouseAId: string;
let warehouseBId: string;
let productId: string;
let userId: string;
let secondProductId: string;

beforeAll(async () => {
  db = new PrismaClient({ log: ["error"] });

  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.forecast.deleteMany();
  await db.dispatchItem.deleteMany();
  await db.dispatch.deleteMany();
  await db.stockMovement.deleteMany();
  await db.inventory.deleteMany();
  await db.product.deleteMany();
  await db.warehouse.deleteMany();
  await db.user.deleteMany();

  const whA = await db.warehouse.create({
    data: { code: "TST-A", name: "Test Warehouse A", location: "Testville", capacity: 10000 },
  });
  const whB = await db.warehouse.create({
    data: { code: "TST-B", name: "Test Warehouse B", location: "Testville", capacity: 10000 },
  });
  warehouseAId = whA.id;
  warehouseBId = whB.id;

  const product = await db.product.create({
    data: {
      sku: "TEST-1",
      name: "Integration Widget",
      category: "Testing",
      price: 9.99,
      reorderLevel: 10,
      reorderQuantity: 50,
    },
  });
  productId = product.id;

  secondProductId = (
    await db.product.create({
      data: {
        sku: "TEST-2",
        name: "Integration Gadget",
        category: "Testing",
        price: 4.5,
        reorderLevel: 5,
        reorderQuantity: 20,
      },
    })
  ).id;

  const user = await db.user.create({
    data: {
      email: "itest@example.com",
      name: "Integration Tester",
      role: "ADMIN",
      passwordHash: "x",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  if (db) await db.$disconnect();
});

d("inventory service (real DB transactions)", () => {
  it("records a Stock IN and creates the inventory row", async () => {
    const { applyStockOperation } = await import("@/lib/inventory/service");
    const result = await applyStockOperation(
      { type: "IN", productId, warehouseId: warehouseAId, quantity: 100 },
      { userId },
    );
    expect(result.productInventory.quantity).toBe(100);

    const inv = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(inv.quantity).toBe(100);

    const ledger = await db.stockMovement.findFirstOrThrow({
      where: { productId, type: "IN" },
    });
    expect(ledger.quantityDelta).toBe(100);
  });

  it("prevents OUT beyond available stock (no negative inventory)", async () => {
    const { applyStockOperation } = await import("@/lib/inventory/service");

    await expect(
      applyStockOperation(
        { type: "OUT", productId, warehouseId: warehouseAId, quantity: 101 },
        { userId },
      ),
    ).rejects.toThrow(/insufficient stock/i);

    const inv = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(inv.quantity).toBe(100); // unchanged
    const outs = await db.stockMovement.count({ where: { productId, type: "OUT" } });
    expect(outs).toBe(0);
  });

  it("applies a valid Stock OUT atomically", async () => {
    const { applyStockOperation } = await import("@/lib/inventory/service");
    await applyStockOperation(
      { type: "OUT", productId, warehouseId: warehouseAId, quantity: 30, reason: "sale" },
      { userId },
    );
    const inv = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(inv.quantity).toBe(70);
  });

  it("TRANSFER moves stock across warehouses with one ledger record", async () => {
    const { applyStockOperation } = await import("@/lib/inventory/service");
    await applyStockOperation(
      {
        type: "TRANSFER",
        productId,
        warehouseId: warehouseAId,
        destinationWarehouseId: warehouseBId,
        quantity: 20,
      },
      { userId },
    );

    const a = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    const b = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseBId } },
    });
    expect(a.quantity).toBe(50);
    expect(b.quantity).toBe(20);

    const transfer = await db.stockMovement.findFirstOrThrow({ where: { type: "TRANSFER", productId } });
    expect(transfer.destinationWarehouseId).toBe(warehouseBId);
    expect(transfer.quantityDelta).toBe(-20);
  });

  it("ADJUSTMENT sets the counted quantity", async () => {
    const { applyStockOperation } = await import("@/lib/inventory/service");
    await applyStockOperation(
      { type: "ADJUSTMENT", productId, warehouseId: warehouseAId, quantity: 45, reason: "cycle count" },
      { userId },
    );
    const inv = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(inv.quantity).toBe(45);
  });
});

d("dispatch lifecycle (real DB reservations)", () => {
  it("rejects creation when requested qty exceeds availability (45 on hand)", async () => {
    const { createDispatch } = await import("@/lib/dispatch/service");
    await expect(
      createDispatch(
        {
          customerName: "Greedy Corp",
          warehouseId: warehouseAId,
          items: [{ productId, quantity: 46 }],
        },
        userId,
      ),
    ).rejects.toThrow(/insufficient stock/i);

    const count = await db.dispatch.count({ where: { customerName: "Greedy Corp" } });
    expect(count).toBe(0); // failed tx left no orphan rows
  });

  let dispatchId = "";

  it("creates a dispatch and reserves stock", async () => {
    const { createDispatch } = await import("@/lib/dispatch/service");
    const { applyStockOperation } = await import("@/lib/inventory/service");
    // Stock the second SKU so the dispatch can carry two lines.
    await applyStockOperation(
      { type: "IN", productId: secondProductId, warehouseId: warehouseAId, quantity: 10 },
      { userId },
    );

    const dispatch = await createDispatch(
      {
        customerName: "Acme Corp",
        warehouseId: warehouseAId,
        items: [
          { productId, quantity: 20 },
          { productId: secondProductId, quantity: 5 },
        ],
      },
      userId,
    );
    dispatchId = dispatch.id;
    expect(dispatch.number).toMatch(/^DSP-\d{8}-\d{4}$/);
    expect(dispatch.status).toBe("PENDING");

    const inv = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(inv.reservedQuantity).toBe(20);
    expect(inv.quantity - inv.reservedQuantity).toBe(25); // available shrank

    // Second dispatch for 26 units must fail (only 25 available)
    const { createDispatch: again } = await import("@/lib/dispatch/service");
    await expect(
      again(
        {
          customerName: "Overdraw Ltd",
          warehouseId: warehouseAId,
          items: [{ productId, quantity: 26 }],
        },
        userId,
      ),
    ).rejects.toThrow(/insufficient stock/i);

    const invAfterFail = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(invAfterFail.reservedQuantity).toBe(20); // failed tx left no residue
  });

  it("walks PENDING → PROCESSING → READY → DISPATCHED deducting stock once", async () => {
    const { updateDispatchStatus } = await import("@/lib/dispatch/service");
    const before = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(before.quantity).toBe(45);

    for (const target of ["PROCESSING", "READY"] as const) {
      await updateDispatchStatus(dispatchId, target, userId);
    }
    await updateDispatchStatus(dispatchId, "DISPATCHED", userId, "integration test completion");

    const after = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    expect(after.quantity).toBe(before.quantity - 20);
    expect(after.reservedQuantity).toBe(before.reservedQuantity - 20);

    const outMovements = await db.stockMovement.findMany({
      where: { reference: { startsWith: "DSP-" }, productId, type: "OUT" },
    });
    expect(outMovements.length).toBeGreaterThan(0);
    expect(outMovements.every((m) => m.quantityDelta === -20 || m.quantityDelta < 0)).toBe(true);

    const dispatch = await db.dispatch.findUniqueOrThrow({ where: { id: dispatchId } });
    expect(dispatch.status).toBe("DISPATCHED");
    expect(dispatch.dispatchedAt).not.toBeNull();

    // Terminal state is immutable
    await expect(updateDispatchStatus(dispatchId, "CANCELLED", userId)).rejects.toThrow();
  });

  it("releases reservations when cancelled before completion", async () => {
    const { createDispatch, updateDispatchStatus } = await import("@/lib/dispatch/service");
    const dispatch = await createDispatch(
      { customerName: "Cancel Me Inc", warehouseId: warehouseAId, items: [{ productId, quantity: 10 }] },
      userId,
    );
    const invBefore = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });

    await updateDispatchStatus(dispatch.id, "CANCELLED", userId);

    const invAfter = await db.inventory.findUniqueOrThrow({
      where: { productId_warehouseId: { productId, warehouseId: warehouseAId } },
    });
    // Reservation released, on-hand quantity untouched
    expect(invAfter.reservedQuantity).toBe(invBefore.reservedQuantity - 10);
    expect(invAfter.quantity).toBe(invBefore.quantity);
    const cancelled = await db.dispatch.findUniqueOrThrow({ where: { id: dispatch.id } });
    expect(cancelled.status).toBe("CANCELLED");
  });
});

d("forecasting service (real DB demand history)", () => {
  it("builds history from the movement ledger and persists forecasts", async () => {
    const { runProductForecast } = await import("@/lib/ai/service");
    const forecast = await runProductForecast(productId, 7, { persist: true });

    expect(forecast.predictions).toHaveLength(7);
    expect(forecast.confidence).toBeGreaterThanOrEqual(35);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(forecast.stockoutRisk);
    expect(forecast.availableStock).toBeGreaterThan(0);

    const stored = await db.forecast.findUnique({
      where: { productId_horizon: { productId, horizon: "D7" } },
    });
    expect(stored).not.toBeNull();
    expect(stored!.predictedDemand).toBeCloseTo(forecast.predictedDemandTotal, 1);
  });
});
