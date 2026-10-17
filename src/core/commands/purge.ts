import { ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, Colors } from '~/settings';
import { L } from '~/core/locales';
import { AuditEventType, deleteBansForUser, deleteReportsForUser, deleteWarningsForUser, insertBan, recordAuditEvent, upsertUser } from '~/database';
import { attempt, logSoftFailure } from '~/utilities';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.System,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Permanently delete all moderation records for a user and issue a permanent ban.')
    .addUserOption((o) => o.setName('user').setDescription('User whose data to purge').setRequired(true)),

  async executeCommand(command, client, interaction) {
    const locale = interaction.locale;
    const targetUser = interaction.options.getUser('user', true);
    const P = L[locale].MODERATION.PURGE;

    const confirmId = 'purge:confirm';
    const cancelId = 'purge:cancel';

    const confirmEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(P.CONFIRM_TITLE())
      .setDescription(P.CONFIRM_DESCRIPTION({ userId: targetUser.id }));

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel(P.CONFIRM_BUTTON()).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cancelId).setLabel(P.CANCEL_BUTTON()).setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], fetchReply: true });

    let confirmation;
    try {
      confirmation = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000,
      });
    } catch (error) {
      logSoftFailure(AppFeature.Clear, 'PURGE_CONFIRMATION_TIMEOUT', { userId: interaction.user.id }, error, 'debug');
      await interaction.editReply({ embeds: [], components: [], content: P.CANCELLED() });
      return;
    }

    if (confirmation.customId === cancelId) {
      await confirmation.update({ embeds: [], components: [], content: P.CANCELLED() });
      return;
    }

    await confirmation.update({ embeds: [confirmEmbed], components: [] });

    await upsertUser({ id: interaction.user.id, username: interaction.user.username });
    await upsertUser({ id: targetUser.id, username: targetUser.username });

    await deleteWarningsForUser(targetUser.id);
    await deleteBansForUser(targetUser.id);
    await deleteReportsForUser(targetUser.id);

    await recordAuditEvent({
      eventType: AuditEventType.DataDeletionRequested,
      actorUserId: interaction.user.id,
      targetUserId: targetUser.id,
      payload: { requestedAt: new Date().toISOString() },
    });

    await insertBan({
      targetUserId: targetUser.id,
      moderatorId: interaction.user.id,
      reason: 'Data deletion request — permanent ban',
      expiresAt: null,
      appealable: false,
    });

    const discordBanned =
      (await attempt(() => interaction.guild!.bans.create(targetUser.id, { reason: 'Data deletion request' }), {
        feature: AppFeature.GdprDeletion,
        errorCode: 'DATA_DELETION_BAN_CREATE',
        context: { targetUserId: targetUser.id },
      })) !== null;

    const content = discordBanned ? P.SUCCESS({ userId: targetUser.id }) : P.BAN_FAILED({ userId: targetUser.id });
    await interaction.editReply({ embeds: [], components: [], content });
  },
});
