import type { Metadata } from "next";
import { Users as UsersIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { userQuerySchema } from "@/lib/validations/misc";
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
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import { CreateUserDialog, EditUserDialog, ToggleUserActiveButton } from "./user-dialogs";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const ROLE_VARIANT: Record<string, "default" | "secondary" | "warning" | "success"> = {
  ADMIN: "warning",
  MANAGER: "default",
  WAREHOUSE_STAFF: "success",
  VIEWER: "secondary",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePagePermission("users:read", "/users");
  const query = userQuerySchema.parse(await searchParams);

  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    db.user.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description={`${total} accounts · role-based access control`}
        actions={<CreateUserDialog />}
      />

      <form action="/users" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Search name or email…"
          aria-label="Search users"
          className="h-9 rounded-md border bg-card px-3 text-sm sm:w-64"
        />
        <select name="role" defaultValue={query.role} aria-label="Role filter" className="h-9 rounded-md border bg-card px-2 text-sm">
          <option value="">All roles</option>
          <option value="ADMIN">ADMIN</option>
          <option value="MANAGER">MANAGER</option>
          <option value="WAREHOUSE_STAFF">WAREHOUSE_STAFF</option>
          <option value="VIEWER">VIEWER</option>
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Filter
        </button>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                          {initials(u.name)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {u.name}
                            {u.id === actor.id && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANT[u.role]}>{u.role.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "destructive"}>{u.isActive ? "Active" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</TableCell>
                    <TableCell className="text-xs">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <EditUserDialog user={{ id: u.id, name: u.name, email: u.email, role: u.role }} />
                        {u.id !== actor.id && <ToggleUserActiveButton userId={u.id} isActive={u.isActive} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={query.page} perPage={query.perPage} total={total} basePath="/users" searchParams={{ q: query.q, role: query.role }} />
        </>
      )}
    </div>
  );
}
