/**
 * Edge-safe session verification (no database imports).
 * Mirrors lib/auth/session.ts crypto for use inside middleware.
 */
import { jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "wms_session";

export interface SessionPayload {
  sub: string;
  email: string;
  role: Role;
  name: string;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "wms" });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      role: payload.role as Role,
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}
