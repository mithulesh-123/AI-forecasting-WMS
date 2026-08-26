import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface AuditEntry {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Persists an audit trail entry. Failures are logged but never break the
 * primary business operation.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        userEmail: entry.userEmail ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined,
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to persist audit log:", error);
  }
}
