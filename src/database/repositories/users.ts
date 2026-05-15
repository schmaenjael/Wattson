import { eq, type InferSelectModel } from 'drizzle-orm';
import type { Snowflake, User } from 'discord.js';

import { getDb } from '../client';
import { users } from '../schema/users';

export type UserRecord = InferSelectModel<typeof users>;

/** Upsert a Discord user into the users table. Called whenever we first touch a user. */
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

export const markUserLeft = async (id: Snowflake, at: Date = new Date()): Promise<void> => {
  const db = getDb();
  await db.update(users).set({ leftAt: at }).where(eq(users.id, id));
};

export const saveUserMembershipData = async (id: Snowflake, haiiloLink: string, chapterCountry: string | null): Promise<void> => {
  const db = getDb();
  await db.update(users).set({ haiiloLink, chapterCountry }).where(eq(users.id, id));
};
