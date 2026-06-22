import { integer, pgTable, primaryKey, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH } from './shared';
import { events } from './events';
import { users } from './users';

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    eventId: integer()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    registeredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })]
);
