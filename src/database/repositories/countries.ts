import { and, eq, asc } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { countries } from '~/database/schema/countries';
import { Continents } from '~/database/schema/enums';
import { CategorizedChoiceOption, ChoiceOption } from '~/core/providers/verification';

export const getVerificationCountryOptions = async (): Promise<CategorizedChoiceOption[]> => {
  const db = getDb();
  const rows = await db.select().from(countries).where(eq(countries.enabled, true)).orderBy(asc(countries.name));

  const countryOptions = rows.map((r) => ({ label: r.name, category: r.region, value: r.code }));

  const regionOptions = Object.values(Continents).map((region) => ({ label: region, category: 'Regions', value: region }));

  return [...countryOptions, ...regionOptions];
};

export const getVoltChapters = async (): Promise<ChoiceOption[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(countries)
    .where(and(eq(countries.enabled, true), eq(countries.chapter, true)));

  const chapters = rows.map((r) => ({ label: r.name, value: r.code }));

  return [...chapters, { label: 'World', value: 'WW' }];
};

export const getCountryLabelMap = async (): Promise<Map<string, string>> => {
  const [all, chapters] = await Promise.all([getVerificationCountryOptions(), getVoltChapters()]);
  return new Map([...all, ...chapters].map((o) => [o.value, o.label]));
};
