import { Colors, EmbedBuilder } from 'discord.js';

import { AuditEventType, insertMute, recordAuditEvent, upsertUser } from '~/database';
import type { MessageContext } from '~/core/types';
import { logSoftFailure, softFail, discordTimestamp } from '~/utilities';
import { AppFeature } from '~/settings';

const spamWindows = new Map<string, Map<string, number[]>>();

const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

/** Drops windows that can no longer contribute to a trigger, so the map does not grow for the process lifetime. */
function sweepStaleWindows(now: number, cutoff: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  for (const [userId, userMap] of spamWindows) {
    for (const [channelId, timestamps] of userMap) {
      if (timestamps.every((t) => t <= cutoff)) {
        userMap.delete(channelId);
      }
    }
    if (userMap.size === 0) {
      spamWindows.delete(userId);
    }
  }
}

function recordAndCheck(userId: string, channelId: string, maxMessages: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  sweepStaleWindows(now, cutoff);

  if (!spamWindows.has(userId)) {
    spamWindows.set(userId, new Map());
  }

  const userMap = spamWindows.get(userId)!;
  const timestamps = (userMap.get(channelId) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  userMap.set(channelId, timestamps);

  return timestamps.length >= maxMessages;
}

function clearUserChannelWindow(userId: string, channelId: string): void {
  spamWindows.get(userId)?.delete(channelId);
}

/**
 * Checks the rolling message-rate window for the author and, if exceeded, mutes them and
 * records the mute. Returns whether the caller should stop processing this message further
 * (true whenever the rate is triggered, regardless of whether a mute was actually applied).
 */
export async function recordAndAct(ctx: MessageContext): Promise<boolean> {
  const { client, message, settings, logger } = ctx;
  if (!settings.featureAntiSpamEnabled || !settings.roleMutedId) return false;

  const triggered = recordAndCheck(message.author.id, message.channelId, settings.antiSpamMaxMessages, settings.antiSpamWindowMs);
  if (!triggered) return false;

  const member = await message.guild.members
    .fetch(message.author.id)
    .catch(softFail(AppFeature.AntiSpam, 'ANTISPAM_MEMBER_FETCH', { userId: message.author.id }));
  if (!member) {
    // Window deliberately left intact — a transient API failure must not hand the flooder a
    // fresh budget the way a genuine "member left" would.
    return true;
  }
  if (member.roles.cache.has(settings.roleMutedId)) {
    clearUserChannelWindow(message.author.id, message.channelId);
    return true;
  }

  const expiresAt = new Date(Date.now() + settings.antiSpamMuteMinutes * 60 * 1000);
  await upsertUser({ id: message.author.id, username: message.author.username });
  await upsertUser({ id: client.user!.id, username: client.user!.username });

  try {
    await member.roles.add(settings.roleMutedId, '[anti-spam] message flood detected');
  } catch (error) {
    // Leave the window intact: resetting it here would hand a still-unmuted flooder a fresh budget every time.
    logSoftFailure(AppFeature.AntiSpam, 'ANTISPAM_MUTED_ROLE_ADD', { userId: message.author.id, roleId: settings.roleMutedId }, error);
    return true;
  }

  clearUserChannelWindow(message.author.id, message.channelId);

  const mute = await insertMute({
    targetUserId: message.author.id,
    moderatorId: client.user!.id,
    reason: 'Anti-spam: message flood detected',
    expiresAt,
  });
  await recordAuditEvent({
    eventType: AuditEventType.AntiSpamTriggered,
    targetUserId: message.author.id,
    payload: {
      muteId: mute.id,
      channelId: message.channelId,
      maxMessages: settings.antiSpamMaxMessages,
      windowMs: settings.antiSpamWindowMs,
      expiresAt: expiresAt.toISOString(),
    },
  });
  await logger.log({
    level: 'info',
    message: `Anti-spam mute applied to ${message.author.id}`,
    data: { muteId: mute.id, userId: message.author.id, channelId: message.channelId },
    target: 'surveillance',
    internalEmbed: new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('🚫 Anti-spam — User Muted')
      .addFields(
        { name: 'User', value: `<@${message.author.id}>`, inline: true },
        { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
        { name: 'Mute', value: `#${mute.id}`, inline: true },
        { name: 'Threshold', value: `>${settings.antiSpamMaxMessages} msg/${settings.antiSpamWindowMs}ms`, inline: true },
        { name: 'Duration', value: `${settings.antiSpamMuteMinutes} min`, inline: true },
        { name: 'Expires', value: `${discordTimestamp(expiresAt, 'R')}`, inline: true }
      )
      .setTimestamp(),
  });
  logger.info({ userId: message.author.id, channelId: message.channelId, muteId: mute.id }, 'Anti-spam triggered: user muted.');

  return true;
}
