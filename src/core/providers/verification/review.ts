import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  type PublicThreadChannel,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';

import { Client } from '~/core/models';
import { Permission } from '~/core/models/Permission';
import { memberHasAnyPermission } from '~/core/middleware/permissionCore';
import { AppFeature, appFeatureMap } from '~/settings';
import {
  AuditEventType,
  findOpenModmailByUserId,
  getLatestVerificationAnswers,
  getSettings,
  ModmailCategory,
  ModmailStatus,
  openModmail,
  recordAuditEvent,
  upsertUser,
} from '~/database';
import { CloseActionType, type VerificationFollowUpPayload } from '~/core/providers/modmail';
import { ModmailOpenThreadEmbed, VerificationFollowUpUserDmEmbed } from '~/core/components/Modmail';
import { L } from '~/core/locales';
import type { FlowAnswers } from './flow';
import { grantAccess, postWelcomeEmbed } from './actions';

const isModerator = async (interaction: ButtonInteraction): Promise<boolean> => {
  const settings = await getSettings();
  const actor = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  return actor ? memberHasAnyPermission(actor, settings, [Permission.Moderation, Permission.Administration]) : false;
};

const handleReject = async (interaction: ButtonInteraction, memberId: string, isDecided: boolean): Promise<void> => {
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
};

const handleAskQuestion = async (interaction: ButtonInteraction, memberId: string, isDecided: boolean): Promise<void> => {
  if (isDecided) {
    await interaction.reply({ content: 'This verification has already been decided.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await isModerator(interaction))) {
    await interaction.editReply({ content: 'Only moderators can act on verification requests.' });
    return;
  }

  const existing = await findOpenModmailByUserId(memberId);
  if (existing) {
    await interaction.editReply({ content: `<@${memberId}> already has an open modmail thread <#${existing.threadId}>. Close it first.` });
    return;
  }

  const settings = await getSettings();
  if (!settings.modmailChannelId) {
    await interaction.editReply({ content: 'Modmail channel not configured. Set it with `/config channel`.' });
    return;
  }

  const applicant = await interaction.guild?.members.fetch(memberId).catch(() => null);
  if (!applicant) {
    await interaction.editReply({ content: `<@${memberId}> is no longer in the server.` });
    return;
  }

  const modmailChannel = (await interaction.guild?.channels.fetch(settings.modmailChannelId).catch(() => null)) as TextChannel | null;
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

  const pingContent = settings.roleModmailHandlerId ? `<@&${settings.roleModmailHandlerId}>` : undefined;
  await thread.send({ content: pingContent, embeds: [new ModmailOpenThreadEmbed({ modmail, user: applicant.user }).render()] });

  const dmChannel = await applicant.createDM().catch(() => null);
  await dmChannel?.send({ embeds: [new VerificationFollowUpUserDmEmbed({ modmail }).render()] }).catch(() => null);

  await recordAuditEvent({
    eventType: AuditEventType.ModmailOpened,
    actorUserId: interaction.user.id,
    targetUserId: applicant.id,
    payload: { modmailId: modmail.id, category: ModmailCategory.VerificationFollowUp, threadId: thread.id },
  });

  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).addFields({
    name: '📬 Verification Follow-up',
    value: `Modmail #${modmail.id} opened by <@${interaction.user.id}> · <#${thread.id}>`,
    inline: false,
  });
  await interaction.message.edit({ embeds: [updatedEmbed], components: interaction.message.components });

  await interaction.editReply({ content: `✅ Verification follow-up modmail #${modmail.id} opened with <@${memberId}>.` });
};

const handleApprove = async (client: Client, interaction: ButtonInteraction, memberId: string, isDecided: boolean): Promise<void> => {
  await interaction.deferUpdate();

  if (!(await isModerator(interaction))) {
    await interaction.followUp({ content: 'Only moderators can act on verification requests.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (isDecided) {
    await interaction.followUp({ content: 'This verification has already been decided.', flags: MessageFlags.Ephemeral });
    return;
  }

  const embed = interaction.message.embeds[0];
  const member = await interaction.guild?.members.fetch(memberId).catch(() => null);
  if (!member) {
    await interaction.followUp({ content: `Member <@${memberId}> is no longer in the server.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const answers = await getLatestVerificationAnswers(memberId);
  if (!answers) {
    await interaction.followUp({
      content: `No recorded verification answers found for <@${memberId}>. Cannot grant access.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const locale = interaction.guild?.preferredLocale ?? 'en-US';
  const color = appFeatureMap[AppFeature.Welcome].color;

  await grantAccess(member, answers as FlowAnswers);
  await postWelcomeEmbed(client, member);
  await recordAuditEvent({ eventType: AuditEventType.VerificationCompleted, actorUserId: interaction.user.id, targetUserId: memberId });

  const updatedEmbed = EmbedBuilder.from(embed).setTitle(`✅ Approved by ${interaction.user.tag}`);
  await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

  const dm = await member.createDM().catch(() => null);
  await dm
    ?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(L[locale].SYSTEM.VERIFICATION.ACCEPTED.EMBED_TITLE())
          .setDescription(L[locale].SYSTEM.VERIFICATION.ACCEPTED.EMBED_DESCRIPTION()),
      ],
    })
    .catch(() => null);
};

export const handleVerifyButton = async (client: Client, interaction: ButtonInteraction): Promise<void> => {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const memberId = parts[2];
  if (!action || !memberId) return;

  const embed = interaction.message.embeds[0];
  const isDecided = Boolean(embed?.title?.startsWith('✅') || embed?.title?.startsWith('❌'));

  switch (action) {
    case 'reject':
      return handleReject(interaction, memberId, isDecided);
    case 'ask_question':
      return handleAskQuestion(interaction, memberId, isDecided);
    case 'approve':
      return handleApprove(client, interaction, memberId, isDecided);
    default:
      return;
  }
};

export const handleVerifyModal = async (client: Client, interaction: ModalSubmitInteraction): Promise<void> => {
  if (interaction.customId.split(':')[1] !== 'reject_reason') return;

  const parts = interaction.customId.split(':');
  const memberId = parts[2];
  const channelId = parts[3];
  const messageId = parts[4];
  const reason = interaction.fields.getTextInputValue('reason');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const approvalChannel = await client.channels.fetch(channelId).catch(() => null);
  const approvalMessage = approvalChannel?.isTextBased() ? await (approvalChannel as TextChannel).messages.fetch(messageId).catch(() => null) : null;

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
    await dm
      ?.send({
        embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setTitle(L[locale].SYSTEM.VERIFICATION.DENIED.EMBED_TITLE())
            .setDescription(`${L[locale].SYSTEM.VERIFICATION.DENIED.EMBED_DESCRIPTION()}\n\n**${reason}**`),
        ],
      })
      .catch(() => null);
    await member.kick(`Verification rejected: ${reason.slice(0, 200)}`).catch(() => null);
  }

  await interaction.editReply({ content: '✅ Rejection processed.' });
};
