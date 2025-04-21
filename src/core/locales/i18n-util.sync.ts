import type { Locales, Translations } from './i18n-types.js';
import { loadedLocales, localeValues } from './i18n-util.js';

import de from './de/index.js';
import en from './en/index.js';

const localeTranslations = { de, en };

export const loadLocale = (locale: Locales): void => {
  if (loadedLocales[locale]) return;

  loadedLocales[locale] = localeTranslations[locale] as unknown as Translations;
};

export const loadAllLocales = (): void => localeValues.forEach(loadLocale);
