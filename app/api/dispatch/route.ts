import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { createDispatchSchema, dispatchQuerySchema } from "@/lib/validations/dispatch";
import { createDispatch } from "@/lib/dispatch/service";
import { created, fail, handleApiError, ok } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("dispatch:read");
    const query = dispatchQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where: Prisma.DispatchWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.q) {
      where.OR = [
        { number: { contains: query.q, mode: "insensitive" } },
        { customerName: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.dispatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
        include: {
          warehouse: { select: { code: true } },
          items: { select: { quantity: true } },
        },
      }),
      db.dispatch.count({ where }),
    ]);

    return ok({ items, total, page: query.page, perPage: query.perPage });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("dispatch:write");
    const parsed = createDispatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail("Invalid dispatch payload", 422, "VALIDATION_ERROR", parsed.error.flatten());
    }

    const dispatch = await createDispatch(parsed.data, user.id);
    return created(dispatch);
  } catch (error) {
    return handleApiError(error);
  }
}
