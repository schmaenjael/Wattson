import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { BotException, Command, Permission } from '~/core/models';
import { logModAction } from '~/core/middleware';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { AuditEventType, getSettings, insertMute, upsertUser } from '~/database';
import { Logger, validateModerationTarget, resolveExpiresAt } from '~/utilities';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Mute,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  afterware: [logModAction],
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Assign the muted role to a user.')
    .addUserOption((o) => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
    .addStringOption((o) => o.setName('duration').setDescription('Duration like 30m, 2h, 7d, 1w (blank = indefinite)').setRequired(false)),

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

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

    const settings = await getSettings();

    if (!settings.roleMutedId) {
      await interaction.reply({ content: 'Muted role not configured. Set it via `/config role`.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await Promise.all([
      upsertUser({ id: target.id, username: target.username }),
      upsertUser({ id: interaction.user.id, username: interaction.user.username }),
    ]);

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: `${target.tag} is not in the server.` });
      return;
    }

    if (member.roles.cache.has(settings.roleMutedId)) {
      await interaction.editReply({ content: `<@${target.id}> is already muted.` });
      return;
    }

    try {
      await member.roles.add(settings.roleMutedId, `[mute #mod:${interaction.user.username}] ${reason}`);
    } catch (err) {
      throw new BotException(client, `Failed to assign muted role to ${target.tag}`, err);
    }

    const mute = await insertMute({ targetUserId: target.id, moderatorId: interaction.user.id, reason, expiresAt });

    const logger = Logger.getInstance(AppFeature.Mute);
    await logger.log({
      level: 'info',
      message: `Mute #${mute.id} issued against ${target.id}`,
      data: { muteId: mute.id, targetId: target.id, moderatorId: interaction.user.id },
      target: 'moderation',
      internalEmbed: new EmbedBuilder()
        .setColor(appFeatureMap[command.options.feature].color)
        .setTitle(`Mute #${mute.id}`)
        .addFields(
          { name: 'Target', value: `<@${target.id}>`, inline: true },
          { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Expires', value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : 'indefinite', inline: true }
        )
        .setTimestamp(mute.createdAt),
      publicEmbed: new EmbedBuilder()
        .setColor(appFeatureMap[command.options.feature].color)
        .setTitle('🔇 Member Muted')
        .addFields(
          { name: 'User', value: `<@${target.id}>` },
          { name: 'Duration', value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'indefinite' },
          { name: 'Reason', value: reason }
        )
        .setTimestamp(mute.createdAt),
    });

    await interaction.editReply({
      content: `Muted <@${target.id}>. Mute **#${mute.id}** recorded${expiresAt ? `; expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : ' (indefinite)'}.`,
    });

    return {
      eventType: AuditEventType.MuteIssued,
      actorUserId: interaction.user.id,
      targetUserId: target.id,
      payload: { muteId: mute.id, reason, expiresAt: expiresAt?.toISOString() ?? null },
    };
  },
});
