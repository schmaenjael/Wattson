import { ActionRowBuilder, EmbedBuilder, GuildMember, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

import { Client } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { getSettings, getRoleMappingsForAnswers, RoleMappingType } from '~/database';
import type { ChoiceOption, FlowAnswer, FlowAnswers, Step } from './flow';

const toStringArray = (answer: FlowAnswer | undefined): string[] => {
  if (!answer) return [];
  return Array.isArray(answer) ? answer : [answer];
};

export const ANSWER_DISPLAY_NAMES: Record<string, string> = {
  icebreaker: '🗣️ Icebreaker',
  home_country: '🌍 Home Country / Region',
  pronouns: '💬 Pronouns',
  spoken_languages_eu: '🇪🇺 European Languages',
  spoken_languages_other: '🌐 Other Languages',
  discovery: '🔍 How They Found Us',
  is_member: '🟣 Volt Member?',
  haiilo: '📋 Haiilo Profile',
  chapter_country: '🏛️ Volt Chapter',
  rule_acceptance: '📜 Rules Accepted',
};

const PRONOUN_LABELS: Record<string, string> = { she: 'she/her', he: 'he/him', they: 'they/them', any: 'any', ask: 'ask me' };

const withCode = (label: string | undefined, code: string): string => (label && label !== code ? `${label} (${code})` : code);

export const buildApprovalAnswerFields = (
  answers: FlowAnswers,
  countryLabelMap: Map<string, string>,
  languageLabelMap: Map<string, string>
): { name: string; value: string; inline: boolean }[] =>
  Object.entries(answers).map(([key, raw]) => {
    const name = ANSWER_DISPLAY_NAMES[key] ?? key;
    let value: string;

    if (key === 'home_country') {
      const codes = Array.isArray(raw) ? raw : [raw];
      value = codes.map((c) => withCode(countryLabelMap.get(c), c)).join(', ') || '—';
    } else if (key === 'spoken_languages_eu' || key === 'spoken_languages_other') {
      const codes = Array.isArray(raw) ? raw : [raw];
      value = codes.map((c) => withCode(languageLabelMap.get(c), c)).join(', ') || '—';
    } else if (key === 'pronouns') {
      const codes = Array.isArray(raw) ? raw : [raw];
      value = codes.map((c) => withCode(PRONOUN_LABELS[c], c)).join(', ') || '—';
    } else if (key === 'chapter_country') {
      const code = typeof raw === 'string' ? raw : '';
      value = withCode(countryLabelMap.get(code), code) || '—';
    } else {
      value = Array.isArray(raw) ? raw.join(', ') : raw;
    }

    return { name, value: value.slice(0, 1024), inline: false };
  });

export const grantAccess = async (member: GuildMember, answers: FlowAnswers): Promise<void> => {
  const settings = await getSettings();
  if (settings.roleCommunityId) {
    await member.roles.add(settings.roleCommunityId, 'Verification passed').catch(() => null);
  }
  if (settings.roleObscrId && member.roles.cache.has(settings.roleObscrId)) {
    await member.roles.remove(settings.roleObscrId, 'Verification passed').catch(() => null);
  }

  const countryValues = toStringArray(answers['home_country']);
  const pronounValues = toStringArray(answers['pronouns']);
  const langValues = [...toStringArray(answers['spoken_languages_eu']), ...toStringArray(answers['spoken_languages_other'])];

  const [countryRoles, pronounsRoles, langRoles] = await Promise.all([
    getRoleMappingsForAnswers(RoleMappingType.Country, countryValues),
    getRoleMappingsForAnswers(RoleMappingType.Pronouns, pronounValues),
    getRoleMappingsForAnswers(RoleMappingType.Language, langValues),
  ]);

  for (const mapping of [...countryRoles, ...pronounsRoles, ...langRoles]) {
    await member.roles.add(mapping.roleId, 'Verification role mapping').catch(() => null);
  }
};

export const assignVolterRoles = async (
  member: GuildMember,
  answers: FlowAnswers,
  settings: Awaited<ReturnType<typeof getSettings>>
): Promise<void> => {
  if (settings.roleVolterId) {
    await member.roles.add(settings.roleVolterId, 'Volt member verified').catch(() => null);
  }
  const chapterCountry = typeof answers['chapter_country'] === 'string' ? answers['chapter_country'] : '';
  if (chapterCountry) {
    const chapterRoles = await getRoleMappingsForAnswers(RoleMappingType.Country, [chapterCountry]);
    for (const mapping of chapterRoles) {
      await member.roles.add(mapping.roleId, 'Volt chapter role').catch(() => null);
    }
  }
};

export const postWelcomeEmbed = async (client: Client, member: GuildMember): Promise<void> => {
  const settings = await getSettings();
  if (!settings.welcomeChannelId) return;

  const welcomeChannel = await client.channels.fetch(settings.welcomeChannelId).catch(() => null);
  if (!welcomeChannel?.isSendable()) return;

  const createdAt = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
  const joinedAt = `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>`;

  try {
    await welcomeChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(appFeatureMap[AppFeature.Welcome].color)
          .setTitle('👋 Welcome!')
          .setThumbnail(member.user.displayAvatarURL({ size: 2048 }))
          .addFields(
            { name: '👤 User', value: `<@${member.id}>`, inline: true },
            { name: '👤 Username', value: `\`${member.user.tag}\``, inline: true },
            { name: '📆 Account Created', value: createdAt, inline: true },
            { name: '🔗 Join Date', value: joinedAt, inline: true }
          )
          .setTimestamp(),
      ],
    });
  } catch {
    /* best-effort */
  }
};

export const createChoiceMenu = (
  step: Extract<Step, { kind: 'choice' }>,
  options: ChoiceOption[],
  i: number = 0,
  placeholder?: string
): ActionRowBuilder<StringSelectMenuBuilder> => {
  const customId = `flow:${step.key}:${i}`;
  const MAX_OPTIONS = 25;

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder ?? 'Select…')
    .setMinValues(step.multi ? 0 : (step.min ?? 1))
    .setMaxValues(step.multi ? Math.min(step.max ?? options.length, MAX_OPTIONS) : 1)
    .addOptions(
      options.map(({ label, value, description }) => {
        const opt = new StringSelectMenuOptionBuilder().setLabel(label).setValue(value);
        if (description) {
          opt.setDescription(description);
        }
        return opt;
      })
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
};
