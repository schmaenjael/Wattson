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

export const recordAuditEvent = async (entry: AuditEntry): Promise<AuditLogRecord> => {
  const db = getDb();
  const [row] = await db
    .insert(auditLog)
    .values({ eventType: entry.eventType, actorUserId: entry.actorUserId, targetUserId: entry.targetUserId, payload: entry.payload ?? {} })
    .returning();
  return row;
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
 * Payload of the `VerificationAnswered` audit event with this specific row id, or null if it
 * doesn't exist (or isn't actually a `VerificationAnswered` row). Scoped to one approval embed's
 * specific submission — not "latest for this user" — so approving an older pending embed can't
 * silently apply a different, newer submission's answers.
 */
export const getVerificationAnswersById = async (auditRowId: number): Promise<Record<string, unknown> | null> => {
  const db = getDb();
  const [row] = await db
    .select({ payload: auditLog.payload })
    .from(auditLog)
    .where(and(eq(auditLog.id, auditRowId), eq(auditLog.eventType, AuditEventType.VerificationAnswered)))
    .limit(1);
  return row?.payload ?? null;
};
