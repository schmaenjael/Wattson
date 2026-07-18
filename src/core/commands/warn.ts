import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { getConfig } from '~/config';
import { Command, Permission, BotException } from '~/core/models';
import { logModAction } from '~/core/middleware';
import { AppFeature, appFeatureMap, MOD_LIST_PAGE_SIZE } from '~/settings';
import { Logger, validateModerationTarget } from '~/utilities';
import {
  AuditEventType,
  countActiveWarnings,
  countActiveWarningsSince,
  findWarningById,
  getSettings,
  insertMute,
  insertWarning,
  listWarningsForUser,
  recordAuditEvent,
  revokeWarning,
  upsertUser,
  WARNING_DEFAULT_EXPIRY_DAYS,
  type Warning,
} from '~/database';

const computeAutoMuteMinutes = (activeCount: number, baseMinutes: number): number => {
  if (activeCount <= 1) return 0;
  if (activeCount === 2) return Math.max(Math.round(baseMinutes / 4), 5);
  const { muteCapMinutes } = getConfig().config.thresholds;
  return Math.min(Math.round(baseMinutes * Math.pow(2, activeCount - 3)), muteCapMinutes);
};

const formatMuteDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 60 / 24)}d`;
};

const statusBadge = (w: Warning, now: Date): string => {
  if (w.revokedAt) return '⚪ revoked';
  if (w.expiresAt && w.expiresAt < now) return '🔘 expired';
  return '🟡 active';
};

const line = (w: Warning, now: Date): string => {
  const expiry =
    !w.revokedAt && w.expiresAt ? ` · ${w.expiresAt < now ? 'expired' : 'expires'} <t:${Math.floor(w.expiresAt.getTime() / 1000)}:R>` : '';
  return `**#${w.id}** · ${statusBadge(w, now)} · <t:${Math.floor(w.createdAt.getTime() / 1000)}:R> by <@${w.moderatorId}>${expiry}\n> ${w.reason}`;
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Warn,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  afterware: [logModAction],
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue and manage warnings.')
    .addSubcommand((s) =>
      s
        .setName('issue')
        .setDescription('Issue a warning to a user.')
        .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
        .addIntegerOption((o) =>
          o
            .setName('expiry-days')
            .setDescription(`Days until the warning expires (default: ${WARNING_DEFAULT_EXPIRY_DAYS}, 0 = never)`)
            .setMinValue(0)
            .setMaxValue(365)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription("List a user's warnings.")
        .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('revoke')
        .setDescription('Revoke a warning by ID.')
        .addIntegerOption((o) => o.setName('id').setDescription('Warning ID').setRequired(true).setMinValue(1))
    ),

  async executeCommand(command, client, interaction) {
    const sub = interaction.options.getSubcommand(true);

    if (sub === 'issue') {
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const expiryDays = interaction.options.getInteger('expiry-days');

      const targetError = validateModerationTarget(target, interaction.user, 'warn');
      if (targetError) {
        await interaction.reply({ content: targetError, flags: MessageFlags.Ephemeral });
        return;
      }

      const expiresAt = expiryDays === 0 ? null : new Date(Date.now() + (expiryDays ?? WARNING_DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000);

      const settings = await getSettings();
      await Promise.all([
        upsertUser({ id: target.id, username: target.username }),
        upsertUser({ id: interaction.user.id, username: interaction.user.username }),
      ]);

      let warning: Warning;
      try {
        warning = await insertWarning({ targetUserId: target.id, moderatorId: interaction.user.id, reason, expiresAt });
      } catch (error) {
        throw new BotException(client, `Failed to record warning against ${target.tag}`, error);
      }

      const expiryLine = warning.expiresAt ? `Expires <t:${Math.floor(warning.expiresAt.getTime() / 1000)}:R>.` : 'No expiry.';

      const dm = await target.createDM().catch(() => null);
      if (dm) {
        await dm
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor(appFeatureMap[command.options.feature].color)
                .setTitle('You received a warning')
                .addFields(
                  { name: 'Reason', value: reason },
                  { name: 'Warning ID', value: `#${warning.id}`, inline: true },
                  { name: 'Issued at', value: `<t:${Math.floor(warning.createdAt.getTime() / 1000)}:F>`, inline: true },
                  { name: 'Expires', value: warning.expiresAt ? `<t:${Math.floor(warning.expiresAt.getTime() / 1000)}:F>` : 'Never', inline: true }
                )
                .setTimestamp(),
            ],
          })
          .catch(() => null);
      }

      const logger = Logger.getInstance(AppFeature.Warn);
      await logger.log({
        level: 'info',
        message: `Warning #${warning.id} issued against ${target.id}`,
        data: { warningId: warning.id, targetId: target.id, moderatorId: interaction.user.id },
        target: 'moderation',
        internalEmbed: new EmbedBuilder()
          .setColor(appFeatureMap[command.options.feature].color)
          .setTitle(`Warning #${warning.id}`)
          .addFields(
            { name: 'Target', value: `<@${target.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Expires', value: warning.expiresAt ? `<t:${Math.floor(warning.expiresAt.getTime() / 1000)}:R>` : 'Never', inline: true },
            { name: 'Reason', value: reason }
          )
          .setTimestamp(warning.createdAt),
        publicEmbed: new EmbedBuilder()
          .setColor(appFeatureMap[command.options.feature].color)
          .setTitle('⚠️ Member Warned')
          .addFields({ name: 'User', value: `<@${target.id}>` }, { name: 'Reason', value: reason })
          .setTimestamp(warning.createdAt),
      });

      const windowStart = new Date(Date.now() - settings.warnAutoEscalateWindowDays * 24 * 60 * 60 * 1000);
      const [activeCount, windowCount] = await Promise.all([countActiveWarnings(target.id), countActiveWarningsSince(target.id, windowStart)]);

      let escalationNote = '';
      if (windowCount >= settings.warnAutoEscalateCount) {
        escalationNote = `\n\n⚠️ **Auto-escalation threshold reached** (${windowCount} active warnings in the last ${settings.warnAutoEscalateWindowDays} days). Consider a ban or court case.`;
      }

      if (settings.featureWarnAutoMuteEnabled && settings.roleMutedId) {
        const muteMinutes = computeAutoMuteMinutes(activeCount, settings.warnAutoMuteBaseMinutes);
        if (muteMinutes > 0) {
          const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
          if (member && !member.roles.cache.has(settings.roleMutedId)) {
            const muteExpiresAt = new Date(Date.now() + muteMinutes * 60 * 1000);
            const durationLabel = formatMuteDuration(muteMinutes);
            await upsertUser({ id: client.user!.id, username: client.user!.username });
            await member.roles.add(settings.roleMutedId, `[warn auto-mute] ${activeCount} active warnings`).catch(() => null);
            const autoMute = await insertMute({
              targetUserId: target.id,
              moderatorId: client.user!.id,
              reason: `Warn auto-mute: ${activeCount} active warnings`,
              expiresAt: muteExpiresAt,
            });
            await recordAuditEvent({
              eventType: AuditEventType.MuteIssued,
              actorUserId: client.user!.id,
              targetUserId: target.id,
              payload: { muteId: autoMute.id, reason: autoMute.reason, expiresAt: muteExpiresAt.toISOString() },
            });
            await logger.log({
              level: 'info',
              message: `Auto-mute #${autoMute.id} applied to ${target.id}`,
              data: { muteId: autoMute.id, targetId: target.id, activeCount },
              target: 'moderation',
              internalEmbed: new EmbedBuilder()
                .setColor(appFeatureMap[command.options.feature].color)
                .setTitle(`Auto-mute #${autoMute.id}`)
                .addFields(
                  { name: 'Target', value: `<@${target.id}>`, inline: true },
                  { name: 'Active warnings', value: `${activeCount}`, inline: true },
                  { name: 'Duration', value: durationLabel, inline: true },
                  { name: 'Expires', value: `<t:${Math.floor(muteExpiresAt.getTime() / 1000)}:F>`, inline: true }
                )
                .setTimestamp(),
              publicEmbed: new EmbedBuilder()
                .setColor(appFeatureMap[command.options.feature].color)
                .setTitle('🔇 Member Muted (Automod)')
                .addFields(
                  { name: 'User', value: `<@${target.id}>` },
                  { name: 'Duration', value: durationLabel },
                  { name: 'Reason', value: `Warn auto-mute: ${activeCount} active warnings` }
                )
                .setTimestamp(),
            });
            escalationNote += `\n\n🔇 **Auto-muted** for ${durationLabel} (${activeCount} active warnings, expires <t:${Math.floor(muteExpiresAt.getTime() / 1000)}:R>).`;
          }
        }
      }

      await interaction.reply({
        content: `Warned <@${target.id}> (reason: ${reason}). Warning **#${warning.id}** recorded. ${expiryLine}${escalationNote}`,
        flags: MessageFlags.Ephemeral,
      });

      return {
        eventType: AuditEventType.WarnIssued,
        actorUserId: interaction.user.id,
        targetUserId: target.id,
        payload: { warningId: warning.id, reason },
      };
    }

    if (sub === 'list') {
      const user = interaction.options.getUser('user', true);
      const rows = await listWarningsForUser(user.id);
      const now = new Date();
      const top = rows.slice(0, MOD_LIST_PAGE_SIZE);

      const activeCount = rows.filter((w) => !w.revokedAt && (!w.expiresAt || w.expiresAt > now)).length;
      const expiredCount = rows.filter((w) => !w.revokedAt && w.expiresAt && w.expiresAt <= now).length;
      const revokedCount = rows.filter((w) => !!w.revokedAt).length;

      const embed = new EmbedBuilder()
        .setColor(appFeatureMap[command.options.feature].color)
        .setTitle(`Warnings for ${user.tag}`)
        .setDescription(top.length === 0 ? '*No warnings.*' : top.map((w) => line(w, now)).join('\n\n'))
        .setFooter({ text: `${rows.length} total · ${activeCount} active · ${expiredCount} expired · ${revokedCount} revoked` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'revoke') {
      const id = interaction.options.getInteger('id', true);
      const existing = await findWarningById(id);
      if (!existing) {
        await interaction.reply({ content: `No warning #${id}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (existing.revokedAt) {
        await interaction.reply({ content: `Warning #${id} is already revoked.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const updated = await revokeWarning(id, interaction.user.id);
      if (!updated) throw new BotException(client, `Failed to revoke warning #${id}`);

      await recordAuditEvent({
        eventType: AuditEventType.WarnRevoked,
        actorUserId: interaction.user.id,
        targetUserId: updated.targetUserId ?? undefined,
        payload: { warningId: id },
      });

      await interaction.reply({ content: `Warning #${id} revoked.`, flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
