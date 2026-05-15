import { asc, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { rules } from '../schema/rules';

export type Rule = InferSelectModel<typeof rules>;

export const listRules = async (): Promise<Rule[]> => {
  const db = getDb();
  return db.select().from(rules).orderBy(asc(rules.category), asc(rules.categoryIndex));
};
