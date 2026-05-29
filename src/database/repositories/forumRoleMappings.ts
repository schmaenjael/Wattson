import { and, eq, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { forumRoleMappings } from '../schema/forumRoleMappings';

export type ForumRoleMapping = InferSelectModel<typeof forumRoleMappings>;
export type ForumRoleMappingInsert = Omit<InferInsertModel<typeof forumRoleMappings>, 'id'>;

export const insertForumRoleMapping = async (data: ForumRoleMappingInsert): Promise<ForumRoleMapping | null> => {
  const db = getDb();
  const [row] = await db.insert(forumRoleMappings).values(data).onConflictDoNothing().returning();
  return row ?? null;
};

export const deleteForumRoleMapping = async (channelId: string, roleId: string): Promise<boolean> => {
  const db = getDb();
  const deleted = await db
    .delete(forumRoleMappings)
    .where(and(eq(forumRoleMappings.channelId, channelId), eq(forumRoleMappings.roleId, roleId)))
    .returning();
  return deleted.length > 0;
};

export const listForumRoleMappings = async (channelId?: string): Promise<ForumRoleMapping[]> => {
  const db = getDb();
  if (channelId) {
    return db.select().from(forumRoleMappings).where(eq(forumRoleMappings.channelId, channelId)).orderBy(forumRoleMappings.roleId);
  }
  return db.select().from(forumRoleMappings).orderBy(forumRoleMappings.channelId, forumRoleMappings.roleId);
};

export const getForumRoleMappingsByRole = async (roleId: string): Promise<ForumRoleMapping[]> => {
  const db = getDb();
  return db.select().from(forumRoleMappings).where(eq(forumRoleMappings.roleId, roleId));
};
