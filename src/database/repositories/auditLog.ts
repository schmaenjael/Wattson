import { and, desc, eq, inArray, type InferSelectModel } from 'drizzle-orm';
import type { Snowflake } from 'discord.js';

import { getDb } from '~/database/client';
import { auditLog } from '~/database/schema/auditLog';
import { AuditEventType } from '~/database/schema/enums';

export type AuditLogRecord = InferSelectModel<typeof auditLog>;

export interface AuditEntry {
  eventType: AuditEventType;
  actorUserId?: Snowflake;
  targetUserId?: Snowflake;
  payload?: Record<string, unknown>;
}

export const recordAuditEvent = async (entry: AuditEntry): Promise<void> => {
  const db = getDb();
  await db
    .insert(auditLog)
    .values({ eventType: entry.eventType, actorUserId: entry.actorUserId, targetUserId: entry.targetUserId, payload: entry.payload ?? {} });
};

export const listModActionsAsActor = async (actorUserId: string, eventTypes: AuditEventType[]): Promise<AuditLogRecord[]> => {
  const db = getDb();
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.actorUserId, actorUserId), inArray(auditLog.eventType, eventTypes)))
    .orderBy(desc(auditLog.createdAt));
};

/**
 * Payload of the most recent `VerificationAnswered` audit event for a user, or null if none exists.
 * Latest by user, not scoped to a specific approval embed — if a user has two pending approvals
 * simultaneously, approving the older one grants access on their newer submission.
 */
export const getLatestVerificationAnswers = async (targetUserId: string): Promise<Record<string, unknown> | null> => {
  const db = getDb();
  const [row] = await db
    .select({ payload: auditLog.payload })
    .from(auditLog)
    .where(and(eq(auditLog.targetUserId, targetUserId), eq(auditLog.eventType, AuditEventType.VerificationAnswered)))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  return row?.payload ?? null;
};
