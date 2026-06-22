import { check, pgTable, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { createdAt, SNOWFLAKE_LENGTH, USERNAME_LENGTH } from './shared';

export const users = pgTable(
  'users',
  { id: varchar({ length: SNOWFLAKE_LENGTH }).primaryKey(), username: varchar({ length: USERNAME_LENGTH }).notNull(), firstSeenAt: createdAt() },
  (t) => [check('users_username_nonempty', sql`length(${t.username}) > 0`)]
);
