import { eq, inArray, type InferSelectModel } from 'drizzle-orm';

import { AppFeature, ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

import { getDb } from './client';
import { settings } from './schema/settings';
import { roleMappings } from './schema/roleMappings';
import { RoleMappingType } from './schema/enums';

type DbSettings = InferSelectModel<typeof settings>;

export type RoleIds = {
  roleUnregisteredId: string | null;
  roleCommunityId: string | null;
  roleMemberId: string | null;
  roleEventManagerId: string | null;
  roleModerationId: string | null;
  roleAdministrationId: string | null;
  roleMutedId: string | null;
  roleModmailHandlerId: string | null;
};

export type Settings = DbSettings & RoleIds;

const SINGLETON_ID = 1;
let cache: Settings | null = null;

const fetchRoleIds = async (): Promise<RoleIds> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(roleMappings)
    .where(inArray(roleMappings.type, [RoleMappingType.Permission, RoleMappingType.Utility]));
  const byValue = new Map(rows.map((r) => [r.value, r.roleId]));
  return {
    roleUnregisteredId: byValue.get('unregistered') ?? null,
    roleCommunityId: byValue.get('community') ?? null,
    roleMemberId: byValue.get('member') ?? null,
    roleEventManagerId: byValue.get('eventmanager') ?? null,
    roleModerationId: byValue.get('moderation') ?? null,
    roleAdministrationId: byValue.get('administration') ?? null,
    roleMutedId: byValue.get('muted') ?? null,
    roleModmailHandlerId: byValue.get('modmail_handler') ?? null,
  };
};

export const ensureSettingsSeeded = async (): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.Database);
  const db = getDb();

  const [existing] = await db.select().from(settings).where(eq(settings.id, SINGLETON_ID)).limit(1);
  if (existing) {
    const roleIds = await fetchRoleIds();
    cache = { ...existing, ...roleIds };
    logger.info('Settings row present.');
    return;
  }

  const [inserted] = await db.insert(settings).values({ id: SINGLETON_ID }).returning();
  const roleIds = await fetchRoleIds();
  cache = { ...inserted, ...roleIds };
  logger.info('Seeded singleton settings row with defaults.');
};

export const getSettings = async (): Promise<Settings> => {
  if (cache) return cache;

  const db = getDb();
  const [row] = await db.select().from(settings).where(eq(settings.id, SINGLETON_ID)).limit(1);

  if (!row) {
    Logger.getInstance(AppFeature.Database).fatal('Settings row missing. Did ensureSettingsSeeded() run?');
    process.exit(ProcessExitCode.CONFIG);
  }

  const roleIds = await fetchRoleIds();
  cache = { ...row, ...roleIds };
  return cache;
};

export const updateSettings = async (patch: Partial<Omit<DbSettings, 'id'>>): Promise<Settings> => {
  const db = getDb();
  const [row] = await db.update(settings).set(patch).where(eq(settings.id, SINGLETON_ID)).returning();
  const roleIds = await fetchRoleIds();
  cache = { ...row, ...roleIds };
  return cache;
};

export const invalidateSettingsCache = (): void => {
  cache = null;
};
