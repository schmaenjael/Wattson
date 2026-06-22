import { eq } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { inviteSnapshot } from '~/database/schema/inviteSnapshot';

export type InviteSnapshotRecord = InferSelectModel<typeof inviteSnapshot>;
export type InsertInviteSnapshot = Omit<InferInsertModel<typeof inviteSnapshot>, 'id' | 'deletedAt'>;

export const upsertInviteSnapshot = async (data: InsertInviteSnapshot): Promise<void> => {
  const db = getDb();
  await db
    .insert(inviteSnapshot)
    .values(data)
    .onConflictDoUpdate({
      target: inviteSnapshot.code,
      set: { inviterId: data.inviterId, channelId: data.channelId, maxUses: data.maxUses, maxAge: data.maxAge },
    });
};

export const markInviteDeleted = async (code: string, at: Date = new Date()): Promise<void> => {
  const db = getDb();
  await db.update(inviteSnapshot).set({ deletedAt: at }).where(eq(inviteSnapshot.code, code));
};
