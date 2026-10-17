import { EmbedBuilder, type Guild, type User } from 'discord.js';

import { getConfig } from '~/config';
import { AuditEventType, insertMute, recordAuditEvent, upsertUser, type Settings } from '~/database';
import type { Client } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { discordTimestamp, Logger, runDiscordAction, softFail } from '~/utilities';

const COLOR = appFeatureMap[AppFeature.Warn].color;

export const computeAutoMuteMinutes = (activeCount: number, baseMinutes: number): number => {
  if (activeCount <= 1) return 0;
  if (activeCount === 2) return Math.max(Math.round(baseMinutes / 4), 5);
  const { muteCapMinutes } = getConfig().config.thresholds;
  return Math.min(Math.round(baseMinutes * Math.pow(2, activeCount - 3)), muteCapMinutes);
};

export const formatMuteDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 60 / 24)}d`;
};

/**
 * Applies warn-triggered auto-mute escalation if the feature is enabled, the target crosses the
 * threshold, and they aren't already muted. Returns the escalation-note suffix to append to the
 * warn command's reply, or null if no mute was applied.
 */
export const applyWarnAutoMute = async (
  client: Client,
  guild: Guild,
  target: User,
  activeCount: number,
  settings: Settings
): Promise<string | null> => {
  if (!settings.featureWarnAutoMuteEnabled || !settings.roleMutedId) return null;

  const logger = Logger.getInstance(AppFeature.Warn);

  const muteMinutes = computeAutoMuteMinutes(activeCount, settings.warnAutoMuteBaseMinutes);
  if (muteMinutes <= 0) return null;

  const member = await guild.members
    .fetch(target.id)
    .catch(softFail(AppFeature.AutomatedWarn, 'AUTOMATEDWARN_MEMBER_FETCH', { targetId: target.id }));
  if (!member || member.roles.cache.has(settings.roleMutedId)) return null;

  const muteExpiresAt = new Date(Date.now() + muteMinutes * 60 * 1000);
  const durationLabel = formatMuteDuration(muteMinutes);

  await upsertUser({ id: client.user!.id, username: client.user!.username });
  const muted = await runDiscordAction(logger, 'member.roles.add', { userId: member.id, roleId: settings.roleMutedId }, () =>
    member.roles.add(settings.roleMutedId!, `[warn auto-mute] ${activeCount} active warnings`)
  );
  if (!muted) {
    // No role means no mute; a row here would make the sweeper later "lift" a mute that never existed.
    return null;
  }

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
      .setColor(COLOR)
      .setTitle(`Auto-mute #${autoMute.id}`)
      .addFields(
        { name: 'Target', value: `<@${target.id}>`, inline: true },
        { name: 'Active warnings', value: `${activeCount}`, inline: true },
        { name: 'Duration', value: durationLabel, inline: true },
        { name: 'Expires', value: `${discordTimestamp(muteExpiresAt, 'F')}`, inline: true }
      )
      .setTimestamp(),
    publicEmbed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('🔇 Member Muted (Automod)')
      .addFields(
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Duration', value: durationLabel },
        { name: 'Reason', value: `Warn auto-mute: ${activeCount} active warnings` }
      )
      .setTimestamp(),
  });

  return `\n\n🔇 **Auto-muted** for ${durationLabel} (${activeCount} active warnings, expires ${discordTimestamp(muteExpiresAt, 'R')}).`;
};
