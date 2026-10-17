import { ApplicationCommandType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature } from '~/settings';
import { discordTimestamp, resolveExpiresAt, validateModerationTarget } from '~/utilities';
import { applyBan } from '~/core/providers/moderation';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ban,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user.')
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
    .addStringOption((o) => o.setName('duration').setDescription('Duration like 30m, 2h, 7d, 1w (blank = permanent)').setRequired(false))
    .addBooleanOption((o) => o.setName('appealable').setDescription('Whether the user may appeal').setRequired(false))
    .addIntegerOption((o) =>
      o
        .setName('delete_messages_seconds')
        .setDescription('Delete this many seconds of message history (0-604800)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(604_800)
    ),

  async executeCommand(command, client, interaction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const durationStr = interaction.options.getString('duration', false);
    const appealable = interaction.options.getBoolean('appealable', false) ?? false;
    const deleteMessageSeconds = interaction.options.getInteger('delete_messages_seconds', false) ?? 0;

    const targetError = validateModerationTarget(target, interaction.user, 'ban');
    if (targetError) {
      await interaction.reply({ content: targetError, flags: MessageFlags.Ephemeral });
      return;
    }

    const expiresAt = resolveExpiresAt(durationStr);
    if (expiresAt === 'invalid') {
      await interaction.reply({ content: `Invalid duration: \`${durationStr}\`. Use e.g. 30m, 2h, 7d, 1w.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const ban = await applyBan(client, interaction.guild!, {
      target,
      moderator: interaction.user,
      reason,
      expiresAt,
      appealable,
      deleteMessageSeconds,
    });

    await interaction.editReply({
      content: `Banned <@${target.id}>. Ban **#${ban.id}** recorded${expiresAt ? `; expires ${discordTimestamp(expiresAt, 'R')}` : ' (permanent)'}.`,
    });
  },
});
