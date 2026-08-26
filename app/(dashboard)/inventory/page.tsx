import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { inventoryQuerySchema } from "@/lib/validations/inventory";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { StockOperationRowButton } from "./stock-op-row";
import { StockOperationDialog } from "./stock-op-dialog";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePagePermission("inventory:read", "/inventory");
  const query = inventoryQuerySchema.parse(await searchParams);

  const where: Prisma.InventoryWhereInput = {};
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.q) {
    where.product = {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { sku: { contains: query.q, mode: "insensitive" } },
      ],
    };
  }

  const [inventories, total, products, warehouses] = await Promise.all([
    db.inventory.findMany({
      where,
      orderBy: [{ product: { name: "asc" } }],
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true, reorderLevel: true, category: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    db.inventory.count({ where }),
    db.product.findMany({ where: { isActive: true }, select: { id: true, sku: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
    db.warehouse.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  // Post-fetch filtering for low/out (needs reserved math)
  let rows = inventories.map((inv) => ({
    id: inv.id,
    product: inv.product,
    warehouse: inv.warehouse,
    quantity: inv.quantity,
    reserved: inv.reservedQuantity,
    available: Math.max(0, inv.quantity - inv.reservedQuantity),
  }));

  if (query.filter === "low") rows = rows.filter((r) => r.quantity <= r.product.reorderLevel);
  if (query.filter === "out") rows = rows.filter((r) => r.quantity <= 0);

  const totalFiltered = query.filter === "all" ? total : rows.length;
  const canWrite = can(user.role, "inventory:write");

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock levels across all warehouses"
        actions={
          canWrite ? (
            <StockOperationDialog products={products} warehouses={warehouses} />
          ) : (
            <Badge variant="secondary">Read-only access</Badge>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <form action="/inventory" className="flex gap-2 sm:max-w-sm">
          {query.warehouseId && <input type="hidden" name="warehouseId" value={query.warehouseId} />}
          <input type="hidden" name="filter" value={query.filter} />
          <input
            name="q"
            placeholder="Search SKU or product…"
            defaultValue={query.q ?? ""}
            aria-label="Search inventory"
            className="flex h-9 w-full rounded-md border bg-card px-3 py-1 text-sm"
          />
          <button type="submit" className="h-9 rounded-md bg-secondary px-3 text-sm font-medium hover:bg-secondary/80">
            Search
          </button>
        </form>
        <div className="flex gap-1.5">
          {(["all", "low", "out"] as const).map((f) => {
            const sp = new URLSearchParams();
            if (query.q) sp.set("q", query.q);
            if (query.warehouseId) sp.set("warehouseId", query.warehouseId);
            if (f !== "all") sp.set("filter", f);
            return (
              <a
                key={f}
                href={`/inventory${sp.size > 0 ? `?${sp.toString()}` : ""}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  query.filter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
                aria-current={query.filter === f ? "true" : undefined}
              >
                {f === "all" ? "All stock" : f + " stock"}
              </a>
            );
          })}
        </div>
        {warehouses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <a
              href={`/inventory?${new URLSearchParams({
                ...(query.q ? { q: query.q } : {}),
                ...(query.filter !== "all" ? { filter: query.filter } : {}),
              }).toString()}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${!query.warehouseId ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}
            >
              All warehouses
            </a>
            {warehouses.map((w) => {
              const sp = new URLSearchParams();
              if (query.q) sp.set("q", query.q);
              if (query.filter !== "all") sp.set("filter", query.filter);
              sp.set("warehouseId", w.id);
              return (
                <a
                  key={w.id}
                  href={`/inventory?${sp.toString()}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    query.warehouseId === w.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                  }`}
                >
                  {w.code}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No inventory records" description="Run a Stock IN operation to create the first inventory row." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                  {canWrite && <TableHead className="w-24"><span className="sr-only">Operate</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold">{r.product.sku}</TableCell>
                    <TableCell className="max-w-52">
                      <p className="truncate text-sm font-medium">{r.product.name}</p>
                      <p className="text-xs text-muted-foreground">{r.product.category}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{r.warehouse.code}</span>
                      <span className="block text-xs text-muted-foreground">{r.warehouse.name}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(r.reserved)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatNumber(r.available)}</TableCell>
                    <TableCell>
                      {r.quantity <= 0 ? (
                        <Badge variant="destructive">Out of stock</Badge>
                      ) : r.available <= 0 ? (
                        <Badge variant="warning">Fully reserved</Badge>
                      ) : r.quantity <= r.product.reorderLevel ? (
                        <Badge variant="warning">Low stock</Badge>
                      ) : (
                        <Badge variant="success">Healthy</Badge>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <StockOperationRowButton
                          products={products}
                          warehouses={warehouses}
                          productId={r.product.id}
                          warehouseId={r.warehouse.id}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={query.page}
            perPage={query.perPage}
            total={totalFiltered}
            basePath="/inventory"
            searchParams={{ q: query.q, warehouseId: query.warehouseId, filter: query.filter }}
          />
        </>
      )}
    </div>
  );
}
