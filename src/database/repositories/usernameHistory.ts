import type { Snowflake } from 'discord.js';

import { getDb } from '../client';
import { usernameHistory } from '../schema/usernameHistory';

export const recordUsernameChange = async (userId: Snowflake, username: string): Promise<void> => {
  const db = getDb();
  await db.insert(usernameHistory).values({ userId, username });
};
