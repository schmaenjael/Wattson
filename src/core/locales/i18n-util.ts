import { i18n as initI18n, i18nObject as initI18nObject, i18nString as initI18nString } from 'typesafe-i18n';
import type { LocaleTranslationFunctions, TranslateByString } from 'typesafe-i18n';
import { initExtendDictionary } from 'typesafe-i18n/utils';
import { Locale } from 'discord.js';

import type { Formatters, Translations, TranslationFunctions } from './i18n-types.js';

export const baseLocale: Locale = Locale.EnglishGB;
export const loadedLocales: Record<Locale, Translations> = {} as Record<Locale, Translations>;
export const loadedFormatters: Record<Locale, Formatters> = {} as Record<Locale, Formatters>;
export const extendDictionary = initExtendDictionary<Translations>();

export const locales = [Locale.EnglishGB, Locale.EnglishUS, Locale.German];

export const i18nString = (locale: Locale): TranslateByString => initI18nString<Locale, Formatters>(locale, loadedFormatters[locale]);
export const i18nObject = (locale: Locale): TranslationFunctions =>
  initI18nObject<Locale, Translations, TranslationFunctions, Formatters>(locale, loadedLocales[locale], loadedFormatters[locale]);
export const i18n = (): LocaleTranslationFunctions<Locale, Translations, TranslationFunctions> =>
  initI18n<Locale, Translations, TranslationFunctions, Formatters>(loadedLocales, loadedFormatters);
