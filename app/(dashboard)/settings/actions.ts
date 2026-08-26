"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { updateProfileSchema, changePasswordSchema } from "@/lib/validations/auth";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const parsed = updateProfileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid name" };
  }
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  await writeAudit({
    userId: user.id,
    userEmail: user.email,
    action: "PROFILE_UPDATED",
    entity: "User",
    entityId: user.id,
    metadata: { name: parsed.data.name },
  });
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const record = await db.user.findUnique({ where: { id: user.id } });
  if (!record) return { ok: false as const, error: "Account not found" };

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) return { ok: false as const, error: "Current password is incorrect" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await writeAudit({
    userId: user.id,
    userEmail: user.email,
    action: "PASSWORD_CHANGED",
    entity: "User",
    entityId: user.id,
  });
  return { ok: true as const };
}
