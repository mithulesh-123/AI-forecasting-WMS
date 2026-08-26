import { type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/errors";
import { fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

const idSchema = z.string().cuid();

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("dispatch:read");
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const dispatch = await db.dispatch.findUnique({
      where: { id },
      include: {
        warehouse: true,
        items: { include: { product: { select: { sku: true, name: true, price: true } } } },
        createdByUser: { select: { name: true, email: true } },
      },
    });
    if (!dispatch) throw new NotFoundError("Dispatch");
    return ok(dispatch);
  } catch (error) {
    return handleApiError(error);
  }
}
