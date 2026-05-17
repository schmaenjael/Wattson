import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, MessageFlags, PermissionFlagsBits, TextChannel } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature, Colors } from '~/settings';
import {
  addAppealVote,
  AppealOutcome,
  AuditEventType,
  countAppealVotes,
  deactivateBan,
  findBanById,
  getSettings,
  hasVotedAppeal,
  recordAuditEvent,
  setAppealFiled,
  setAppealOutcome,
  upsertUser,
} from '~/database';

const buildAppealEmbed = (
  userId: string,
  accountCreatedTs: number,
  avatarUrl: string,
  email: string,
  reason: string,
  other: string | null,
  banReason: string,
  banCreatedAt: Date,
  banId: number,
  voteCount: number,
  threshold: number
): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle('📬 Ban Appeal')
    .setDescription(`<@${userId}> has submitted a ban appeal.`)
    .setThumbnail(avatarUrl)
    .addFields(
      { name: '👤 Appellant', value: `<@${userId}>\n\`${userId}\``, inline: true },
      { name: '📅 Account Created', value: `<t:${Math.floor(accountCreatedTs / 1000)}:D>`, inline: true },
      { name: '​', value: '​', inline: true },
      { name: '📧 E-Mail', value: email, inline: false },
      { name: '⚖️ Why I should be unbanned', value: reason.slice(0, 1024), inline: false }
    );

  if (other) {
    embed.addFields({ name: '💬 Additional Information', value: other.slice(0, 1024), inline: false });
  }

  embed.addFields(
    { name: '🔨 Original Ban Reason', value: banReason.slice(0, 1024), inline: false },
    { name: '🕐 Banned', value: `<t:${Math.floor(banCreatedAt.getTime() / 1000)}:R>`, inline: true },
    { name: '🗳️ Approvals', value: `${voteCount}/${threshold}`, inline: true }
  );

  return embed.setFooter({ text: `Ban #${banId}` }).setTimestamp();
};

const buildVoteRow = (banId: number, voteCount: number, threshold: number): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`appeal:approve:${banId}`).setLabel(`Approve (${voteCount}/${threshold})`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`appeal:deny:${banId}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
  );

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.Appeal,
  middleware: [],

  async executeCommand(_event, client, interaction) {
    // ── Modal submit ──────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('appeal:submit:')) {
      const banId = parseInt(interaction.customId.split(':')[2] ?? '', 10);
      if (isNaN(banId)) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const ban = await findBanById(banId);
      if (!ban || !ban.active || !ban.appealable || ban.appealedAt) {
        await interaction.editReply({ content: 'This appeal is no longer valid. Your ban may have already been resolved.' });
        return;
      }

      const email = interaction.fields.getTextInputValue('email');
      const reason = interaction.fields.getTextInputValue('reason');
      const other = interaction.fields.getTextInputValue('other') || null;

      const settings = await getSettings();
      if (!settings.appealChannelId) {
        await interaction.editReply({ content: 'The appeal system is not configured. Please contact the moderation team directly.' });
        return;
      }

      const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
      const appealChannel = guild ? await guild.channels.fetch(settings.appealChannelId).catch(() => null) : null;

      if (!appealChannel?.isTextBased()) {
        await interaction.editReply({ content: 'The appeal channel is unavailable. Please contact the moderation team directly.' });
        return;
      }

      const user = interaction.user;
      const threshold = settings.appealVoteThreshold;

      const embed = buildAppealEmbed(
        user.id,
        user.createdTimestamp,
        user.displayAvatarURL(),
        email,
        reason,
        other,
        ban.reason,
        ban.createdAt,
        ban.id,
        0,
        threshold
      );

      await (appealChannel as TextChannel).send({ embeds: [embed], components: [buildVoteRow(ban.id, 0, threshold)] });

      await setAppealFiled(ban.id);

      await recordAuditEvent({ eventType: AuditEventType.BanAppealFiled, actorUserId: user.id, targetUserId: user.id, payload: { banId: ban.id } });

      await interaction.editReply({
        content:
          '✅ Your appeal has been submitted successfully. The moderation team will review it and you will be notified here via DM once a decision has been made.',
      });
      return;
    }

    // ── Button actions ────────────────────────────────────────────────────────
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('appeal:')) return;

    const parts = interaction.customId.split(':');
    const action = parts[1];
    const banId = parseInt(parts[2] ?? '', 10);

    if ((action !== 'approve' && action !== 'deny') || isNaN(banId)) return;

    const settings = await getSettings();
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    const isModerator =
      member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
      (settings.roleModerationId ? member?.roles.cache.has(settings.roleModerationId) : false) ||
      (settings.roleAdministrationId ? member?.roles.cache.has(settings.roleAdministrationId) : false);

    if (!isModerator) {
      await interaction.reply({ content: 'Only moderators can act on ban appeals.', flags: MessageFlags.Ephemeral });
      return;
    }

    const ban = await findBanById(banId);
    if (!ban) {
      await interaction.reply({ content: 'Ban record not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (ban.appealOutcome) {
      await interaction.reply({ content: 'This appeal has already been resolved.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await upsertUser({ id: interaction.user.id, username: interaction.user.username });

    // ── Approve ───────────────────────────────────────────────────────────────
    if (action === 'approve') {
      const alreadyVoted = await hasVotedAppeal(banId, interaction.user.id);
      if (alreadyVoted) {
        await interaction.editReply({ content: 'You have already voted to approve this appeal.' });
        return;
      }

      await addAppealVote(banId, interaction.user.id);
      const voteCount = await countAppealVotes(banId);
      const threshold = settings.appealVoteThreshold;

      if (voteCount >= threshold) {
        const guild = interaction.guild!;

        await guild.bans.remove(ban.targetUserId, `Appeal #${ban.id} granted — ${voteCount} moderator votes`).catch(() => null);
        await deactivateBan(ban.id);
        await setAppealOutcome(ban.id, AppealOutcome.Granted);

        await recordAuditEvent({
          eventType: AuditEventType.BanAppealResolved,
          actorUserId: interaction.user.id,
          targetUserId: ban.targetUserId,
          payload: { banId: ban.id, outcome: AppealOutcome.Granted, voteCount },
        });

        const originalEmbed = interaction.message.embeds[0];
        const voteFieldIndex = originalEmbed.fields.findIndex((f) => f.name === '🗳️ Approvals');
        const resolvedEmbed = EmbedBuilder.from(originalEmbed).setColor(Colors.Green).setTitle('✅ Ban Appeal — Granted');

        if (voteFieldIndex >= 0) {
          resolvedEmbed.spliceFields(voteFieldIndex, 1, { name: '🗳️ Approvals', value: `${voteCount}/${threshold}`, inline: true });
        }

        resolvedEmbed.addFields({
          name: '✅ Outcome',
          value: `Appeal granted after **${voteCount}** moderator votes. Final vote by <@${interaction.user.id}>.`,
          inline: false,
        });

        await interaction.message.edit({ embeds: [resolvedEmbed], components: [] });

        const targetUser = await client.users.fetch(ban.targetUserId).catch(() => null);
        if (targetUser) {
          const dm = await targetUser.createDM().catch(() => null);
          await dm
            ?.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(Colors.Green)
                  .setTitle('✅ Ban Appeal Granted')
                  .setDescription(
                    'Your ban appeal has been reviewed and **approved** by the moderation team.\n\nYou have been unbanned and may rejoin the server.'
                  )
                  .setFooter({ text: `Appeal #${ban.id}` })
                  .setTimestamp(),
              ],
            })
            .catch(() => null);
        }

        await interaction.editReply({ content: `✅ Appeal granted. <@${ban.targetUserId}> has been unbanned.` });
      } else {
        const originalEmbed = interaction.message.embeds[0];
        const voteFieldIndex = originalEmbed.fields.findIndex((f) => f.name === '🗳️ Approvals');
        const updatedEmbed = EmbedBuilder.from(originalEmbed);

        if (voteFieldIndex >= 0) {
          updatedEmbed.spliceFields(voteFieldIndex, 1, { name: '🗳️ Approvals', value: `${voteCount}/${threshold}`, inline: true });
        }

        await interaction.message.edit({ embeds: [updatedEmbed], components: [buildVoteRow(banId, voteCount, threshold)] });
        await interaction.editReply({ content: `✅ Vote recorded. ${voteCount}/${threshold} approvals needed.` });
      }
      return;
    }

    // ── Deny ──────────────────────────────────────────────────────────────────
    if (action === 'deny') {
      await setAppealOutcome(ban.id, AppealOutcome.Denied);

      await recordAuditEvent({
        eventType: AuditEventType.BanAppealResolved,
        actorUserId: interaction.user.id,
        targetUserId: ban.targetUserId,
        payload: { banId: ban.id, outcome: AppealOutcome.Denied },
      });

      const originalEmbed = interaction.message.embeds[0];
      const resolvedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(Colors.Red)
        .setTitle('❌ Ban Appeal — Denied')
        .addFields({ name: '❌ Outcome', value: `Appeal denied by <@${interaction.user.id}>. Ban remains in effect.`, inline: false });

      await interaction.message.edit({ embeds: [resolvedEmbed], components: [] });

      const targetUser = await client.users.fetch(ban.targetUserId).catch(() => null);
      if (targetUser) {
        const dm = await targetUser.createDM().catch(() => null);
        await dm
          ?.send({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('❌ Ban Appeal Denied')
                .setDescription('Your ban appeal has been reviewed and **denied** by the moderation team.\n\nYour ban remains in effect.')
                .setFooter({ text: `Appeal #${ban.id}` })
                .setTimestamp(),
            ],
          })
          .catch(() => null);
      }

      await interaction.editReply({ content: `❌ Appeal denied. Ban on <@${ban.targetUserId}> remains in effect.` });
    }
  },
});
