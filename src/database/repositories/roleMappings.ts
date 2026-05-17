import { and, eq, inArray, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { roleMappings } from '../schema/roleMappings';
import { RoleMappingType } from '../schema/enums';
import { invalidateSettingsCache } from '../settings';

export type RoleMapping = InferSelectModel<typeof roleMappings>;
export type RoleMappingInsert = Omit<InferInsertModel<typeof roleMappings>, 'id'>;

export const upsertRoleMapping = async (data: RoleMappingInsert): Promise<RoleMapping> => {
  const db = getDb();
  const [row] = await db
    .insert(roleMappings)
    .values(data)
    .onConflictDoUpdate({ target: [roleMappings.type, roleMappings.value], set: { roleId: data.roleId } })
    .returning();
  invalidateSettingsCache();
  return row;
};

export const deleteRoleMapping = async (type: RoleMappingType, value: string): Promise<boolean> => {
  const db = getDb();
  const deleted = await db
    .delete(roleMappings)
    .where(and(eq(roleMappings.type, type), eq(roleMappings.value, value)))
    .returning();
  invalidateSettingsCache();
  return deleted.length > 0;
};

export const listRoleMappings = async (type?: RoleMappingType): Promise<RoleMapping[]> => {
  const db = getDb();
  const query = db.select().from(roleMappings);
  if (type) {
    return query.where(eq(roleMappings.type, type)).orderBy(roleMappings.value);
  }
  return query.orderBy(roleMappings.type, roleMappings.value);
};

export const getRoleMappingsForAnswers = async (type: RoleMappingType, values: string[]): Promise<RoleMapping[]> => {
  if (values.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(roleMappings)
    .where(and(eq(roleMappings.type, type), inArray(roleMappings.value, values)));
};
