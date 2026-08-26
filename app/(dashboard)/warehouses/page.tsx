import type { Metadata } from "next";
import { MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { warehouseQuerySchema } from "@/lib/validations/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber, initials } from "@/lib/utils";
import { CreateWarehouseDialog, EditWarehouseDialog } from "./warehouse-dialogs";

export const metadata: Metadata = { title: "Warehouses" };
export const dynamic = "force-dynamic";

export default async function WarehousesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePagePermission("warehouses:read", "/warehouses");
  const query = warehouseQuerySchema.parse(await searchParams);

  const where: Prisma.WarehouseWhereInput = {};
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { code: { contains: query.q, mode: "insensitive" } },
      { location: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const orderByMap: Record<string, Prisma.WarehouseOrderByWithRelationInput> = {
    name: { name: query.order },
    code: { code: query.order },
    capacity: { capacity: query.order },
    createdAt: { createdAt: query.order },
  };

  const [warehouses, total] = await Promise.all([
    db.warehouse.findMany({
      where,
      orderBy: orderByMap[query.sort],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      include: {
        inventories: {
          select: { quantity: true, product: { select: { price: true } } },
        },
        _count: { select: { dispatches: true } },
      },
    }),
    db.warehouse.count({ where }),
  ]);

  const canWrite = can(user.role, "warehouses:write");

  return (
    <div>
      <PageHeader
        title="Warehouses"
        description={`${total} facilit${total === 1 ? "y" : "ies"} in the network`}
        actions={canWrite ? <CreateWarehouseDialog /> : <Badge variant="secondary">Read-only access</Badge>}
      />

      {warehouses.length === 0 ? (
        <EmptyState icon={WarehouseIcon} title="No warehouses" description="Create a warehouse to start tracking inventory." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {warehouses.map((w) => {
              const units = w.inventories.reduce((a, i) => a + i.quantity, 0);
              const value = w.inventories.reduce(
                (acc, i) => acc + i.quantity * parseFloat(i.product.price.toString()),
                0,
              );
              const utilization = Math.min(100, Math.round((units / Math.max(1, w.capacity)) * 100));
              return (
                <Card key={w.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 font-bold text-primary">
                          {initials(w.name)}
                        </span>
                        <div>
                          <p className="font-semibold leading-tight">{w.name}</p>
                          <p className="text-xs text-muted-foreground">{w.code}</p>
                        </div>
                      </div>
                      <Badge variant={w.isActive ? "success" : "secondary"}>{w.isActive ? "Active" : "Inactive"}</Badge>
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {w.location}
                    </p>

                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/60 p-2">
                        <dt className="text-[10px] uppercase text-muted-foreground">Units</dt>
                        <dd className="text-sm font-bold tabular-nums">{formatNumber(units)}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <dt className="text-[10px] uppercase text-muted-foreground">Value</dt>
                        <dd className="text-sm font-bold tabular-nums">{formatCurrency(value)}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <dt className="text-[10px] uppercase text-muted-foreground">Dispatches</dt>
                        <dd className="text-sm font-bold tabular-nums">{w._count.dispatches}</dd>
                      </div>
                    </dl>

                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Capacity utilization</span>
                        <span className="tabular-nums">{utilization}% of {formatNumber(w.capacity)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                        <div
                          className={`h-full rounded-full ${utilization > 90 ? "bg-destructive" : utilization > 70 ? "bg-[var(--warning)]" : "bg-primary"}`}
                          style={{ width: `${utilization}%` }}
                        />
                      </div>
                    </div>

                    {canWrite && (
                      <div className="mt-4 border-t pt-3 text-sm">
                        <EditWarehouseDialog
                          warehouse={{
                            id: w.id,
                            name: w.name,
                            code: w.code,
                            location: w.location,
                            capacity: w.capacity,
                            managerName: w.managerName,
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={query.page} perPage={query.perPage} total={total} basePath="/warehouses" searchParams={{ q: query.q }} />
        </>
      )}
    </div>
  );
}
