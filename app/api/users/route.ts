import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { createUserSchema } from "@/lib/validations/auth";
import { userQuerySchema } from "@/lib/validations/misc";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { ConflictError } from "@/lib/errors";
import { created, fail, handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users:read");
    const query = userQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { email: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      db.user.count({ where }),
    ]);
    return ok({ items, total, page: query.page, perPage: query.perPage });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("users:write");
    const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("Invalid user payload", 422, "VALIDATION_ERROR", parsed.error.flatten());

    const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) throw new ConflictError("A user with this email already exists");

    const createdUser = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: PUBLIC_SELECT,
    });

    await writeAudit({
      userId: actor.id,
      userEmail: actor.email,
      action: "USER_CREATED",
      entity: "User",
      entityId: createdUser.id,
      metadata: { email: createdUser.email, role: createdUser.role },
    });

    return created(createdUser);
  } catch (error) {
    return handleApiError(error);
  }
}
