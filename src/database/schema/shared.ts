import { pgSchema, timestamp, varchar } from 'drizzle-orm/pg-core';

// Dedicated namespace for ML/training-data tables (harm-detector samples, future model/eval
// tables). Kept as an append-only sink with no FKs back into `public`, so a training role can
// be granted USAGE on `ml` alone and the data outlives operational churn.
export const ml = pgSchema('ml');

export const SNOWFLAKE_LENGTH = 20;
export const USERNAME_LENGTH = 32;
export const REASON_LENGTH = 512;
export const MESSAGE_EXCERPT_LENGTH = 512;

export const snowflake = (name?: string) => (name ? varchar(name, { length: SNOWFLAKE_LENGTH }) : varchar({ length: SNOWFLAKE_LENGTH }));

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
