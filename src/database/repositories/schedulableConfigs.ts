import { InferSelectModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { schedulableConfigs } from '~/database/schema';

export type SchedulableConfig = InferSelectModel<typeof schedulableConfigs>;

export const getSchedulableConfig = async (name: string): Promise<SchedulableConfig | undefined> => {
  const db = getDb();
  const rows = await db.select().from(schedulableConfigs).where(eq(schedulableConfigs.name, name));
  return rows[0];
};

export const upsertSchedulableConfig = async (name: string, cronExpression: string): Promise<void> => {
  const db = getDb();
  await db
    .insert(schedulableConfigs)
    .values({ name, cronExpression })
    .onConflictDoUpdate({ target: schedulableConfigs.name, set: { cronExpression } });
};
