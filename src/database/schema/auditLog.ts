import { index, jsonb, pgTable, serial, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { auditEventTypeEnum, AuditEventType } from './enums';

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial().primaryKey(),
    actorUserId: varchar({ length: SNOWFLAKE_LENGTH }),
    targetUserId: varchar({ length: SNOWFLAKE_LENGTH }),
    eventType: auditEventTypeEnum().notNull().$type<AuditEventType>(),
    payload: jsonb().$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_target_idx').on(t.targetUserId), index('audit_log_event_type_idx').on(t.eventType)]
);
