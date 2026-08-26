import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, PackageCheck, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { can } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { DispatchStatusBadge } from "../status-badge";
import { DispatchStatusActions } from "../dispatch-status-actions";

export const metadata: Metadata = { title: "Dispatch detail" };
export const dynamic = "force-dynamic";

const TIMELINE: Array<{ status: string; label: string }> = [
  { status: "PENDING", label: "Created" },
  { status: "PROCESSING", label: "Processing" },
  { status: "READY", label: "Ready to ship" },
  { status: "DISPATCHED", label: "Dispatched" },
];

export default async function DispatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePagePermission("dispatch:read");
  const { id } = await params;

  const dispatch = await db.dispatch.findUnique({
    where: { id },
    include: {
      warehouse: true,
      createdByUser: { select: { name: true, email: true } },
      items: { include: { product: true } },
    },
  });
  if (!dispatch) notFound();

  const inventories = await db.inventory.findMany({
    where: { warehouseId: dispatch.warehouseId, productId: { in: dispatch.items.map((i) => i.productId) } },
    select: { productId: true, quantity: true, reservedQuantity: true },
  });
  const invByProduct = new Map(inventories.map((i) => [i.productId, i]));

  const totalValue = dispatch.items.reduce(
    (acc, item) => acc + item.quantity * parseFloat(item.product.price.toString()),
    0,
  );
  const currentIndex =
    dispatch.status === "CANCELLED"
      ? -1
      : TIMELINE.findIndex((t) => t.status === dispatch.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dispatch" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to dispatches
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold">{dispatch.number}</h1>
              <p className="text-sm text-muted-foreground">{dispatch.customerName}</p>
            </div>
            <DispatchStatusBadge status={dispatch.status} />
          </div>
          {can(user.role, "dispatch:process") && (
            <DispatchStatusActions dispatchId={dispatch.id} status={dispatch.status} />
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          {dispatch.status === "CANCELLED" ? (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              This dispatch was cancelled on {formatDateTime(dispatch.cancelledAt)}. Any reserved stock was released.
            </div>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-4" aria-label="Dispatch progress">
              {TIMELINE.map((step, i) => {
                const done = i <= currentIndex;
                return (
                  <li key={step.status} className="flex items-center gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                      aria-current={i === currentIndex ? "step" : undefined}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{step.label}</p>
                      {i === 0 && (
                        <p className="text-xs text-muted-foreground">{formatDateTime(dispatch.createdAt)}</p>
                      )}
                      {step.status === "DISPATCHED" && dispatch.dispatchedAt && (
                        <p className="text-xs text-muted-foreground">{formatDateTime(dispatch.dispatchedAt)}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Warehouse stock</TableHead>
                  <TableHead className="text-right">Line value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatch.items.map((item) => {
                  const inv = invByProduct.get(item.productId);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold">{item.product.sku}</TableCell>
                      <TableCell>{item.product.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {inv ? `${inv.quantity} (${inv.quantity - inv.reservedQuantity} avail)` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.quantity * parseFloat(item.product.price.toString()))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end border-t pt-3">
              <p className="text-sm">
                Order value: <span className="font-bold">{formatCurrency(totalValue)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Origin warehouse" value={`${dispatch.warehouse.code} — ${dispatch.warehouse.name}`} />
            <DetailRow label="Customer reference" value={dispatch.customerRef || "—"} />
            <DetailRow label="Created by" value={`${dispatch.createdByUser.name}`} />
            <DetailRow label="Requested at" value={formatDateTime(dispatch.requestedAt)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
            {dispatch.notes && <DetailRow label="Notes" value={dispatch.notes} />}
            <div className="flex items-start gap-2 rounded-lg bg-[var(--success)]/10 p-3 text-xs text-[var(--success)]">
              <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Stock for this dispatch is reserved and cannot be allocated to other orders until it completes or is cancelled.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
