import { i18n } from './i18n-util.js';
import type { LocaleTranslationFunctions } from 'typesafe-i18n';
import type { Translations, TranslationFunctions } from './i18n-types.js';
import { Locale } from 'discord.js';

export const L: LocaleTranslationFunctions<Locale, Translations, TranslationFunctions> = i18n();

export default L;
