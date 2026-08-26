import { type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { updateUserSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { NotFoundError } from "@/lib/errors";
import { fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

const idSchema = z.string().cuid();

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("users:write");
    const { id } = await ctx.params;
    if (!idSchema.safeParse(id).success) return fail("Invalid id", 400);

    const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Invalid payload", 422, "VALIDATION_ERROR");
    if (Object.keys(parsed.data).length === 0) return fail("Nothing to update", 422);

    const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundError("User");

    if (target.id === actor.id && parsed.data.isActive === false) {
      return fail("You cannot deactivate your own account", 422, "SELF_DEACTIVATION");
    }
    if (target.role === "ADMIN" && parsed.data.role && parsed.data.role !== "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN", isActive: true } });
      if (adminCount <= 1) return fail("Cannot demote the last active administrator", 422, "LAST_ADMIN");
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.role !== undefined) data.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.password !== undefined) data.passwordHash = await hashPassword(parsed.data.password);

    const updated = await db.user.update({ where: { id }, data, select: PUBLIC_SELECT });
    await writeAudit({
      userId: actor.id,
      userEmail: actor.email,
      action: "USER_UPDATED",
      entity: "User",
      entityId: id,
      metadata: { changes: { ...parsed.data, password: parsed.data.password ? "[redacted]" : undefined } },
    });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
