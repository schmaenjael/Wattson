import { EmbedBuilder, Locale } from 'discord.js';

import { L } from '~/core/locales';
import { getEuropeanLanguageOptions, getVerificationCountryOptions, getWorldLanguageOptions, listRules } from '~/database';

import { Flow } from './flow';

const formatCategory = (cat: string) => cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const buildRulePages = (rules: Awaited<ReturnType<typeof listRules>>, color: `#${string}`): EmbedBuilder[] => {
  const grouped = new Map<string, typeof rules>();
  for (const rule of rules) {
    const existing = grouped.get(rule.category) ?? [];
    existing.push(rule);
    grouped.set(rule.category, existing);
  }

  return Array.from(grouped.entries()).map(([category, categoryRules]) => {
    const embed = new EmbedBuilder().setColor(color).setTitle(`📜 ${formatCategory(category)}`);
    const sorted = categoryRules.sort((a, b) => a.categoryIndex - b.categoryIndex);
    for (const rule of sorted) {
      embed.addFields({ name: rule.title, value: `${rule.content}${rule.example ? `\n-# ⇒ ${rule.example}` : ''}` });
    }
    return embed;
  });
};

export const buildVerificationFlow = async (locale: Locale, color: `#${string}`) => {
  const Q = L[locale].SYSTEM.VERIFICATION.QUESTIONS;
  const [countryOptions, euLangOptions, worldLangOptions, rules] = await Promise.all([
    getVerificationCountryOptions(),
    getEuropeanLanguageOptions(),
    getWorldLanguageOptions(),
    listRules(),
  ]);

  const rulePages = buildRulePages(rules, color);

  return new Flow()
    .step({ kind: 'captcha', key: 'captcha', prompt: () => ({ title: Q.CAPTCHA.TITLE(), description: Q.CAPTCHA.DESCRIPTION() }) })
    .step({
      kind: 'text',
      key: 'icebreaker',
      prompt: () => ({ title: Q.QUESTION_ICEBREAKER.TITLE(), description: Q.QUESTION_ICEBREAKER.DESCRIPTION() }),
    })
    .step({
      kind: 'choice',
      key: 'home_country',
      prompt: () => ({ title: Q.QUESTION_HOME_COUNTRY.TITLE(), description: Q.QUESTION_HOME_COUNTRY.DESCRIPTION() }),
      multi: true,
      categorization: true,
      options: countryOptions,
    })
    .step({
      kind: 'choice',
      key: 'pronouns',
      prompt: () => ({ title: Q.QUESTION_PRONOUNS.TITLE(), description: Q.QUESTION_PRONOUNS.DESCRIPTION() }),
      multi: true,
      options: [
        { label: 'she/her', value: 'she' },
        { label: 'he/him', value: 'he' },
        { label: 'they/them', value: 'they' },
        { label: 'any', value: 'any' },
        { label: 'ask me', value: 'ask' },
      ],
    })
    .step({
      kind: 'choice',
      key: 'spoken_languages_eu',
      prompt: () => ({ title: Q.QUESTION_LANGUAGES_EU.TITLE(), description: Q.QUESTION_LANGUAGES_EU.DESCRIPTION() }),
      multi: true,
      options: euLangOptions,
    })
    .step({
      kind: 'choice',
      key: 'spoken_languages_other',
      prompt: () => ({ title: Q.QUESTION_LANGUAGES_OTHER.TITLE(), description: Q.QUESTION_LANGUAGES_OTHER.DESCRIPTION() }),
      multi: true,
      min: 0,
      options: worldLangOptions,
    })
    .step({
      kind: 'text',
      key: 'discovery',
      prompt: () => ({ title: Q.QUESTION_DISCOVERY.TITLE(), description: Q.QUESTION_DISCOVERY.DESCRIPTION() }),
    })
    .step({
      kind: 'paginated-confirm',
      key: 'rule_acceptance',
      pages: rulePages,
      prompt: () => ({ title: Q.QUESTION_RULE_ACCEPTANCE.TITLE(), description: Q.QUESTION_RULE_ACCEPTANCE.DESCRIPTION() }),
    })
    .build();
};
