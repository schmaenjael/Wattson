import { Locale } from 'discord.js';
import type { BaseTranslation, Translations } from './i18n-types.js';
import { loadedLocales } from './i18n-util.js';

import de from './de/index.js';
import en from './en/index.js';

const localeTranslations: Partial<{ [key in Locale]: BaseTranslation }> = { [Locale.EnglishGB]: en, [Locale.EnglishUS]: en, [Locale.German]: de };

export const loadLocale = (locale: Locale): void => {
  if (loadedLocales[locale]) return;
  else loadedLocales[locale] = localeTranslations[locale] as unknown as Translations;
};

export const loadAllLocales = (): void => Object.keys(localeTranslations).forEach((k) => loadLocale(k as Locale));
