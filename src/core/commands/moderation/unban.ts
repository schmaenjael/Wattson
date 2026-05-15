import { ApplicationCommandType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission, BotException } from '~/core/models';
import { AppFeature, ProcessExitCode } from '~/settings';
import { AuditEventType, deactivateBansForUser, listActiveBansForUser, recordAuditEvent } from '~/database';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ban,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Lift active bans for a user.')
    .addStringOption((o) => o.setName('user_id').setDescription('User ID (snowflake)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for unbanning').setRequired(false).setMaxLength(500)),

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const userId = interaction.options.getString('user_id', true);
    const reason = interaction.options.getString('reason', false) ?? 'no reason provided';

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: 'Invalid user ID.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const active = await listActiveBansForUser(userId);
    if (active.length === 0) {
      await interaction.editReply({ content: `No active bans for <@${userId}>.` });
      return;
    }

    try {
      await interaction.guild!.bans.remove(userId, `[${interaction.user.username}] ${reason}`);
    } catch (error) {
      throw new BotException(client, `Failed to unban ${userId} via Discord API`, error);
    }

    const count = await deactivateBansForUser(userId);

    await recordAuditEvent({
      eventType: AuditEventType.BanLifted,
      actorUserId: interaction.user.id,
      targetUserId: userId,
      payload: { banIds: active.map((b) => b.id), reason },
    });

    await interaction.editReply({ content: `Unbanned <@${userId}>; deactivated ${count} ban record(s).` });
  },
});
