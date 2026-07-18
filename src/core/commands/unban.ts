import { ApplicationCommandType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission, BotException } from '~/core/models';
import { logModAction } from '~/core/middleware';
import { AppFeature } from '~/settings';
import { AuditEventType, deactivateBansForUser, listActiveBansForUser, upsertUser } from '~/database';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ban,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  afterware: [logModAction],
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Lift active bans for a user.')
    .addStringOption((o) => o.setName('user_id').setDescription('User ID (snowflake)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for unbanning').setRequired(false).setMaxLength(500)),

  async executeCommand(_command, client, interaction) {
    const userId = interaction.options.getString('user_id', true);
    const reason = interaction.options.getString('reason', false) ?? 'no reason provided';

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: 'Invalid user ID.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await upsertUser({ id: interaction.user.id, username: interaction.user.username });

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

    await interaction.editReply({ content: `Unbanned <@${userId}>; deactivated ${count} ban record(s).` });

    return {
      eventType: AuditEventType.BanLifted,
      actorUserId: interaction.user.id,
      targetUserId: userId,
      payload: { banIds: active.map((b) => b.id), reason },
    };
  },
});
