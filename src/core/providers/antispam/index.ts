import { Colors, EmbedBuilder, type Message } from 'discord.js';

import { AuditEventType, insertMute, recordAuditEvent, upsertUser, type Settings } from '~/database';
import type { Client } from '~/core/models';
import { Logger, discordTimestamp } from '~/utilities';

const spamWindows = new Map<string, Map<string, number[]>>();

function recordAndCheck(userId: string, channelId: string, maxMessages: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

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
export async function recordAndAct(
  client: Client,
  message: Message<true>,
  settings: Settings,
  logger: ReturnType<typeof Logger.getInstance>
): Promise<boolean> {
  if (!settings.featureAntiSpamEnabled || !settings.roleMutedId) return false;

  const triggered = recordAndCheck(message.author.id, message.channelId, settings.antiSpamMaxMessages, settings.antiSpamWindowMs);
  if (!triggered) return false;

  clearUserChannelWindow(message.author.id, message.channelId);
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (member && !member.roles.cache.has(settings.roleMutedId)) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await upsertUser({ id: message.author.id, username: message.author.username });
    await upsertUser({ id: client.user!.id, username: client.user!.username });
    await member.roles.add(settings.roleMutedId, '[anti-spam] message flood detected').catch(() => null);
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
          { name: 'Expires', value: `${discordTimestamp(expiresAt, 'R')}`, inline: true }
        )
        .setTimestamp(),
    });
    logger.info({ userId: message.author.id, channelId: message.channelId, muteId: mute.id }, 'Anti-spam triggered: user muted.');
  }
  return true;
}
