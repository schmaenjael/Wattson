import { primaryKey, pgTable, integer, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH } from './shared';

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    eventId: integer().notNull(),
    userId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    registeredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })]
);
