import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import { appealOutcomeEnum, AppealOutcome } from './enums';
import { createdAt, SNOWFLAKE_LENGTH } from './shared';
import { bans } from './bans';
import { users } from './users';

export const appeals = pgTable('appeals', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  banId: integer()
    .notNull()
    .references(() => bans.id, { onDelete: 'cascade' }),
  filedAt: createdAt(),
  outcome: appealOutcomeEnum().$type<AppealOutcome>(),
  resolvedAt: timestamp({ withTimezone: true }),
  resolvedBy: varchar({ length: SNOWFLAKE_LENGTH }).references(() => users.id, { onDelete: 'set null' }),
});
