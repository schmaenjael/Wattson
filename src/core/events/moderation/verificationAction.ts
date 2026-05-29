import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  type PublicThreadChannel,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import {
  AuditEventType,
  findOpenModmailByUserId,
  getSettings,
  ModmailCategory,
  ModmailStatus,
  openModmail,
  recordAuditEvent,
  upsertUser,
} from '~/database';
import { CloseActionType, type VerificationFollowUpPayload } from '~/core/providers/modmail/closeActions';
import { buildModmailOpenThreadEmbed, buildVerificationFollowUpUserDmEmbed } from '~/core/components/Modmail';
import { L } from '~/core/locales';
import type { FlowAnswers } from '~/core/providers/verification/flow';
import { ANSWER_DISPLAY_NAMES, grantAccess, postWelcomeEmbed } from '~/core/providers/verification/actions';

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
      result[key] = CODE_KEYS.has(key) ? items.map((c) => extractCode(c).toLowerCase()) : items;
    } else {
      result[key] = CODE_KEYS.has(key) ? extractCode(field.value).toLowerCase() : field.value;
    }
  }
  return result;
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

    // Compute synchronously — no async before first interaction response.
    const embed = interaction.message.embeds[0];
    const isDecided = embed?.title?.startsWith('✅') || embed?.title?.startsWith('❌');

    // reject must respond with showModal as the sole initial response.
    if (action === 'reject') {
      if (isDecided) {
        await interaction.reply({ content: 'This verification has already been decided.', flags: MessageFlags.Ephemeral });
        return;
      }
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

    // ask_question must deferReply before any async work.
    if (action === 'ask_question') {
      if (isDecided) {
        await interaction.reply({ content: 'This verification has already been decided.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const aqSettings = await getSettings();
      const aqActor = await interaction.guild?.members.fetch(interaction.user.id);
      const aqIsModerator =
        aqActor?.permissions.has(PermissionFlagsBits.ManageGuild) ||
        (aqSettings.roleModerationId ? aqActor?.roles.cache.has(aqSettings.roleModerationId) : false) ||
        (aqSettings.roleAdministrationId ? aqActor?.roles.cache.has(aqSettings.roleAdministrationId) : false);
      if (!aqIsModerator) {
        await interaction.editReply({ content: 'Only moderators can act on verification requests.' });
        return;
      }

      const existing = await findOpenModmailByUserId(memberId);
      if (existing) {
        await interaction.editReply({ content: `<@${memberId}> already has an open modmail thread <#${existing.threadId}>. Close it first.` });
        return;
      }

      const modmailSettings = await getSettings();
      if (!modmailSettings.modmailChannelId) {
        await interaction.editReply({ content: 'Modmail channel not configured. Set it with `/config channel`.' });
        return;
      }

      const applicant = await interaction.guild?.members.fetch(memberId).catch(() => null);
      if (!applicant) {
        await interaction.editReply({ content: `<@${memberId}> is no longer in the server.` });
        return;
      }

      const modmailChannel = (await interaction.guild?.channels.fetch(modmailSettings.modmailChannelId).catch(() => null)) as TextChannel | null;
      if (!modmailChannel) {
        await interaction.editReply({ content: 'Modmail channel not found.' });
        return;
      }

      const thread = (await modmailChannel.threads.create({
        name: `📬 Modmail — ${applicant.user.username}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PublicThread,
        reason: `Verification follow-up for ${applicant.user.username} (${applicant.id})`,
      })) as PublicThreadChannel;

      await upsertUser({ id: applicant.id, username: applicant.user.username });

      const closePayload: VerificationFollowUpPayload = { memberId, channelId: interaction.channelId, messageId: interaction.message.id };

      const modmail = await openModmail({
        userId: applicant.id,
        threadId: thread.id,
        category: ModmailCategory.VerificationFollowUp,
        reason: 'Verification follow-up — opened by moderation team',
        status: ModmailStatus.Open,
        closeAction: { type: CloseActionType.VerificationFollowUp, payload: closePayload as unknown as Record<string, unknown> },
      });

      await thread.setName(`📬 Modmail #${modmail.id} — ${applicant.user.username}`).catch(() => null);

      const pingContent = modmailSettings.roleModmailHandlerId ? `<@&${modmailSettings.roleModmailHandlerId}>` : undefined;
      await thread.send({ content: pingContent, embeds: [buildModmailOpenThreadEmbed(modmail, applicant.user)] });

      const dmChannel = await applicant.createDM().catch(() => null);
      await dmChannel?.send({ embeds: [buildVerificationFollowUpUserDmEmbed(modmail)] }).catch(() => null);

      await recordAuditEvent({
        eventType: AuditEventType.ModmailOpened,
        actorUserId: interaction.user.id,
        targetUserId: applicant.id,
        payload: { modmailId: modmail.id, category: ModmailCategory.VerificationFollowUp, threadId: thread.id },
      });

      const updatedEmbed = EmbedBuilder.from(embed).addFields({
        name: '📬 Verification Follow-up',
        value: `Modmail #${modmail.id} opened by <@${interaction.user.id}> · <#${thread.id}>`,
        inline: false,
      });
      await interaction.message.edit({ embeds: [updatedEmbed], components: interaction.message.components });

      await interaction.editReply({ content: `✅ Verification follow-up modmail #${modmail.id} opened with <@${memberId}>.` });
      return;
    }

    // Defer immediately — getSettings + members.fetch must not block the 3 s Discord window.
    await interaction.deferUpdate();

    const settings = await getSettings();
    const actor = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    const isModerator =
      actor?.permissions.has(PermissionFlagsBits.ManageGuild) ||
      (settings.roleModerationId ? actor?.roles.cache.has(settings.roleModerationId) : false) ||
      (settings.roleAdministrationId ? actor?.roles.cache.has(settings.roleAdministrationId) : false);

    if (!isModerator) {
      await interaction.followUp({ content: 'Only moderators can act on verification requests.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (action === 'approve' && isDecided) {
      await interaction.followUp({ content: 'This verification has already been decided.', flags: MessageFlags.Ephemeral });
      return;
    }

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
      await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

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
    }
  },
});
