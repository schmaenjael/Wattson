import { EmbedBuilder, Events, MessageFlags, PermissionFlagsBits } from 'discord.js';

import { BotException, Event } from '~/core/models';
import { AppFeature, Colors } from '~/settings';
import { AuditEventType, executeGdprDeletion, getSettings, recordAuditEvent, upsertUser } from '~/database';
import { L, baseLocale } from '~/core/locales';

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.GdprDeletion,
  middleware: [],
  async executeCommand(event, client, interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('gdpr:')) return;

    const parts = interaction.customId.split(':');
    const action = parts[1];
    const targetId = parts[2];
    const requesterId = parts[3];

    if (!action || !targetId || !requesterId || (action !== 'approve' && action !== 'deny')) return;

    if (interaction.message.components.length === 0) {
      await interaction.reply({ content: 'This request has already been handled.', flags: MessageFlags.Ephemeral });
      return;
    }

    const settings = await getSettings();
    const actor = await interaction.guild?.members.fetch(interaction.user.id);
    const isModerator =
      actor?.permissions.has(PermissionFlagsBits.ManageGuild) ||
      (settings.roleModerationId ? actor?.roles.cache.has(settings.roleModerationId) : false) ||
      (settings.roleAdministrationId ? actor?.roles.cache.has(settings.roleAdministrationId) : false);

    if (!isModerator) {
      await interaction.reply({ content: 'You lack the Moderation permission to act on this request.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferUpdate();

    const DM = L[baseLocale].MODERATION.GDPR_REQUEST;

    if (action === 'approve') {
      await upsertUser({ id: interaction.user.id, username: interaction.user.username });

      try {
        await executeGdprDeletion(targetId, interaction.user.id);
      } catch (error) {
        throw new BotException(client, `GDPR deletion transaction failed for user ${targetId}`, error);
      }

      try {
        await interaction.guild!.bans.create(targetId, { reason: `[GDPR] Data Deletion Request — approved by ${interaction.user.username}` });
      } catch {
        // User may already be banned or not in guild
      }

      try {
        const dmChannel = await client.users.createDM(targetId);
        await dmChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Red)
              .setTitle(DM.DM_EXECUTED_TITLE())
              .setDescription(DM.DM_EXECUTED_DESCRIPTION())
              .addFields(
                { name: DM.DM_DELETED_TITLE(), value: DM.DM_DELETED_VALUE() },
                { name: DM.DM_NOT_DELETED_TITLE(), value: DM.DM_NOT_DELETED_VALUE() },
                { name: '​', value: DM.DM_BAN_NOTICE() }
              )
              .setTimestamp(),
          ],
        });
      } catch {
        // DMs may be disabled
      }

      await recordAuditEvent({
        eventType: AuditEventType.DataDeletionExecuted,
        actorUserId: interaction.user.id,
        targetUserId: targetId,
        payload: { approvedBy: interaction.user.id, requestedBy: requesterId },
      });

      await interaction.message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('GDPR/DSGVO Data Deletion — Executed')
            .addFields(
              { name: 'Target', value: `\`${targetId}\``, inline: true },
              { name: 'Approved by', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Status', value: '✅ All data erased. User permanently banned.' }
            )
            .setTimestamp(),
        ],
        components: [],
      });
    } else {
      try {
        const dmChannel = await client.users.createDM(targetId);
        await dmChannel.send({
          embeds: [
            new EmbedBuilder().setColor(Colors.White).setTitle(DM.DM_DENIED_TITLE()).setDescription(DM.DM_DENIED_DESCRIPTION()).setTimestamp(),
          ],
        });
      } catch {
        // DMs may be disabled
      }

      await recordAuditEvent({
        eventType: AuditEventType.DataDeletionDenied,
        actorUserId: interaction.user.id,
        targetUserId: targetId,
        payload: { deniedBy: interaction.user.id, requestedBy: requesterId },
      });

      await interaction.message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.White)
            .setTitle('GDPR/DSGVO Data Deletion Request — Denied')
            .addFields(
              { name: 'Target', value: `<@${targetId}> (\`${targetId}\`)`, inline: true },
              { name: 'Denied by', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Status', value: '❌ Request denied. No data was modified.' }
            )
            .setTimestamp(),
        ],
        components: [],
      });
    }
  },
});
