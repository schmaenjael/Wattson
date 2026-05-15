import { eq, type InferSelectModel } from 'drizzle-orm';

import { AppFeature, ProcessExitCode } from '~/settings';
import { Logger } from '~/utilities';

import { getDb } from './client';
import { settings } from './schema/settings';

export type Settings = InferSelectModel<typeof settings>;

const SINGLETON_ID = 1;
let cache: Settings | null = null;

export const ensureSettingsSeeded = async (): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.Database);
  const db = getDb();

  const [existing] = await db.select().from(settings).where(eq(settings.id, SINGLETON_ID)).limit(1);
  if (existing) {
    cache = existing;
    logger.info('Settings row present.');
    return;
  }

  const [inserted] = await db.insert(settings).values({ id: SINGLETON_ID }).returning();
  cache = inserted;
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

  cache = row;
  return row;
};

export const updateSettings = async (patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> => {
  const db = getDb();
  const [row] = await db.update(settings).set(patch).where(eq(settings.id, SINGLETON_ID)).returning();
  cache = row;
  return row;
};

export const invalidateSettingsCache = (): void => {
  cache = null;
};
