import { count, eq, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { starboardEntries } from '../schema/starboardEntries';
import { externalPosts } from '../schema/externalPosts';
import { ExternalPlatform, ExternalPostStatus } from '../schema/enums';

export type StarboardEntry = InferSelectModel<typeof starboardEntries>;
export type NewStarboardEntry = InferInsertModel<typeof starboardEntries>;
export type ExternalPost = InferSelectModel<typeof externalPosts>;
export type NewExternalPost = Omit<InferInsertModel<typeof externalPosts>, 'id' | 'createdAt' | 'status'>;

export const findStarboardEntry = async (sourceMessageId: string): Promise<StarboardEntry | undefined> => {
  const db = getDb();
  const [row] = await db.select().from(starboardEntries).where(eq(starboardEntries.sourceMessageId, sourceMessageId)).limit(1);
  return row;
};

export const upsertStarboardEntry = async (entry: NewStarboardEntry): Promise<StarboardEntry> => {
  const db = getDb();
  const [row] = await db
    .insert(starboardEntries)
    .values(entry)
    .onConflictDoUpdate({
      target: starboardEntries.sourceMessageId,
      set: { starCount: entry.starCount, starboardMessageId: entry.starboardMessageId, lastUpdatedAt: new Date() },
    })
    .returning();
  return row;
};

export const hasExternalPostsForMessage = async (sourceMessageId: string): Promise<boolean> => {
  const db = getDb();
  const [row] = await db.select({ n: count() }).from(externalPosts).where(eq(externalPosts.sourceMessageId, sourceMessageId));
  return (row?.n ?? 0) > 0;
};

export const insertExternalPost = async (input: NewExternalPost): Promise<ExternalPost> => {
  const db = getDb();
  const [row] = await db.insert(externalPosts).values(input).returning();
  return row;
};

export const markExternalPostStatus = async (
  id: number,
  status: ExternalPostStatus,
  fields: Partial<Pick<ExternalPost, 'remoteId' | 'error' | 'postedAt'>> = {}
): Promise<void> => {
  const db = getDb();
  await db
    .update(externalPosts)
    .set({ status, ...fields })
    .where(eq(externalPosts.id, id));
};

export { ExternalPlatform, ExternalPostStatus };
