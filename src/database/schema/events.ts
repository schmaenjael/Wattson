import { index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH, createdAt } from './shared';
import { users } from './users';

export const events = pgTable(
  'events',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    creatorId: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
    name: varchar({ length: 128 }).notNull(),
    description: varchar({ length: 2048 }).notNull(),
    scheduledAt: timestamp({ withTimezone: true }).notNull(),
    textChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    voiceChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    cronPattern: varchar({ length: 128 }),
    parentEventId: integer(),
    announcedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('events_scheduled_at_idx').on(t.scheduledAt),
    index('events_creator_idx').on(t.creatorId),
    index('events_parent_idx').on(t.parentEventId),
  ]
);
