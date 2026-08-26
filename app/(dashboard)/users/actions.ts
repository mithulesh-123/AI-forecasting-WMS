"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { createUserSchema, updateUserSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { ConflictError } from "@/lib/errors";

export async function createUserAction(formData: FormData) {
  const actor = await requirePermission("users:write");
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) throw new ConflictError("A user with this email already exists");

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await writeAudit({
    userId: actor.id,
    userEmail: actor.email,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  revalidatePath("/users");
  return { ok: true as const };
}

export async function updateUserAction(id: string, formData: FormData) {
  const actor = await requirePermission("users:write");

  const parsed = updateUserSchema.safeParse({
    name: formData.get("name") || undefined,
    role: formData.get("role") || undefined,
    isActive: formData.get("isActive") === null ? undefined : formData.get("isActive") === "true",
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false as const, error: "Nothing to update" };
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { ok: false as const, error: "User not found" };

  // Safety rails: an admin cannot lock themselves out or demote the last admin.
  if (target.id === actor.id && parsed.data.isActive === false) {
    return { ok: false as const, error: "You cannot deactivate your own account" };
  }
  if (target.role === "ADMIN" && parsed.data.role && parsed.data.role !== "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN", isActive: true } });
    if (adminCount <= 1) {
      return { ok: false as const, error: "Cannot demote the last active administrator" };
    }
  }

  const data: Parameters<typeof db.user.update>[0]["data"] = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.password !== undefined) data.passwordHash = await hashPassword(parsed.data.password);

  await db.user.update({ where: { id }, data });
  await writeAudit({
    userId: actor.id,
    userEmail: actor.email,
    action: "USER_UPDATED",
    entity: "User",
    entityId: id,
    metadata: { changes: { ...parsed.data, password: parsed.data.password ? "[redacted]" : undefined } },
  });

  revalidatePath("/users");
  return { ok: true as const };
}
