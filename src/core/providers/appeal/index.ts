import { ButtonInteraction, EmbedBuilder, MessageFlags, ModalSubmitInteraction, TextChannel } from 'discord.js';

import { Colors } from '~/settings';
import { Client } from '~/core/models';
import {
  addAppealVote,
  AppealOutcome,
  AuditEventType,
  countAppealVotes,
  findAppealByBanId,
  findAppealById,
  findBanById,
  getSettings,
  hasVotedAppeal,
  insertAppeal,
  liftBan,
  ModerationStatus,
  recordAuditEvent,
  setAppealOutcome,
  upsertUser,
} from '~/database';
import { L, baseLocale } from '~/core/locales';
import { AppealEmbed, buildAppealVoteRow } from '~/core/components/Appeal';

const T = L[baseLocale].MODERATION.APPEAL;

type ButtonHandler = (client: Client, interaction: ButtonInteraction) => Promise<void>;
type ModalHandler = (client: Client, interaction: ModalSubmitInteraction) => Promise<void>;

const handleSubmit: ModalHandler = async (client, interaction) => {
  const banId = parseInt(interaction.customId.split(':')[2] ?? '', 10);
  if (isNaN(banId)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const ban = await findBanById(banId);
  const existingAppeal = ban ? await findAppealByBanId(banId) : null;

  if (!ban || ban.status !== ModerationStatus.Active || !ban.appealable || existingAppeal) {
    await interaction.editReply({ content: T.SUBMIT_INVALID() });
    return;
  }

  const email = interaction.fields.getTextInputValue('email');
  const reason = interaction.fields.getTextInputValue('reason');
  const other = interaction.fields.getTextInputValue('other') || null;

  const settings = await getSettings();
  if (!settings.appealChannelId) {
    await interaction.editReply({ content: T.NOT_CONFIGURED() });
    return;
  }

  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
  const appealChannel = guild ? await guild.channels.fetch(settings.appealChannelId).catch(() => null) : null;

  if (!appealChannel?.isTextBased()) {
    await interaction.editReply({ content: T.CHANNEL_UNAVAILABLE() });
    return;
  }

  const appeal = await insertAppeal(banId);
  const user = interaction.user;
  const threshold = settings.appealVoteThreshold;

  const embed = new AppealEmbed({
    userId: user.id,
    accountCreatedTs: user.createdTimestamp,
    avatarUrl: user.displayAvatarURL(),
    email,
    reason,
    other,
    banReason: ban.reason,
    banCreatedAt: ban.createdAt,
    appealId: appeal.id,
    voteCount: 0,
    threshold,
  }).render();

  await (appealChannel as TextChannel).send({ embeds: [embed], components: [buildAppealVoteRow(appeal.id, 0, threshold)] });

  await recordAuditEvent({
    eventType: AuditEventType.BanAppealFiled,
    actorUserId: user.id,
    targetUserId: user.id,
    payload: { banId: ban.id, appealId: appeal.id },
  });

  await interaction.editReply({ content: T.SUBMITTED() });
};

const handleApprove = async (client: Client, interaction: ButtonInteraction, appealId: number): Promise<void> => {
  const settings = await getSettings();
  const appeal = await findAppealById(appealId);
  if (!appeal) {
    await interaction.reply({ content: T.RECORD_NOT_FOUND(), flags: MessageFlags.Ephemeral });
    return;
  }
  if (appeal.outcome) {
    await interaction.reply({ content: T.ALREADY_RESOLVED(), flags: MessageFlags.Ephemeral });
    return;
  }
  const ban = await findBanById(appeal.banId);
  if (!ban) {
    await interaction.reply({ content: T.BAN_NOT_FOUND(), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await upsertUser({ id: interaction.user.id, username: interaction.user.username });

  if (await hasVotedAppeal(appealId, interaction.user.id)) {
    await interaction.editReply({ content: T.ALREADY_VOTED() });
    return;
  }

  await addAppealVote(appealId, interaction.user.id);
  const voteCount = await countAppealVotes(appealId);
  const threshold = settings.appealVoteThreshold;
  const originalEmbed = interaction.message.embeds[0];
  const voteFieldIndex = originalEmbed.fields.findIndex((f) => f.name === T.FIELD_APPROVALS());

  if (voteCount < threshold) {
    const updatedEmbed = EmbedBuilder.from(originalEmbed);
    if (voteFieldIndex >= 0) {
      updatedEmbed.spliceFields(voteFieldIndex, 1, { name: T.FIELD_APPROVALS(), value: `${voteCount}/${threshold}`, inline: true });
    }
    await interaction.message.edit({ embeds: [updatedEmbed], components: [buildAppealVoteRow(appealId, voteCount, threshold)] });
    await interaction.editReply({ content: T.VOTE_RECORDED({ voteCount, threshold }) });
    return;
  }

  const guild = interaction.guild!;
  if (ban.targetUserId) {
    await guild.bans.remove(ban.targetUserId, `Appeal #${appealId} granted — ${voteCount} moderator votes`).catch(() => null);
  }
  await liftBan(ban.id);
  await setAppealOutcome(appealId, AppealOutcome.Granted, interaction.user.id);

  await recordAuditEvent({
    eventType: AuditEventType.BanAppealResolved,
    actorUserId: interaction.user.id,
    targetUserId: ban.targetUserId ?? undefined,
    payload: { banId: ban.id, appealId, outcome: AppealOutcome.Granted, voteCount },
  });

  const resolvedEmbed = EmbedBuilder.from(originalEmbed).setColor(Colors.Green).setTitle(T.GRANTED_TITLE());
  if (voteFieldIndex >= 0) {
    resolvedEmbed.spliceFields(voteFieldIndex, 1, { name: T.FIELD_APPROVALS(), value: `${voteCount}/${threshold}`, inline: true });
  }
  resolvedEmbed.addFields({
    name: T.OUTCOME_GRANTED_LABEL(),
    value: T.OUTCOME_GRANTED_VALUE({ voteCount, userId: interaction.user.id }),
    inline: false,
  });
  await interaction.message.edit({ embeds: [resolvedEmbed], components: [] });

  if (ban.targetUserId) {
    const targetUser = await client.users.fetch(ban.targetUserId).catch(() => null);
    const dm = await targetUser?.createDM().catch(() => null);
    await dm
      ?.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle(T.DM_GRANTED_TITLE())
            .setDescription(T.DM_GRANTED_DESCRIPTION())
            .setFooter({ text: T.FOOTER({ appealId }) })
            .setTimestamp(),
        ],
      })
      .catch(() => null);
  }

  await interaction.editReply({ content: ban.targetUserId ? T.GRANTED_REPLY_UNBANNED({ userId: ban.targetUserId }) : T.GRANTED_REPLY() });
};

const handleDeny = async (client: Client, interaction: ButtonInteraction, appealId: number): Promise<void> => {
  const appeal = await findAppealById(appealId);
  if (!appeal) {
    await interaction.reply({ content: T.RECORD_NOT_FOUND(), flags: MessageFlags.Ephemeral });
    return;
  }
  if (appeal.outcome) {
    await interaction.reply({ content: T.ALREADY_RESOLVED(), flags: MessageFlags.Ephemeral });
    return;
  }
  const ban = await findBanById(appeal.banId);
  if (!ban) {
    await interaction.reply({ content: T.BAN_NOT_FOUND(), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await upsertUser({ id: interaction.user.id, username: interaction.user.username });

  await setAppealOutcome(appealId, AppealOutcome.Denied, interaction.user.id);

  await recordAuditEvent({
    eventType: AuditEventType.BanAppealResolved,
    actorUserId: interaction.user.id,
    targetUserId: ban.targetUserId ?? undefined,
    payload: { banId: ban.id, appealId, outcome: AppealOutcome.Denied },
  });

  const resolvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(Colors.Red)
    .setTitle(T.DENIED_TITLE())
    .addFields({ name: T.OUTCOME_DENIED_LABEL(), value: T.OUTCOME_DENIED_VALUE({ userId: interaction.user.id }), inline: false });
  await interaction.message.edit({ embeds: [resolvedEmbed], components: [] });

  if (ban.targetUserId) {
    const targetUser = await client.users.fetch(ban.targetUserId).catch(() => null);
    const dm = await targetUser?.createDM().catch(() => null);
    await dm
      ?.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(T.DM_DENIED_TITLE())
            .setDescription(T.DM_DENIED_DESCRIPTION())
            .setFooter({ text: T.FOOTER({ appealId }) })
            .setTimestamp(),
        ],
      })
      .catch(() => null);
  }

  await interaction.editReply({ content: ban.targetUserId ? T.DENIED_REPLY_REMAINS({ userId: ban.targetUserId }) : T.DENIED_REPLY() });
};

const BUTTON_ACTIONS: Record<string, (client: Client, interaction: ButtonInteraction, appealId: number) => Promise<void>> = {
  approve: handleApprove,
  deny: handleDeny,
};

export const handleAppealButton: ButtonHandler = async (client, interaction) => {
  const parts = interaction.customId.split(':');
  const appealId = parseInt(parts[2] ?? '', 10);
  if (isNaN(appealId)) return;
  await BUTTON_ACTIONS[parts[1]]?.(client, interaction, appealId);
};

export const handleAppealModal: ModalHandler = async (client, interaction) => {
  if (interaction.customId.split(':')[1] === 'submit') {
    await handleSubmit(client, interaction);
  }
};
