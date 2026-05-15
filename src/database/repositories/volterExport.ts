import { eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { users } from '../schema/users';

export type VolterExportRow = Pick<InferSelectModel<typeof users>, 'id' | 'username' | 'haiiloLink' | 'chapterCountry'>;

export const getVoltersForChapter = async (chapterCountry: string): Promise<VolterExportRow[]> => {
  const db = getDb();
  return db
    .select({ id: users.id, username: users.username, haiiloLink: users.haiiloLink, chapterCountry: users.chapterCountry })
    .from(users)
    .where(eq(users.chapterCountry, chapterCountry));
};
