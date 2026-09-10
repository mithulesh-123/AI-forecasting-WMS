import "dotenv/config";
import { PrismaClient, Prisma, type DispatchStatus, type MovementType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateForecast } from "../lib/ai/forecaster";

const db = new PrismaClient();

/** Deterministic PRNG (mulberry32) so seeds are reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260826);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

function isoDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

interface ProductSpec {
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  reorderLevel: number;
  reorderQuantity: number;
  baseRate: number; // avg units/day across network
  trend: number; // multiplicative growth over the window
}

const PRODUCTS: ProductSpec[] = [
  { sku: "ELC-1001", name: "Wireless Mouse", category: "Electronics", unit: "pcs", price: 24.99, reorderLevel: 40, reorderQuantity: 120, baseRate: 11, trend: 1.35 },
  { sku: "ELC-1002", name: "Mechanical Keyboard", category: "Electronics", unit: "pcs", price: 89.5, reorderLevel: 25, reorderQuantity: 80, baseRate: 7, trend: 1.4 },
  { sku: "ELC-1003", name: "USB-C Hub 7-in-1", category: "Electronics", unit: "pcs", price: 42.0, reorderLevel: 30, reorderQuantity: 100, baseRate: 9, trend: 1.2 },
  { sku: "ELC-1004", name: "27\" 4K Monitor", category: "Electronics", unit: "pcs", price: 329.99, reorderLevel: 10, reorderQuantity: 30, baseRate: 3, trend: 1.15 },
  { sku: "ELC-1005", name: "Noise-Cancelling Headset", category: "Electronics", unit: "pcs", price: 149.0, reorderLevel: 20, reorderQuantity: 60, baseRate: 5, trend: 1.3 },
  { sku: "ELC-1006", name: "Webcam 1080p", category: "Electronics", unit: "pcs", price: 59.99, reorderLevel: 20, reorderQuantity: 60, baseRate: 4, trend: 1.05 },
  { sku: "OFF-2001", name: "Ergonomic Office Chair", category: "Office Furniture", unit: "pcs", price: 259.0, reorderLevel: 12, reorderQuantity: 40, baseRate: 3.5, trend: 1.1 },
  { sku: "OFF-2002", name: "Standing Desk 140cm", category: "Office Furniture", unit: "pcs", price: 449.0, reorderLevel: 8, reorderQuantity: 25, baseRate: 2.2, trend: 1.25 },
  { sku: "OFF-2003", name: "Desk Organizer Set", category: "Office Supplies", unit: "set", price: 19.99, reorderLevel: 50, reorderQuantity: 150, baseRate: 8, trend: 0.95 },
  { sku: "OFF-2004", name: "A4 Copy Paper (2500 sh)", category: "Office Supplies", unit: "box", price: 28.5, reorderLevel: 60, reorderQuantity: 200, baseRate: 10, trend: 0.9 },
  { sku: "OFF-2005", name: "Laminating Pouches 100pk", category: "Office Supplies", unit: "pack", price: 12.75, reorderLevel: 40, reorderQuantity: 120, baseRate: 4.5, trend: 1.0 },
  { sku: "OFF-2006", name: "Whiteboard Marker Set", category: "Office Supplies", unit: "set", price: 9.99, reorderLevel: 50, reorderQuantity: 150, baseRate: 6, trend: 1.0 },
  { sku: "PKG-3001", name: "Cardboard Box M (50pk)", category: "Packaging", unit: "bundle", price: 34.0, reorderLevel: 45, reorderQuantity: 160, baseRate: 12, trend: 1.18 },
  { sku: "PKG-3002", name: "Cardboard Box L (30pk)", category: "Packaging", unit: "bundle", price: 48.0, reorderLevel: 40, reorderQuantity: 140, baseRate: 9.5, trend: 1.22 },
  { sku: "PKG-3003", name: "Bubble Wrap Roll 100m", category: "Packaging", unit: "roll", price: 39.9, reorderLevel: 30, reorderQuantity: 90, baseRate: 6.5, trend: 1.1 },
  { sku: "PKG-3004", name: "Packing Tape 6pk", category: "Packaging", unit: "pack", price: 14.5, reorderLevel: 60, reorderQuantity: 180, baseRate: 13, trend: 1.08 },
  { sku: "PKG-3005", name: "Stretch Film 500mm", category: "Packaging", unit: "roll", price: 27.0, reorderLevel: 35, reorderQuantity: 110, baseRate: 7, trend: 1.05 },
  { sku: "SAF-4001", name: "Safety Helmet ANSI", category: "Safety", unit: "pcs", price: 22.0, reorderLevel: 30, reorderQuantity: 100, baseRate: 4, trend: 1.0 },
  { sku: "SAF-4002", name: "Hi-Vis Vest Class 2", category: "Safety", unit: "pcs", price: 15.5, reorderLevel: 40, reorderQuantity: 130, baseRate: 5.5, trend: 1.06 },
  { sku: "SAF-4003", name: "Cut-Resistant Gloves L", category: "Safety", unit: "pair", price: 8.9, reorderLevel: 70, reorderQuantity: 220, baseRate: 9, trend: 1.02 },
  { sku: "SAF-4004", name: "Steel-Toe Boots 42", category: "Safety", unit: "pcs", price: 95.0, reorderLevel: 15, reorderQuantity: 45, baseRate: 2.4, trend: 0.98 },
  { sku: "SAF-4005", name: "First Aid Kit Station", category: "Safety", unit: "kit", price: 65.0, reorderLevel: 12, reorderQuantity: 40, baseRate: 1.8, trend: 1.04 },
  { sku: "TOL-5001", name: "Cordless Drill 18V", category: "Tools", unit: "pcs", price: 139.0, reorderLevel: 12, reorderQuantity: 40, baseRate: 3.2, trend: 1.12 },
  { sku: "TOL-5002", name: "Tool Set 108pc", category: "Tools", unit: "set", price: 79.9, reorderLevel: 18, reorderQuantity: 55, baseRate: 3.8, trend: 1.09 },
  { sku: "TOL-5003", name: "Laser Distance Meter", category: "Tools", unit: "pcs", price: 64.5, reorderLevel: 15, reorderQuantity: 50, baseRate: 2.6, trend: 1.2 },
  { sku: "TOL-5004", name: "LED Work Light 20W", category: "Tools", unit: "pcs", price: 44.9, reorderLevel: 20, reorderQuantity: 70, baseRate: 4.4, trend: 1.16 },
  { sku: "FOD-6001", name: "Coffee Beans 1kg", category: "Food & Beverage", unit: "bag", price: 18.9, reorderLevel: 55, reorderQuantity: 170, baseRate: 10.5, trend: 1.28 },
  { sku: "FOD-6002", name: "Green Tea 100 bags", category: "Food & Beverage", unit: "box", price: 11.5, reorderLevel: 45, reorderQuantity: 140, baseRate: 6.8, trend: 1.1 },
  { sku: "FOD-6003", name: "Sparkling Water 24pk", category: "Food & Beverage", unit: "case", price: 14.9, reorderLevel: 60, reorderQuantity: 190, baseRate: 12, trend: 1.05 },
  { sku: "FOD-6004", name: "Protein Bars 12pk", category: "Food & Beverage", unit: "box", price: 21.0, reorderLevel: 40, reorderQuantity: 130, baseRate: 7.5, trend: 1.33 },
  { sku: "APP-7001", name: "Warehouse Trolley 300kg", category: "Apparel & Gear", unit: "pcs", price: 189.0, reorderLevel: 8, reorderQuantity: 24, baseRate: 1.6, trend: 1.08 },
  { sku: "APP-7002", name: "Pallet Jack 2.5t", category: "Apparel & Gear", unit: "pcs", price: 389.0, reorderLevel: 5, reorderQuantity: 15, baseRate: 1.1, trend: 1.0 },
  { sku: "APP-7003", name: "Work Jacket XL", category: "Apparel & Gear", unit: "pcs", price: 59.0, reorderLevel: 25, reorderQuantity: 80, baseRate: 3.4, trend: 1.05 },
  { sku: "APP-7004", name: "Thermal Gloves Pair", category: "Apparel & Gear", unit: "pair", price: 17.9, reorderLevel: 45, reorderQuantity: 150, baseRate: 5.2, trend: 1.15 },
];

const WAREHOUSES = [
  { code: "WH-EAST", name: "Eastgate Distribution Center", location: "Chicago, IL", capacity: 42000, managerName: "Sarah Chen" },
  { code: "WH-WEST", name: "Pacific Fulfillment Hub", location: "Oakland, CA", capacity: 36000, managerName: "Miguel Torres" },
  { code: "WH-CENT", name: "Central Cross-Dock", location: "Dallas, TX", capacity: 28000, managerName: "Aisha Bello" },
];

const CUSTOMERS = [
  "Acme Corporation", "Globex Industries", "Initech Solutions", "Umbrella Logistics",
  "Stark Manufacturing", "Wayne Enterprises", "Cyberdyne Systems", "Tyrell Corp",
  "Soylent Retail Group", "Wonka Distribution", "Gekko Trading Co.", "Massive Dynamic",
];

const MOVEMENT_REASONS_IN = ["Purchase order received", "Supplier replenishment", "Bulk buy intake"];
const MOVEMENT_REASONS_OUT = ["Customer order picking", "Wholesale fulfillment", "Retail store supply"];

async function main() {
  console.log("🌱 Seeding NexusWMS demo data…");

  // ---------------------------------------------------------------- cleanup
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

  // ------------------------------------------------------------------ users
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const [admin, manager, staff, viewer] = await Promise.all(
    [
      { email: "admin@nexuswms.io", name: "Alex Rivera", role: "ADMIN" as const },
      { email: "manager@nexuswms.io", name: "Maria Kowalski", role: "MANAGER" as const },
      { email: "staff@nexuswms.io", name: "Sam Okafor", role: "WAREHOUSE_STAFF" as const },
      { email: "viewer@nexuswms.io", name: "Vera Lindqvist", role: "VIEWER" as const },
    ].map((u) => db.user.create({ data: { ...u, passwordHash, isActive: true, lastLoginAt: isoDaysAgo(0) } })),
  );
  console.log("  ✓ 4 users (Password123!)");

  // ------------------------------------------------------------- warehouses
  const warehouses = await Promise.all(
    WAREHOUSES.map((w) => db.warehouse.create({ data: { ...w, isActive: true } })),
  );
  console.log(`  ✓ ${warehouses.length} warehouses`);

  // --------------------------------------------------------------- products
  const products = await Promise.all(
    PRODUCTS.map((p) =>
      db.product.create({
        data: {
          sku: p.sku,
          name: p.name,
          description: `${p.name} — warehouse-grade SKU in ${p.category}.`,
          category: p.category,
          unit: p.unit,
          price: p.price,
          reorderLevel: p.reorderLevel,
          reorderQuantity: p.reorderQuantity,
          isActive: true,
        },
      }),
    ),
  );
  console.log(`  ✓ ${products.length} products`);

  /** Created rows joined with their spec metadata (rates, trend…). */
  const CATALOG = products.map((row) => {
    const spec = PRODUCTS.find((s) => s.sku === row.sku)!;
    return { ...spec, id: row.id };
  });

  // ------------------------------------------- 90-day operational history
  const WINDOW = 90;

  // running stock tracker per product×warehouse
  type Key = string; // `${productId}:${warehouseId}`
  const stock = new Map<Key, number>();
  const key = (pid: string, wid: string): Key => `${pid}:${wid}`;
  const getStock = (pid: string, wid: string) => stock.get(key(pid, wid)) ?? 0;

  interface MovementRow {
    productId: string;
    warehouseId: string;
    destinationWarehouseId?: string | null;
    type: MovementType;
    quantityDelta: number;
    quantity: number;
    reason?: string | null;
    reference?: string | null;
    userId: string;
    createdAt: Date;
  }
  const movements: MovementRow[] = [];

  // Phase A — opening purchase receipts (day 89)
  for (const product of CATALOG) {
    for (const wh of warehouses.slice(0, rand() < 0.85 ? 3 : 2)) {
      const share = product.baseRate / warehouses.length;
      const openingQty = Math.ceil(WINDOW * share * (1.7 + rand() * 0.7));
      movements.push({
        productId: product.id,
        warehouseId: wh.id,
        type: "IN",
        quantityDelta: openingQty,
        quantity: openingQty,
        reason: "Opening stock receipt",
        reference: `PO-2026-${randInt(1000, 9999)}`,
        userId: manager.id,
        createdAt: isoDaysAgo(89),
      });
      stock.set(key(product.id, wh.id), openingQty);
    }
  }

  // Phase B — historical DISPATCHED orders generating customer demand
  interface PlannedDispatch {
    dayOffset: number;
    warehouseIdx: number;
    customerName: string;
    items: { productId: string; quantity: number }[];
  }
  const plannedDispatches: PlannedDispatch[] = [];
  for (let i = 0; i < 32; i++) {
    const dayOffset = randInt(2, 88);
    const warehouseIdx = randInt(0, warehouses.length - 1);
    const itemCount = randInt(1, 3);
    const chosen = new Map<string, number>();
    for (let j = 0; j < itemCount; j++) {
      const product = pick(CATALOG);
      if (chosen.has(product.id)) continue;
      // 3–9 days worth of that product's share in this warehouse
      const share = Math.max(1, Math.round((product.baseRate / warehouses.length) * randInt(3, 9)));
      chosen.set(product.id, share);
    }
    plannedDispatches.push({
      dayOffset,
      warehouseIdx,
      customerName: pick(CUSTOMERS),
      items: [...chosen.entries()].map(([productId, quantity]) => ({ productId, quantity })),
    });
  }
  plannedDispatches.sort((a, b) => a.dayOffset - b.dayOffset);

  const dispatchedRows: {
    number: string;
    status: DispatchStatus;
    dayOffset: number;
    warehouseIdx: number;
    customerName: string;
    items: { productId: string; quantity: number }[];
  }[] = [];

  for (const [idx, plan] of plannedDispatches.entries()) {
    const wh = warehouses[plan.warehouseIdx]!;
    const number = `DSP-${isoDaysAgo(plan.dayOffset).toISOString().slice(0, 10).replace(/-/g, "")}-${String(idx + 1).padStart(4, "0")}`;
    const feasible: typeof plan.items = [];
    for (const item of plan.items) {
      if (getStock(item.productId, wh.id) >= item.quantity) {
        feasible.push(item);
        stock.set(key(item.productId, wh.id), getStock(item.productId, wh.id) - item.quantity);
        movements.push({
          productId: item.productId,
          warehouseId: wh.id,
          type: "OUT",
          quantityDelta: -item.quantity,
          quantity: item.quantity,
          reason: `Dispatch completed for ${plan.customerName}`,
          reference: number,
          userId: pick([staff.id, manager.id]),
          createdAt: isoDaysAgo(plan.dayOffset),
        });
      }
    }
    if (feasible.length === 0) continue;
    dispatchedRows.push({
      number,
      status: "DISPATCHED",
      dayOffset: plan.dayOffset,
      warehouseIdx: plan.warehouseIdx,
      customerName: plan.customerName,
      items: feasible,
    });
  }

  // Phase C — fill remaining demand with plain OUT movements (weekday-weighted)
  const outByDayProduct = new Map<string, number>(); // `${day}:${productId}`
  for (const m of movements) {
    if (m.type !== "OUT") continue;
    const day = Math.round((isoDaysAgo(0).getTime() - m.createdAt.getTime()) / 86_400_000);
    outByDayProduct.set(`${day}:${m.productId}`, (outByDayProduct.get(`${day}:${m.productId}`) ?? 0) + m.quantity);
  }

  for (const product of CATALOG) {
    for (let day = WINDOW - 1; day >= 0; day--) {
      const date = isoDaysAgo(day);
      const dow = date.getDay();
      const weekendFactor = dow === 0 ? 0.25 : dow === 6 ? 0.45 : 1;
      const progress = (WINDOW - day) / WINDOW;
      const targetRaw =
        (product.baseRate / warehouses.length) * weekendFactor * (1 + (product.trend - 1) * progress);
      const target = Math.max(0, Math.round(targetRaw));
      const wh = warehouses[product.baseRate % 1 > 0.5 ? randInt(0, 1) : (day + product.sku.length) % warehouses.length]!;
      const already = outByDayProduct.get(`${day}:${product.id}`) ?? 0;
      let gap = target - already;
      while (gap > 0 && getStock(product.id, wh.id) > product.reorderLevel + gap) {
        const chunk = Math.min(gap, randInt(1, 4));
        stock.set(key(product.id, wh.id), getStock(product.id, wh.id) - chunk);
        movements.push({
          productId: product.id,
          warehouseId: wh.id,
          type: "OUT",
          quantityDelta: -chunk,
          quantity: chunk,
          reason: pick(MOVEMENT_REASONS_OUT),
          reference: `SO-${randInt(10000, 99999)}`,
          userId: pick([staff.id, staff.id, manager.id]),
          createdAt: new Date(new Date(date).setHours(randInt(8, 18), randInt(0, 59))),
        });
        gap -= chunk;
      }
    }
  }

  // Phase D — texture: transfers, adjustments, returns, replenishments
  for (let i = 0; i < 14; i++) {
    const product = pick(CATALOG);
    const from = pick(warehouses);
    const to = pick(warehouses.filter((w) => w.id !== from.id));
    const movable = getStock(product.id, from.id) - product.reorderLevel;
    if (movable <= 5) continue;
    const qty = randInt(3, Math.min(30, movable));
    const when = isoDaysAgo(randInt(1, 85));
    stock.set(key(product.id, from.id), getStock(product.id, from.id) - qty);
    stock.set(key(product.id, to.id), getStock(product.id, to.id) + qty);
    movements.push({
      productId: product.id,
      warehouseId: from.id,
      destinationWarehouseId: to.id,
      type: "TRANSFER",
      quantityDelta: -qty,
      quantity: qty,
      reason: "Stock rebalancing between facilities",
      reference: `TRF-${randInt(1000, 9999)}`,
      userId: manager.id,
      createdAt: when,
    });
  }

  for (let i = 0; i < 8; i++) {
    const product = pick(CATALOG);
    const wh = pick(warehouses);
    const counted = Math.max(0, getStock(product.id, wh.id) + randInt(-6, 6));
    const delta = counted - getStock(product.id, wh.id);
    if (delta === 0) continue;
    stock.set(key(product.id, wh.id), counted);
    movements.push({
      productId: product.id,
      warehouseId: wh.id,
      type: "ADJUSTMENT",
      quantityDelta: delta,
      quantity: counted,
      reason: "Cycle count correction",
      reference: `CC-${randInt(100, 999)}`,
      userId: manager.id,
      createdAt: isoDaysAgo(randInt(1, 60)),
    });
  }

  for (let i = 0; i < 6; i++) {
    const product = pick(CATALOG);
    const wh = pick(warehouses);
    const qty = randInt(2, 12);
    stock.set(key(product.id, wh.id), getStock(product.id, wh.id) + qty);
    movements.push({
      productId: product.id,
      warehouseId: wh.id,
      type: "RETURN",
      quantityDelta: qty,
      quantity: qty,
      reason: "Customer return (RMA approved)",
      reference: `RMA-${randInt(1000, 9999)}`,
      userId: staff.id,
      createdAt: isoDaysAgo(randInt(1, 70)),
    });
  }

  // Replenish a few hot SKUs so they don't all sit below reorder level
  for (const product of CATALOG.slice(0, 10)) {
    const wh = warehouses[0]!;
    if (getStock(product.id, wh.id) < product.reorderLevel * 2) {
      const qty = product.reorderQuantity;
      stock.set(key(product.id, wh.id), getStock(product.id, wh.id) + qty);
      movements.push({
        productId: product.id,
        warehouseId: wh.id,
        type: "IN",
        quantityDelta: qty,
        quantity: qty,
        reason: pick(MOVEMENT_REASONS_IN),
        reference: `PO-REPLENISH-${randInt(100, 999)}`,
        userId: manager.id,
        createdAt: isoDaysAgo(randInt(2, 10)),
      });
    }
  }

  // Phase E — open dispatch pipeline (reservations live on inventory)
  const openReservations = new Map<Key, number>(); // productId:warehouseId -> reserved
  const openDispatchPlans = [
    { status: "PENDING" as const, age: 0 },
    { status: "PROCESSING" as const, age: 1 },
    { status: "READY" as const, age: 1 },
    { status: "CANCELLED" as const, age: 2 },
  ];
  for (const [i, plan] of openDispatchPlans.entries()) {
    const wh = warehouses[i % warehouses.length]!;
    const customer = CUSTOMERS[(i * 3) % CUSTOMERS.length]!;
    const items: { productId: string; quantity: number }[] = [];
    for (let j = 0; j < 2; j++) {
      const product = CATALOG[randInt(0, CATALOG.length - 1)]!;
      const available = getStock(product.id, wh.id) - (openReservations.get(key(product.id, wh.id)) ?? 0);
      const qty = Math.min(Math.max(1, Math.round(available / 6)), randInt(2, 15));
      if (qty <= 0 || available < qty) continue;
      items.push({ productId: product.id, quantity: qty });
      if (plan.status !== "CANCELLED") {
        openReservations.set(key(product.id, wh.id), (openReservations.get(key(product.id, wh.id)) ?? 0) + qty);
      }
    }
    if (items.length === 0) continue;
    dispatchedRows.push({
      number: `DSP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(9000 + i).slice(-4)}`,
      status: plan.status,
      dayOffset: plan.age,
      warehouseIdx: warehouses.indexOf(wh),
      customerName: customer,
      items,
    });
  }

  // Calibrate stock distribution across SKUs and depots to model realistic multi-tiered risk profiles
  for (const [pIndex, product] of CATALOG.entries()) {
    for (const [wIndex, wh] of warehouses.entries()) {
      const current = getStock(product.id, wh.id);
      if (current <= 0) continue;

      // Determine inventory profile bucket across 10 distribution buckets
      const bucket = (pIndex * 7 + wIndex * 13) % 10;
      let targetStock = current;

      if (bucket === 0) {
        // 0 stock -> CRITICAL
        targetStock = 0;
      } else if (bucket === 1 || bucket === 2) {
        // Very low stock (2 to 8 units) -> CRITICAL
        targetStock = Math.max(1, Math.floor(product.reorderLevel * 0.35));
      } else if (bucket === 3 || bucket === 4) {
        // Low stock (9 to 25 units) -> HIGH
        targetStock = Math.max(6, Math.floor(product.reorderLevel * 0.85));
      } else if (bucket === 5 || bucket === 6) {
        // Approaching buffer (30 to 70 units) -> MEDIUM
        targetStock = Math.max(16, Math.floor(product.reorderLevel * 1.45));
      } else {
        // Healthy stock (80 to 250 units) -> LOW
        targetStock = Math.max(45, Math.floor(product.reorderLevel * 3.2));
      }

      const delta = targetStock - current;
      if (delta === 0) continue;

      stock.set(key(product.id, wh.id), targetStock);
      movements.push({
        productId: product.id,
        warehouseId: wh.id,
        type: delta < 0 ? "OUT" : "IN",
        quantityDelta: delta,
        quantity: Math.abs(delta),
        reason: delta < 0 ? "Bulk store distribution" : "Supplier replenishment receipt",
        reference: delta < 0 ? `SO-BULK-${randInt(1000, 9999)}` : `PO-SUP-${randInt(1000, 9999)}`,
        userId: manager.id,
        createdAt: isoDaysAgo(randInt(1, 4)),
      });
    }
  }

  console.log(`  ✓ ${movements.length} stock movements generated`);

  // ------------------------------------------------------------ persist rows
  // StockMovements (chunked createMany)
  for (let i = 0; i < movements.length; i += 500) {
    await db.stockMovement.createMany({
      data: movements.slice(i, i + 500).map((m) => ({
        productId: m.productId,
        warehouseId: m.warehouseId,
        destinationWarehouseId: m.destinationWarehouseId ?? null,
        type: m.type,
        quantityDelta: m.quantityDelta,
        quantity: m.quantity,
        reason: m.reason ?? null,
        reference: m.reference ?? null,
        userId: m.userId,
        createdAt: m.createdAt,
      })),
    });
  }

  // Inventory = ledger-derived quantity + open reservations
  const inventoryRows = [];
  for (const product of CATALOG) {
    for (const wh of warehouses) {
      const k = key(product.id, wh.id);
      const quantity = stock.get(k) ?? 0;
      const reserved = openReservations.get(k) ?? 0;
      if (quantity === 0 && reserved === 0) continue;
      inventoryRows.push({
        productId: product.id,
        warehouseId: wh.id,
        quantity,
        reservedQuantity: reserved,
      });
    }
  }
  await db.inventory.createMany({ data: inventoryRows });

  // Dispatches + items
  for (const row of dispatchedRows) {
    const wh = warehouses[row.warehouseIdx]!;
    const requestedAt = isoDaysAgo(row.dayOffset);
    const isDispatched = row.status === "DISPATCHED";
    await db.dispatch.create({
      data: {
        number: row.number,
        customerName: row.customerName,
        customerRef: rand() < 0.6 ? `PO-${randInt(40000, 49999)}` : null,
        status: row.status,
        warehouseId: wh.id,
        notes: row.status === "CANCELLED" ? "Cancelled by customer request" : null,
        requestedAt,
        dispatchedAt: isDispatched ? new Date(requestedAt.getTime() + 36_000_000) : null,
        cancelledAt: row.status === "CANCELLED" ? new Date(requestedAt.getTime() + 7_200_000) : null,
        createdBy: pick([manager.id, staff.id]),
        items: {
          create: row.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        },
      },
    });
  }
  console.log(`  ✓ ${dispatchedRows.length} dispatches (${dispatchedRows.filter((d) => d.status === "DISPATCHED").length} completed)`);

  // Phase G — forecasts via the REAL engine (same math as production runtime)
  let forecastCount = 0;
  for (const product of CATALOG.slice(0, 14)) {
    const demandByDay = new Map<string, number>();
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 89);
    for (const m of movements) {
      if (m.type !== "OUT" || m.productId !== product.id) continue;
      const k = m.createdAt.toISOString().slice(0, 10);
      demandByDay.set(k, (demandByDay.get(k) ?? 0) + m.quantity);
    }
    const history: number[] = [];
    for (let i = 0; i < WINDOW; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      history.push(demandByDay.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    const currentStock = [...warehouses].reduce((acc, wh) => acc + (stock.get(key(product.id, wh.id)) ?? 0), 0);

    for (const horizon of [7, 14, 30] as const) {
      const result = generateForecast({
        history,
        startDate: since.toISOString().slice(0, 10),
        horizonDays: horizon,
        availableStock: currentStock,
        packSize: product.reorderQuantity,
      });
      await db.forecast.upsert({
        where: {
          productId_horizon: {
            productId: product.id,
            horizon: horizon === 7 ? "D7" : horizon === 14 ? "D14" : "D30",
          },
        },
        create: {
          productId: product.id,
          horizon: horizon === 7 ? "D7" : horizon === 14 ? "D14" : "D30",
          predictedDemand: result.predictedDemandTotal,
          dailyAvgDemand: result.dailyAvgDemand,
          confidence: result.confidence,
          stockoutRisk: result.stockoutRisk,
          recommendedReorderQty: result.recommendedReorderQty,
          method: result.method,
          history: history.slice(-45).map((demand, i) => ({
            date: new Date(since.getTime() + (WINDOW - 45 + i) * 86_400_000).toISOString().slice(0, 10),
            demand,
          })),
          predictions: result.predictions,
          generatedAt: new Date(),
        },
        update: {},
      });
      forecastCount += 1;
    }
  }
  console.log(`  ✓ ${forecastCount} forecasts persisted (statistical engine)`);

  // ------------------------------------------------------------- audit logs
  const audits: {
    userId: string;
    userEmail: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
    createdAt: Date;
  }[] = [];
  const pushAudit = (
    user: { id: string; email: string },
    action: string,
    entity: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
    createdAt?: Date,
  ) =>
    audits.push({
      userId: user.id,
      userEmail: user.email,
      action,
      entity,
      entityId,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      createdAt: createdAt ?? isoDaysAgo(randInt(0, 30)),
    });

  pushAudit(admin, "LOGIN", "User", admin.id, undefined, isoDaysAgo(30));
  pushAudit(manager, "LOGIN", "User", manager.id, undefined, isoDaysAgo(29));
  pushAudit(staff, "LOGIN", "User", staff.id, undefined, isoDaysAgo(28));
  pushAudit(viewer, "LOGIN_FAILED", "User", viewer.email ? undefined : undefined, { note: "wrong password" }, isoDaysAgo(28));
  for (const p of products.slice(0, 12)) {
    pushAudit(manager, rand() < 0.5 ? "PRODUCT_CREATED" : "PRODUCT_UPDATED", "Product", p.id, { sku: p.sku });
  }
  for (const w of warehouses) {
    pushAudit(admin, "WAREHOUSE_CREATED", "Warehouse", w.id, { code: w.code }, isoDaysAgo(88));
  }
  for (const m of movements.slice(0, 14)) {
    pushAudit(pick([staff, manager]), `STOCK_${m.type}`, "Inventory", m.productId, {
      type: m.type,
      quantity: m.quantity,
    });
  }
  for (const d of dispatchedRows.slice(0, 16)) {
    pushAudit(manager, `DISPATCH_${d.status}`, "Dispatch", undefined, { number: d.number });
  }
  pushAudit(admin, "USER_CREATED", "User", manager.id, { email: manager.email, role: manager.role }, isoDaysAgo(85));
  pushAudit(admin, "USER_UPDATED", "User", staff.id, { changes: { role: "WAREHOUSE_STAFF" } }, isoDaysAgo(40));
  await db.auditLog.createMany({ data: audits });
  console.log(`  ✓ ${audits.length} audit log entries`);

  // ---------------------------------------------------------- notifications
  const lowStockNow = inventoryRows.filter((r) => r.quantity <= (products.find((p) => p.id === r.productId)?.reorderLevel ?? 0));
  for (const row of lowStockNow.slice(0, 6)) {
    const product = products.find((p) => p.id === row.productId)!;
    await db.notification.create({
      data: {
        title: row.quantity <= 0 ? `Out of stock: ${product.name}` : `Low stock: ${product.name}`,
        message:
          row.quantity <= 0
            ? `${product.sku} is out of stock.`
            : `${product.sku} dropped to ${row.quantity} units (reorder level ${product.reorderLevel}).`,
        type: row.quantity <= 0 ? "CRITICAL" : "WARNING",
        entityType: "Product",
        entityId: product.id,
        createdAt: isoDaysAgo(randInt(0, 3)),
      },
    });
  }
  console.log(`  ✓ ${Math.min(6, lowStockNow.length)} low-stock notifications`);

  const counts = {
    users: await db.user.count(),
    warehouses: await db.warehouse.count(),
    products: await db.product.count(),
    inventory: await db.inventory.count(),
    movements: await db.stockMovement.count(),
    dispatches: await db.dispatch.count(),
    forecasts: await db.forecast.count(),
    audits: await db.auditLog.count(),
  };
  console.log("✅ Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
