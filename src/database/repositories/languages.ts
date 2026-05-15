import { and, asc, eq, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '../client';
import { languages } from '../schema/languages';
import { LanguageGroup } from '../schema/enums';

export type Language = InferSelectModel<typeof languages>;
export type LanguageOption = { label: string; value: string };

export const getEuropeanLanguageOptions = async (): Promise<LanguageOption[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(languages)
    .where(and(eq(languages.showInMenu, true), eq(languages.group, LanguageGroup.European)))
    .orderBy(asc(languages.sortOrder), asc(languages.name));
  return rows.map((r) => ({ label: r.name, value: r.code }));
};

export const getWorldLanguageOptions = async (): Promise<LanguageOption[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(languages)
    .where(and(eq(languages.showInMenu, true), eq(languages.group, LanguageGroup.World)))
    .orderBy(asc(languages.sortOrder), asc(languages.name));
  return rows.map((r) => ({ label: r.name, value: r.code }));
};

export const getLanguageLabelMap = async (): Promise<Map<string, string>> => {
  const [eu, world] = await Promise.all([getEuropeanLanguageOptions(), getWorldLanguageOptions()]);
  return new Map([...eu, ...world].map((o) => [o.value, o.label]));
};
