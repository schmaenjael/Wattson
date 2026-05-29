import { pgTable, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH, USERNAME_LENGTH } from './shared';

export const users = pgTable('users', {
  id: varchar({ length: SNOWFLAKE_LENGTH }).primaryKey(),
  username: varchar({ length: USERNAME_LENGTH }).notNull(),
  firstSeenAt: createdAt(),
});
