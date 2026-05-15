import { foreignKey, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { SNOWFLAKE_LENGTH, createdAt } from './shared';
import { externalPlatformEnum, ExternalPlatform, externalPostStatusEnum, ExternalPostStatus } from './enums';
import { starboardEntries } from './starboardEntries';

export const externalPosts = pgTable(
  'external_posts',
  {
    id: serial().primaryKey(),
    sourceMessageId: varchar({ length: SNOWFLAKE_LENGTH }).notNull(),
    platform: externalPlatformEnum().notNull().$type<ExternalPlatform>(),
    remoteId: varchar({ length: 256 }),
    status: externalPostStatusEnum().notNull().default('queued').$type<ExternalPostStatus>(),
    error: text(),
    postedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [foreignKey({ name: 'ext_posts_source_msg_fk', columns: [t.sourceMessageId], foreignColumns: [starboardEntries.sourceMessageId] })]
);
