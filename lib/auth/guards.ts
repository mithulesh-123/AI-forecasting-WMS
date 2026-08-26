import "server-only";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/permissions";
import { getCurrentUser, requireUser, type CurrentUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";

/**
 * Page-level guard: redirects to /login when unauthenticated.
 */
export async function requirePageUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return user;
}

/**
 * Page-level guard with permission check. Redirects to /dashboard when
 * the signed-in user lacks the required permission.
 */
export async function requirePagePermission(permission: Permission, nextPath?: string): Promise<CurrentUser> {
  const user = await requirePageUser(nextPath);
  if (!can(user.role, permission)) redirect("/dashboard");
  return user;
}

/**
 * Server-action / API guard. Throws typed errors mapped to HTTP responses.
 */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}
