import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

/** GET /api/notifications - latest unread notifications for the header bell */
export async function GET() {
  try {
    await requireUser();
    const items = await db.notification.findMany({
      where: { readAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        createdAt: true,
      },
    });
    return ok({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/notifications - mark all as read */
export async function POST() {
  try {
    await requireUser();
    await db.notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ markedRead: true });
  } catch (error) {
    return handleApiError(error);
  }
}
