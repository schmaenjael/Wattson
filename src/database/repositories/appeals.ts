import { eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { appeals } from '~/database/schema/appeals';
import { AppealOutcome } from '~/database/schema/enums';

export type Appeal = InferSelectModel<typeof appeals>;

export const insertAppeal = async (banId: number): Promise<Appeal> => {
  const db = getDb();
  const [row] = await db.insert(appeals).values({ banId }).returning();
  return row;
};

export const findAppealById = async (id: number): Promise<Appeal | null> => {
  const db = getDb();
  const [row] = await db.select().from(appeals).where(eq(appeals.id, id)).limit(1);
  return row ?? null;
};

export const findAppealByBanId = async (banId: number): Promise<Appeal | null> => {
  const db = getDb();
  const [row] = await db.select().from(appeals).where(eq(appeals.banId, banId)).limit(1);
  return row ?? null;
};

export const setAppealOutcome = async (id: number, outcome: AppealOutcome, resolvedBy: string): Promise<void> => {
  const db = getDb();
  await db.update(appeals).set({ outcome, resolvedAt: new Date(), resolvedBy }).where(eq(appeals.id, id));
};
