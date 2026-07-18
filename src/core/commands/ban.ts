import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { BotException, Command, Permission } from '~/core/models';
import { logModAction } from '~/core/middleware';
import { AppFeature, appFeatureMap } from '~/settings';
import { AuditEventType, insertBan, upsertUser } from '~/database';
import { Logger, validateModerationTarget, resolveExpiresAt, discordTimestamp } from '~/utilities';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ban,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  afterware: [logModAction],
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
    const deleteSeconds = interaction.options.getInteger('delete_messages_seconds', false) ?? 0;

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

    await Promise.all([
      upsertUser({ id: target.id, username: target.username }),
      upsertUser({ id: interaction.user.id, username: interaction.user.username }),
    ]);

    // Actually ban via Discord API first; if that fails we don't record the row.
    try {
      await interaction.guild!.bans.create(target.id, { reason: `[#${interaction.user.username}] ${reason}`, deleteMessageSeconds: deleteSeconds });
    } catch (error) {
      throw new BotException(client, `Failed to ban ${target.tag} via Discord API`, error);
    }

    const ban = await insertBan({ targetUserId: target.id, moderatorId: interaction.user.id, reason, expiresAt, appealable });

    const logger = Logger.getInstance(AppFeature.Ban);
    await logger.log({
      level: 'info',
      message: `Ban #${ban.id} issued against ${target.id}`,
      data: { banId: ban.id, targetId: target.id, moderatorId: interaction.user.id },
      target: 'moderation',
      internalEmbed: new EmbedBuilder()
        .setColor(appFeatureMap[command.options.feature].color)
        .setTitle(`Ban #${ban.id}`)
        .addFields(
          { name: 'Target', value: `<@${target.id}>`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Expires', value: expiresAt ? `${discordTimestamp(expiresAt, 'F')}` : 'permanent', inline: true },
          { name: 'Appealable', value: appealable ? 'yes' : 'no', inline: true }
        )
        .setTimestamp(ban.createdAt),
      publicEmbed: new EmbedBuilder()
        .setColor(appFeatureMap[command.options.feature].color)
        .setTitle('🔨 Member Banned')
        .addFields({ name: 'User', value: `<@${target.id}>` }, { name: 'Reason', value: reason })
        .setTimestamp(ban.createdAt),
    });

    await interaction.editReply({
      content: `Banned <@${target.id}>. Ban **#${ban.id}** recorded${expiresAt ? `; expires ${discordTimestamp(expiresAt, 'R')}` : ' (permanent)'}.`,
    });

    return {
      eventType: AuditEventType.BanIssued,
      actorUserId: interaction.user.id,
      targetUserId: target.id,
      payload: { banId: ban.id, reason, expiresAt: expiresAt?.toISOString() ?? null, appealable },
    };
  },
});
