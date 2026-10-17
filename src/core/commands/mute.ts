import { ApplicationCommandType, MessageFlags, SlashCommandBuilder, type User } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature } from '~/settings';
import { discordTimestamp, resolveExpiresAt, validateModerationTarget } from '~/utilities';
import { applyMute, type ApplyMuteResult } from '~/core/providers/moderation';

const FAILURE_MESSAGES: Record<Exclude<ApplyMuteResult, { ok: true }>['reason'], (target: User) => string> = {
  not_configured: () => 'Muted role not configured. Set `roles.utility.muted` in the bot config.',
  not_in_guild: (target) => `${target.tag} is not in the server.`,
  already_muted: (target) => `<@${target.id}> is already muted.`,
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Mute,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Assign the muted role to a user.')
    .addUserOption((o) => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
    .addStringOption((o) => o.setName('duration').setDescription('Duration like 30m, 2h, 7d, 1w (blank = indefinite)').setRequired(false)),

  async executeCommand(command, client, interaction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const durationStr = interaction.options.getString('duration', false);

    const targetError = validateModerationTarget(target, interaction.user, 'mute');
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

    const result = await applyMute(client, interaction.guild!, { target, moderator: interaction.user, reason, expiresAt });
    if (!result.ok) {
      await interaction.editReply({ content: FAILURE_MESSAGES[result.reason](target) });
      return;
    }

    await interaction.editReply({
      content: `Muted <@${target.id}>. Mute **#${result.mute.id}** recorded${expiresAt ? `; expires ${discordTimestamp(expiresAt, 'R')}` : ' (indefinite)'}.`,
    });
  },
});
