import { i18n as initI18n, i18nObject as initI18nObject, i18nString as initI18nString } from 'typesafe-i18n';
import type { LocaleTranslationFunctions, TranslateByString } from 'typesafe-i18n';
import { initExtendDictionary } from 'typesafe-i18n/utils';
import { Locale } from 'discord.js';

import type { Formatters, Locales, Translations, TranslationFunctions } from './i18n-types.js';

export const baseLocale: Locales = 'en';
export const loadedLocales: Record<Locales, Translations> = {} as Record<Locales, Translations>;
export const loadedFormatters: Record<Locales, Formatters> = {} as Record<Locales, Formatters>;
export const extendDictionary = initExtendDictionary<Translations>();

export const locales: { [key in Locale]?: Locales } = { [Locale.EnglishUS]: 'en', [Locale.EnglishGB]: 'en', [Locale.German]: 'de' };

export const localeKeys = new Set(Object.values(locales));
export const localeValues = new Set(Object.keys(locales)) as Set<Locales>;

export const detectLocale = (locale: Locale): Locales => locales[locale] || baseLocale;
export const isLocaleFromString = (locale: string): boolean => localeValues.has(locale);
export const isLocaleFromDiscordLocale = (locale: Locale): boolean => localeKeys.has(locale);
export const i18nString = (locale: Locales): TranslateByString => initI18nString<Locales, Formatters>(locale, loadedFormatters[locale]);
export const i18nObject = (locale: Locales): TranslationFunctions =>
  initI18nObject<Locales, Translations, TranslationFunctions, Formatters>(locale, loadedLocales[locale], loadedFormatters[locale]);
export const i18n = (): LocaleTranslationFunctions<Locales, Translations, TranslationFunctions> =>
  initI18n<Locales, Translations, TranslationFunctions, Formatters>(loadedLocales, loadedFormatters);
