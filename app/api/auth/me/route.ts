import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: { message: "Authentication required", code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}
