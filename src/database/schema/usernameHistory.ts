import { index, pgTable, serial, varchar } from 'drizzle-orm/pg-core';

import { createdAt, SNOWFLAKE_LENGTH, USERNAME_LENGTH } from './shared';
import { users } from './users';

export const usernameHistory = pgTable(
  'username_history',
  {
    id: serial().primaryKey(),
    userId: varchar({ length: SNOWFLAKE_LENGTH })
      .notNull()
      .references(() => users.id),
    username: varchar({ length: USERNAME_LENGTH }).notNull(),
    changedAt: createdAt(),
  },
  (t) => [index('username_history_user_idx').on(t.userId)]
);
