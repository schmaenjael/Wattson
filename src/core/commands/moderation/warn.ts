import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

import { Command, Permission, BotException } from '~/core/models';
import { logModAction } from '~/core/middleware';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { AuditEventType, countActiveWarningsSince, getSettings, insertWarning, upsertUser } from '~/database';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Warn,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation],
  middleware: [],
  afterware: [logModAction],
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user.')
    .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    if (target.bot) {
      await interaction.reply({ content: 'You cannot warn bots.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot warn yourself.', flags: MessageFlags.Ephemeral });
      return;
    }

    const settings = await getSettings();
    await Promise.all([
      upsertUser({ id: target.id, username: target.username }),
      upsertUser({ id: interaction.user.id, username: interaction.user.username }),
    ]);

    let warning;
    try {
      warning = await insertWarning({ targetUserId: target.id, moderatorId: interaction.user.id, reason });
    } catch (error) {
      throw new BotException(client, `Failed to record warning against ${target.tag}`, error);
    }

    // DM the user (best-effort; don't fail the command if DMs are closed)
    const dm = await target.createDM().catch(() => null);
    if (dm) {
      await dm
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(appFeatureMap[command.options.feature].color)
              .setTitle(`You received a warning`)
              .addFields(
                { name: 'Reason', value: reason },
                { name: 'Warning ID', value: `#${warning.id}`, inline: true },
                { name: 'Issued at', value: `<t:${Math.floor(warning.createdAt.getTime() / 1000)}:F>`, inline: true }
              )
              .setTimestamp(),
          ],
        })
        .catch(() => null);
    }

    // Log to warnings channel
    if (settings.warningsLogChannelId) {
      const logChannel = (await interaction.guild!.channels.fetch(settings.warningsLogChannelId)) as TextChannel | null;
      await logChannel
        ?.send({
          embeds: [
            new EmbedBuilder()
              .setColor(appFeatureMap[command.options.feature].color)
              .setTitle(`Warning #${warning.id}`)
              .addFields(
                { name: 'Target', value: `<@${target.id}>`, inline: true },
                { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Reason', value: reason }
              )
              .setTimestamp(warning.createdAt),
          ],
        })
        .catch(() => null);
    }

    // Check auto-escalation
    const windowStart = new Date(Date.now() - settings.warnAutoEscalateWindowDays * 24 * 60 * 60 * 1000);
    const count = await countActiveWarningsSince(target.id, windowStart);
    let escalationNote = '';
    if (count >= settings.warnAutoEscalateCount) {
      escalationNote = `\n\n⚠️ **Auto-escalation threshold reached** (${count} active warnings in the last ${settings.warnAutoEscalateWindowDays} days). Consider a ban or court case.`;
    }

    await interaction.reply({
      content: `Warned <@${target.id}> (reason: ${reason}). Warning **#${warning.id}** recorded.${escalationNote}`,
      flags: MessageFlags.Ephemeral,
    });

    return {
      eventType: AuditEventType.WarnIssued,
      actorUserId: interaction.user.id,
      targetUserId: target.id,
      payload: { warningId: warning.id, reason },
    };
  },
});
