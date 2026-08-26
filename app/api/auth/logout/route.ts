import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await writeAudit({
      userId: user.id,
      userEmail: user.email,
      action: "LOGOUT",
      entity: "User",
      entityId: user.id,
    });
  }
  await clearSessionCookie();
  return Response.json({ success: true, data: null });
}
