import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie, signSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";
import { handleApiError, fail } from "@/lib/api/response";
import { getClientIp } from "@/lib/api/request";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const isTest = process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true";
    const limit = isTest
      ? { allowed: true, remaining: 1000, retryAfterSeconds: 0 }
      : rateLimit(`login:${ip}`, { limit: 30, windowMs: 60_000 });
    if (!limit.allowed) {
      return fail(
        `Too many login attempts. Try again in ${limit.retryAfterSeconds}s.`,
        429,
        "RATE_LIMITED",
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid email or password format", 400, "VALIDATION_ERROR");
    }
    const { email, password } = parsed.data;

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      await writeAudit({ action: "LOGIN_FAILED", entity: "User", userEmail: email, ip });
      return fail("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await writeAudit({
        userId: user.id,
        userEmail: user.email,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user.id,
        ip,
      });
      return fail("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const token = await signSession({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    await setSessionCookie(token);

    await Promise.all([
      db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      writeAudit({
        userId: user.id,
        userEmail: user.email,
        action: "LOGIN",
        entity: "User",
        entityId: user.id,
        ip,
      }),
    ]);

    return Response.json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
