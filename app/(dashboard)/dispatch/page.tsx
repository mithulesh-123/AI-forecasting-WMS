import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Truck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { dispatchQuerySchema } from "@/lib/validations/dispatch";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { DispatchStatusBadge } from "./status-badge";
import { CreateDispatchDialog } from "./dispatch-create-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dispatch" };
export const dynamic = "force-dynamic";

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePagePermission("dispatch:read", "/dispatch");
  const query = dispatchQuerySchema.parse(await searchParams);

  const where: Prisma.DispatchWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  const parseBound = (v?: string, eod = false) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return undefined;
    if (eod) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d;
  };
  const from = parseBound(query.from || undefined);
  const to = parseBound(query.to || undefined, true);
  if (from || to) where.createdAt = { gte: from, lte: to };
  if (query.q) {
    where.OR = [
      { number: { contains: query.q, mode: "insensitive" } },
      { customerName: { contains: query.q, mode: "insensitive" } },
      { customerRef: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [dispatches, total, warehouses] = await Promise.all([
    db.dispatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      include: {
        warehouse: { select: { code: true, name: true } },
        items: { select: { quantity: true } },
      },
    }),
    db.dispatch.count({ where }),
    db.warehouse.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
  ]);

  const activeProductIds = warehouses.length
    ? await db.product.findMany({
        where: { isActive: true },
        select: { id: true, sku: true, name: true },
        orderBy: { name: "asc" },
        take: 300,
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Dispatch"
        description="Outbound orders with stock reservation"
        actions={
          can(user.role, "dispatch:write") ? (
            <CreateDispatchDialog products={activeProductIds} warehouses={warehouses} />
          ) : (
            <Badge variant="secondary">Read-only access</Badge>
          )
        }
      />

      <form action="/dispatch" className="mb-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Search number / customer…"
          aria-label="Search dispatches"
          className="h-9 rounded-md border bg-card px-3 text-sm lg:w-60"
        />
        <select name="status" defaultValue={query.status} aria-label="Status filter" className="h-9 rounded-md border bg-card px-2 text-sm">
          <option value="">All statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="READY">READY</option>
          <option value="DISPATCHED">DISPATCHED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <select
          name="warehouseId"
          defaultValue={query.warehouseId ?? ""}
          aria-label="Warehouse filter"
          className="h-9 rounded-md border bg-card px-2 text-sm"
        >
          <option value="">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={query.from ?? ""} aria-label="From date" className="h-9 rounded-md border bg-card px-2 text-sm" />
        <input type="date" name="to" defaultValue={query.to ?? ""} aria-label="To date" className="h-9 rounded-md border bg-card px-2 text-sm" />
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Apply filters
        </button>
      </form>

      {dispatches.length === 0 ? (
        <EmptyState icon={Truck} title="No dispatches found" description="Create a dispatch to reserve and ship stock." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/dispatch/${d.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                        {d.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{d.customerName}</p>
                      {d.customerRef && <p className="text-xs text-muted-foreground">{d.customerRef}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{d.warehouse.code}</TableCell>
                    <TableCell>
                      <DispatchStatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.items.length}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.items.reduce((a, i) => a + i.quantity, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(d.createdAt)}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={query.page}
            perPage={query.perPage}
            total={total}
            basePath="/dispatch"
            searchParams={{ q: query.q, status: query.status, warehouseId: query.warehouseId, from: query.from, to: query.to }}
          />
        </>
      )}
    </div>
  );
}
