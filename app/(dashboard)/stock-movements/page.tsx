import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { movementQuerySchema } from "@/lib/validations/inventory";
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
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Stock Movement" };
export const dynamic = "force-dynamic";

const TYPE_VARIANT: Record<string, "success" | "destructive" | "default" | "warning" | "secondary"> = {
  IN: "success",
  OUT: "destructive",
  TRANSFER: "default",
  ADJUSTMENT: "warning",
  RETURN: "secondary",
};

function parseDateBound(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission("movements:read", "/stock-movements");
  const query = movementQuerySchema.parse(await searchParams);

  const where: Prisma.StockMovementWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.productId) where.productId = query.productId;
  const from = parseDateBound(query.from || undefined);
  const to = parseDateBound(query.to || undefined, true);
  if (from || to) where.createdAt = { gte: from, lte: to };
  if (query.q) {
    where.OR = [
      { reference: { contains: query.q, mode: "insensitive" } },
      { reason: { contains: query.q, mode: "insensitive" } },
      { product: { name: { contains: query.q, mode: "insensitive" } } },
      { product: { sku: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const [movements, total, warehouses] = await Promise.all([
    db.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      include: {
        product: { select: { sku: true, name: true } },
        warehouse: { select: { code: true, name: true } },
        destinationWarehouse: { select: { code: true } },
        user: { select: { name: true } },
      },
    }),
    db.stockMovement.count({ where }),
    db.warehouse.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Stock Movement"
        description="Immutable ledger of every inventory change"
        actions={<Badge variant="secondary">{total.toLocaleString()} records</Badge>}
      />

      <form action="/stock-movements" className="mb-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Search reference / reason / SKU…"
          aria-label="Search movements"
          className="h-9 rounded-md border bg-card px-3 text-sm lg:w-64"
        />
        <select
          name="type"
          defaultValue={query.type}
          aria-label="Movement type"
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="">All types</option>
          <option value="IN">IN</option>
          <option value="OUT">OUT</option>
          <option value="TRANSFER">TRANSFER</option>
          <option value="ADJUSTMENT">ADJUSTMENT</option>
          <option value="RETURN">RETURN</option>
        </select>
        <select
          name="warehouseId"
          defaultValue={query.warehouseId ?? ""}
          aria-label="Warehouse"
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={query.from ?? ""}
          aria-label="From date"
          className="h-9 rounded-md border bg-card px-2 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={query.to ?? ""}
          aria-label="To date"
          className="h-9 rounded-md border bg-card px-2 text-sm"
        />
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Apply filters
        </button>
      </form>

      {movements.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No movements found" description="Adjust filters or record a stock operation." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>→ Dest.</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Effect</TableHead>
                  <TableHead>Reason / Ref</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[m.type]}>{m.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{m.product.sku}</TableCell>
                    <TableCell className="max-w-48">
                      <p className="truncate text-sm">{m.product.name}</p>
                    </TableCell>
                    <TableCell className="text-sm">{m.warehouse.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.destinationWarehouse?.code ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.quantity.toLocaleString()}</TableCell>
                    <TableCell
                      className={`font-semibold tabular-nums ${m.quantityDelta > 0 ? "text-[var(--success)]" : m.quantityDelta < 0 ? "text-destructive" : ""}`}
                    >
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <p className="truncate text-xs text-muted-foreground">
                        {[m.reason, m.reference].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{m.user.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={query.page}
            perPage={query.perPage}
            total={total}
            basePath="/stock-movements"
            searchParams={{ q: query.q, type: query.type, warehouseId: query.warehouseId, from: query.from, to: query.to }}
          />
        </>
      )}
    </div>
  );
}
