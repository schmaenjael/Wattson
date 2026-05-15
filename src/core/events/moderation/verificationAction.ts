import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
} from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { L } from '~/core/locales';
import type { FlowAnswers } from '~/core/providers/verification/flow';
import { ANSWER_DISPLAY_NAMES, assignVolterRoles, grantAccess, postWelcomeEmbed } from '~/core/providers/verification/actions';

const STATIC_FIELDS = new Set(['User', 'Account created', 'Joined server']);
const MULTI_SELECT_KEYS = new Set(['home_country', 'pronouns', 'spoken_languages_eu', 'spoken_languages_other']);
const CODE_KEYS = new Set(['home_country', 'pronouns', 'spoken_languages_eu', 'spoken_languages_other', 'chapter_country']);

const REVERSE_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(Object.entries(ANSWER_DISPLAY_NAMES).map(([k, v]) => [v, k]));

const extractCode = (val: string): string => {
  const m = val.match(/\(([^)]+)\)$/);
  return m ? m[1] : val;
};

const answersFromEmbed = (embed: { fields: { name: string; value: string }[] }): FlowAnswers => {
  const result: FlowAnswers = {};
  for (const field of embed.fields) {
    if (STATIC_FIELDS.has(field.name)) continue;
    const key = REVERSE_DISPLAY_NAMES[field.name] ?? field.name;
    if (MULTI_SELECT_KEYS.has(key)) {
      const items = field.value.split(', ').filter(Boolean);
      result[key] = CODE_KEYS.has(key) ? items.map(extractCode) : items;
    } else {
      result[key] = CODE_KEYS.has(key) ? extractCode(field.value) : field.value;
    }
  }
  return result;
};

const getAnswerField = (embed: { fields: { name: string; value: string }[] }, key: string): string => {
  const displayName = ANSWER_DISPLAY_NAMES[key] ?? key;
  return embed.fields.find((f) => f.name === displayName || f.name === key)?.value ?? '';
};

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.Welcome,
  middleware: [],
  async executeCommand(_event, client, interaction) {
    // Handle rejection reason modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('verify:reject_reason:')) {
      const parts = interaction.customId.split(':');
      const memberId = parts[2];
      const channelId = parts[3];
      const messageId = parts[4];
      const reason = interaction.fields.getTextInputValue('reason');

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const approvalChannel = await client.channels.fetch(channelId).catch(() => null);
      const approvalMessage = approvalChannel?.isTextBased()
        ? await (approvalChannel as TextChannel).messages.fetch(messageId).catch(() => null)
        : null;

      if (approvalMessage) {
        const existingEmbed = approvalMessage.embeds[0];
        const isAlreadyDecided = existingEmbed?.title?.startsWith('✅') || existingEmbed?.title?.startsWith('❌');
        if (isAlreadyDecided) {
          await interaction.editReply({ content: 'This verification has already been decided.' });
          return;
        }
        const updatedEmbed = EmbedBuilder.from(existingEmbed)
          .setTitle(`❌ Rejected by ${interaction.user.tag}`)
          .addFields({ name: '🚫 Reason', value: reason.slice(0, 1024) });
        await approvalMessage.edit({ embeds: [updatedEmbed], components: [] });
      }

      await recordAuditEvent({
        eventType: AuditEventType.VerificationRejected,
        actorUserId: interaction.user.id,
        targetUserId: memberId,
        payload: { reason },
      });

      const member = await interaction.guild?.members.fetch(memberId).catch(() => null);
      const locale = interaction.guild?.preferredLocale ?? 'en-US';
      const color = appFeatureMap[AppFeature.Welcome].color;

      if (member) {
        const dm = await member.createDM().catch(() => null);
        if (dm) {
          await dm
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor(color)
                  .setTitle(L[locale].SYSTEM.VERIFICATION.DENIED.EMBED_TITLE())
                  .setDescription(`${L[locale].SYSTEM.VERIFICATION.DENIED.EMBED_DESCRIPTION()}\n\n**${reason}**`),
              ],
            })
            .catch(() => null);
        }
        await member.kick(`Verification rejected: ${reason.slice(0, 200)}`).catch(() => null);
      }

      await interaction.editReply({ content: '✅ Rejection processed.' });
      return;
    }

    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('verify:')) return;

    const parts = interaction.customId.split(':');
    const action = parts[1];
    const memberId = parts[2];
    if (!action || !memberId) return;

    const settings = await getSettings();
    const actor = await interaction.guild?.members.fetch(interaction.user.id);
    const isModerator =
      actor?.permissions.has(PermissionFlagsBits.ManageGuild) ||
      (settings.roleModerationId ? actor?.roles.cache.has(settings.roleModerationId) : false) ||
      (settings.roleAdministrationId ? actor?.roles.cache.has(settings.roleAdministrationId) : false);

    if (!isModerator) {
      await interaction.reply({ content: 'Only moderators can act on verification requests.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = interaction.message.embeds[0];
    const isDecided = embed?.title?.startsWith('✅') || embed?.title?.startsWith('❌');

    if ((action === 'approve' || action === 'reject') && isDecided) {
      await interaction.reply({ content: 'This verification has already been decided.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'volter' && embed?.footer?.text.includes('Volter')) {
      await interaction.reply({ content: 'Volter roles have already been assigned.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'reject') {
      const modal = new ModalBuilder()
        .setCustomId(`verify:reject_reason:${memberId}:${interaction.channelId}:${interaction.message.id}`)
        .setTitle('Rejection Reason')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Reason for rejecting this verification')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Provide a clear reason visible to the applicant...')
              .setMinLength(10)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    await interaction.deferUpdate();

    const member = await interaction.guild?.members.fetch(memberId).catch(() => null);
    const locale = interaction.guild?.preferredLocale ?? 'en-US';
    const color = appFeatureMap[AppFeature.Welcome].color;
    const updatedEmbed = EmbedBuilder.from(embed);

    if (action === 'approve') {
      if (!member) {
        await interaction.followUp({ content: `Member <@${memberId}> is no longer in the server.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await grantAccess(member, answersFromEmbed(embed));
      await postWelcomeEmbed(client, member);
      await recordAuditEvent({ eventType: AuditEventType.VerificationCompleted, actorUserId: interaction.user.id, targetUserId: memberId });

      updatedEmbed.setTitle(`✅ Approved by ${interaction.user.tag}`);

      const isMemberApplicant = getAnswerField(embed, 'is_member') === 'yes' && getAnswerField(embed, 'chapter_country').length > 0;
      const volterAlreadyAssigned = !!embed?.footer?.text.includes('Volter');
      const showVolterButton = isMemberApplicant && !!settings.roleVolterId && !volterAlreadyAssigned;

      const components = showVolterButton
        ? [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`verify:volter:${memberId}`).setLabel('Assign Volter + Chapter Role').setStyle(ButtonStyle.Primary)
            ),
          ]
        : [];

      await interaction.message.edit({ embeds: [updatedEmbed], components });

      const dm = await member.createDM().catch(() => null);
      if (dm) {
        await dm
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor(color)
                .setTitle(L[locale].SYSTEM.VERIFICATION.ACCEPTED.EMBED_TITLE())
                .setDescription(L[locale].SYSTEM.VERIFICATION.ACCEPTED.EMBED_DESCRIPTION()),
            ],
          })
          .catch(() => null);
      }
    } else if (action === 'volter') {
      if (member) {
        await assignVolterRoles(member, answersFromEmbed(embed), settings);
      }

      updatedEmbed.setFooter({ text: `🟣 Volter + chapter role assigned by ${interaction.user.tag}` });

      if (isDecided) {
        await interaction.message.edit({ embeds: [updatedEmbed], components: [] });
      } else {
        const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`verify:approve:${memberId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`verify:reject:${memberId}`).setLabel('Reject & Kick').setStyle(ButtonStyle.Danger)
        );
        await interaction.message.edit({ embeds: [updatedEmbed], components: [approvalRow] });
      }
    }
  },
});
