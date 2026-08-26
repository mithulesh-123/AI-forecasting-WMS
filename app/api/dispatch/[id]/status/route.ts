import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guards";
import { updateDispatchStatus } from "@/lib/dispatch/service";
import { dispatchStatusUpdateSchema } from "@/lib/validations/dispatch";
import { fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

const idSchema = z.string().cuid();

/**
 * POST /api/dispatch/[id]/status
 * Body: { status: PROCESSING|READY|DISPATCHED|CANCELLED, note? }
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => null);
    const parsedBody = dispatchStatusUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return fail("Invalid status payload", 422, "VALIDATION_ERROR", parsedBody.error.flatten());
    }

    const permission =
      parsedBody.data.status === "CANCELLED" || parsedBody.data.status === "PENDING"
        ? "dispatch:write"
        : "dispatch:process";
    const user = await requirePermission(permission);

    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const result = await updateDispatchStatus(
      id,
      parsedBody.data.status,
      user.id,
      parsedBody.data.note || undefined,
    );
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
