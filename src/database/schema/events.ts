import { index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH } from './shared';

export const events = pgTable(
  'events',
  {
    id: serial().primaryKey(),
    creatorId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    name: varchar({ length: 128 }).notNull(),
    description: varchar({ length: 2048 }).notNull(),
    scheduledAt: timestamp({ withTimezone: true }).notNull(),
    textChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    voiceChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    cronPattern: varchar({ length: 128 }),
    parentEventId: integer(),
    announcedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('events_scheduled_at_idx').on(t.scheduledAt),
    index('events_creator_idx').on(t.creatorId),
    index('events_parent_idx').on(t.parentEventId),
  ]
);
