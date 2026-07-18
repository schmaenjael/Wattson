import { Continents, LanguageGroup, RoleMappingType, RuleCategory, StatChannelType } from '~/database/schema/enums';
import type { CategorizedChoiceOption, ChoiceOption } from '~/core/providers/verification';

import { getConfig } from './loader';

export type LanguageOption = { label: string; value: string };
export type RoleMapping = { type: RoleMappingType; value: string; roleId: string };
export type StatChannel = { statType: StatChannelType; channelId: string };
export type ForumRoleMapping = { roleId: string; channelId: string };
export type Rule = { category: RuleCategory; categoryIndex: number; title: string; content: string; example: string | null };

const ruleCategoryOrder = Object.values(RuleCategory);

export const listRules = async (): Promise<Rule[]> => {
  const { rules } = getConfig();
  return [...rules]
    .sort((a, b) => ruleCategoryOrder.indexOf(a.category) - ruleCategoryOrder.indexOf(b.category) || a.categoryIndex - b.categoryIndex)
    .map((r) => ({ category: r.category, categoryIndex: r.categoryIndex, title: r.title, content: r.content, example: r.example ?? null }));
};

export const getVerificationCountryOptions = async (): Promise<CategorizedChoiceOption[]> => {
  const { catalog } = getConfig();
  const countryOptions = catalog.countries
    .filter((c) => c.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ label: c.name, category: c.region, value: c.code }));
  const regionOptions = Object.values(Continents).map((region) => ({ label: region, category: 'Regions', value: region }));
  return [...countryOptions, ...regionOptions];
};

export const getVoltChapters = async (): Promise<ChoiceOption[]> => {
  const { catalog } = getConfig();
  const chapters = catalog.countries.filter((c) => c.enabled && c.chapter).map((c) => ({ label: c.name, value: c.code }));
  return [...chapters, { label: 'World', value: 'WW' }];
};

export const getCountryLabelMap = async (): Promise<Map<string, string>> => {
  const [all, chapters] = await Promise.all([getVerificationCountryOptions(), getVoltChapters()]);
  return new Map([...all, ...chapters].map((o) => [o.value, o.label]));
};

const sortLanguages = (group: LanguageGroup): LanguageOption[] => {
  const { catalog } = getConfig();
  return catalog.languages
    .filter((l) => l.showInMenu && l.group === group)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((l) => ({ label: l.name, value: l.code }));
};

export const getEuropeanLanguageOptions = async (): Promise<LanguageOption[]> => sortLanguages(LanguageGroup.European);
export const getWorldLanguageOptions = async (): Promise<LanguageOption[]> => sortLanguages(LanguageGroup.World);

export const getLanguageLabelMap = async (): Promise<Map<string, string>> => {
  const [eu, world] = await Promise.all([getEuropeanLanguageOptions(), getWorldLanguageOptions()]);
  return new Map([...eu, ...world].map((o) => [o.value, o.label]));
};

export const getRoleMappingsForAnswers = async (type: RoleMappingType, values: string[]): Promise<RoleMapping[]> => {
  if (values.length === 0) {
    return [];
  }
  const { config } = getConfig();
  const wanted = new Set(values);
  const out: RoleMapping[] = [];
  const collect = (value: string, roleId: string | undefined) => {
    if (roleId && wanted.has(value)) {
      out.push({ type, value, roleId });
    }
  };
  if (type === RoleMappingType.Country) {
    for (const m of config.roles.countryMappings) {
      collect(m.code, m.roleId);
    }
  } else if (type === RoleMappingType.Language) {
    for (const m of config.roles.languageMappings) {
      collect(m.code, m.roleId);
    }
  } else if (type === RoleMappingType.Pronouns) {
    for (const p of config.pronouns) {
      collect(p.value, p.roleId);
    }
  }
  return out;
};

export const listStatChannels = async (): Promise<StatChannel[]> => {
  const { config } = getConfig();
  return Object.entries(config.statChannels)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([statType, channelId]) => ({ statType: statType as StatChannelType, channelId }));
};

export const listForumRoleMappings = async (channelId?: string): Promise<ForumRoleMapping[]> => {
  const { config } = getConfig();
  return channelId ? config.roles.forumMappings.filter((m) => m.channelId === channelId) : [...config.roles.forumMappings];
};

export const getForumRoleMappingsByRole = async (roleId: string): Promise<ForumRoleMapping[]> => {
  const { config } = getConfig();
  return config.roles.forumMappings.filter((m) => m.roleId === roleId);
};
