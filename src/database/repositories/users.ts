import { eq, type InferSelectModel } from 'drizzle-orm';
import type { Snowflake, User } from 'discord.js';

import { getDb } from '~/database/client';
import { users } from '~/database/schema/users';

export type UserRecord = InferSelectModel<typeof users>;

export const upsertUser = async (user: Pick<User, 'id' | 'username'>): Promise<UserRecord> => {
  const db = getDb();
  const [row] = await db
    .insert(users)
    .values({ id: user.id, username: user.username })
    .onConflictDoUpdate({ target: users.id, set: { username: user.username } })
    .returning();
  return row;
};

export const findUserById = async (id: Snowflake): Promise<UserRecord | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
};
