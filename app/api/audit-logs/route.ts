import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { auditLogQuerySchema } from "@/lib/validations/misc";
import { handleApiError, ok } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("audit:read");
    const query = auditLogQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = { contains: query.action.toUpperCase() };
    if (query.entity) where.entity = query.entity;
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
        { userEmail: { contains: query.q, mode: "insensitive" } },
        { entityId: { contains: query.q } },
      ];
    }

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      db.auditLog.count({ where }),
    ]);

    return ok({ items, total, page: query.page, perPage: query.perPage });
  } catch (error) {
    return handleApiError(error);
  }
}
