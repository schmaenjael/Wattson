import { ActionRowBuilder, EmbedBuilder, GuildMember, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

import { Client } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { getRoleMappingsForAnswers } from '~/config';
import { getSettings, RoleMappingType } from '~/database';
import type { ChoiceOption, FlowAnswer, FlowAnswers, Step } from './flow';
import { attempt, Logger, runDiscordAction, softFail } from '~/utilities';

const logger = Logger.getInstance(AppFeature.Welcome);

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
    } else {
      value = Array.isArray(raw) ? raw.join(', ') : raw;
    }

    return { name, value: value.slice(0, 1024), inline: false };
  });

/** Returns false when the access-granting role could not be applied — the member has no access despite "passing". */
export const grantAccess = async (member: GuildMember, answers: FlowAnswers): Promise<boolean> => {
  const settings = await getSettings();
  let granted = true;
  if (settings.roleCommunityId) {
    granted = await runDiscordAction(logger, 'member.roles.add', { userId: member.id, roleId: settings.roleCommunityId }, () =>
      member.roles.add(settings.roleCommunityId!, 'Verification passed')
    );
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
    await runDiscordAction(logger, 'member.roles.add', { userId: member.id, roleId: mapping.roleId }, () =>
      member.roles.add(mapping.roleId, 'Verification role mapping')
    );
  }

  return granted;
};

export const postWelcomeEmbed = async (client: Client, member: GuildMember): Promise<void> => {
  const settings = await getSettings();
  if (!settings.welcomeChannelId) return;

  const welcomeChannel = await client.channels
    .fetch(settings.welcomeChannelId)
    .catch(softFail(AppFeature.VolterVerification, 'VERIFICATION_CHANNEL_FETCH', { welcomeChannelId: settings.welcomeChannelId }));
  if (!welcomeChannel?.isSendable()) return;

  const createdAt = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
  const joinedAt = `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>`;

  await attempt(
    async () => {
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
    },
    { feature: AppFeature.Welcome, errorCode: 'WELCOME_MESSAGE_SEND', context: { memberId: member.id, welcomeChannelId: settings.welcomeChannelId } }
  );
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
