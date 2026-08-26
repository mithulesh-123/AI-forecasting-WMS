import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { auditLogQuerySchema } from "@/lib/validations/misc";
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

export const metadata: Metadata = { title: "Audit Logs" };
export const dynamic = "force-dynamic";

function parseBound(v?: string, eod = false): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  if (eod) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission("audit:read", "/audit-logs");
  const query = auditLogQuerySchema.parse(await searchParams);

  const where: Prisma.AuditLogWhereInput = {};
  if (query.action) where.action = { contains: query.action.toUpperCase(), mode: "insensitive" };
  if (query.entity) where.entity = query.entity;
  const from = parseBound(query.from || undefined);
  const to = parseBound(query.to || undefined, true);
  if (from || to) where.createdAt = { gte: from, lte: to };
  if (query.q) {
    where.OR = [
      { userEmail: { contains: query.q, mode: "insensitive" } },
      { entityId: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    db.auditLog.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Immutable trail of security-relevant events"
        actions={<Badge variant="secondary">{total.toLocaleString()} entries</Badge>}
      />

      <form action="/audit-logs" className="mb-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Search user / entity id…"
          aria-label="Search logs"
          className="h-9 rounded-md border bg-card px-3 text-sm lg:w-56"
        />
        <input
          name="action"
          defaultValue={query.action ?? ""}
          placeholder="Action (e.g. LOGIN)"
          aria-label="Action filter"
          className="h-9 rounded-md border bg-card px-3 text-sm lg:w-44"
        />
        <select name="entity" defaultValue={query.entity ?? ""} aria-label="Entity filter" className="h-9 rounded-md border bg-card px-2 text-sm">
          <option value="">All entities</option>
          <option value="User">User</option>
          <option value="Product">Product</option>
          <option value="Warehouse">Warehouse</option>
          <option value="Inventory">Inventory</option>
          <option value="Dispatch">Dispatch</option>
          <option value="Notification">Notification</option>
        </select>
        <input type="date" name="from" defaultValue={query.from ?? ""} aria-label="From date" className="h-9 rounded-md border bg-card px-2 text-sm" />
        <input type="date" name="to" defaultValue={query.to ?? ""} aria-label="To date" className="h-9 rounded-md border bg-card px-2 text-sm" />
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Apply filters
        </button>
      </form>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Adjust filters or perform an action first." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-semibold">{log.entity}</span>
                      {log.entityId && <span className="block font-mono text-[10px] text-muted-foreground">{log.entityId}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{log.userEmail ?? "system"}</TableCell>
                    <TableCell className="max-w-72">
                      <code className="block truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]" title={JSON.stringify(log.metadata)}>
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </code>
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
            basePath="/audit-logs"
            searchParams={{ q: query.q, action: query.action, entity: query.entity, from: query.from, to: query.to }}
          />
        </>
      )}
    </div>
  );
}
