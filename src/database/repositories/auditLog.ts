import type { Snowflake } from 'discord.js';

import { getDb } from '../client';
import { auditLog } from '../schema/auditLog';
import type { AuditEventType } from '../schema/enums';

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
