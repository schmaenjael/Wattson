import { index, integer, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { auditEventTypeEnum, AuditEventType } from './enums';
import { users } from './users';

export const auditLog = pgTable(
  'audit_log',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    targetUserId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    eventType: auditEventTypeEnum().notNull().$type<AuditEventType>(),
    payload: jsonb().$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_target_idx').on(t.targetUserId),
    index('audit_log_event_type_idx').on(t.eventType),
    index('audit_log_actor_event_idx').on(t.actorUserId, t.eventType),
    index('audit_log_created_at_brin').using('brin', t.createdAt),
  ]
);
