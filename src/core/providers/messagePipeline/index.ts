import { ChannelType, Colors, EmbedBuilder, Message, TextChannel, type Guild } from 'discord.js';

import { AuditEventType, findLockedChannel, getSettings, insertMute, lockChannel, recordAuditEvent, unlockChannel, upsertUser } from '~/database';
import { AppFeature } from '~/settings';
import { Logger, AsyncQueue, discordTimestamp } from '~/utilities';
import { Client } from '~/core/models';
import { clearUserChannelWindow, recordAndCheck } from '~/core/providers/antispam';
import { clearChannelSlowmodeState, recordAndCheckSlowmode, type SlowmodeAction } from '~/core/providers/autoslowmode';
import { getConfig } from '~/config';
import {
  getStickyForChannel,
  incrementStickyCounter,
  resetStickyCounter,
  updateCachedLastMessageId,
  type StickyMessage,
} from '~/core/providers/sticky';
import { runAutomod } from '~/core/providers/automod';

const queueLogger = Logger.getInstance(AppFeature.Surveillance);
const messageQueue = new AsyncQueue<void>(500, (err) => queueLogger.error(Object(err), 'Message queue task failed'));

const STICKY_COLOR = { info: '#82D0F4', warning: '#FDC220' } as const;

const handleStickyRepost = async (sticky: StickyMessage, channel: TextChannel, logger: ReturnType<typeof Logger.getInstance>): Promise<void> => {
  if (sticky.lastMessageId) {
    await channel.messages.delete(sticky.lastMessageId).catch(() => null);
  }

  const embed = new EmbedBuilder()
    .setColor(STICKY_COLOR[sticky.level as keyof typeof STICKY_COLOR] ?? STICKY_COLOR.info)
    .setDescription(sticky.message)
    .setFooter({ text: 'React with ❓ for more information' });

  let posted;
  try {
    posted = await channel.send({ embeds: [embed] });
    await posted.react('❓');
  } catch (err) {
    logger.error(Object(err), 'Failed to repost sticky message.');
    return;
  }

  await updateCachedLastMessageId(sticky.channelId, posted.id);
};

const applyAutoSlowmodeAction = async (
  action: SlowmodeAction,
  channel: TextChannel,
  guild: Guild,
  client: Client,
  settings: Awaited<ReturnType<typeof getSettings>>,
  logger: ReturnType<typeof Logger.getInstance>
): Promise<void> => {
  if (!action) return;

  if (action.type === 'step_up') {
    if (action.level === 1) {
      const previousSlowmode = channel.rateLimitPerUser ?? 0;
      await upsertUser({ id: client.user!.id, username: client.user!.username });
      await channel.setRateLimitPerUser(action.slowmodeSeconds).catch(() => null);
      await lockChannel({
        channelId: channel.id,
        moderatorId: client.user!.id,
        reason: 'Auto-slowmode: message rate threshold exceeded',
        previousSlowmode,
      });
      await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Yellow)
              .setTitle('🐌 Auto-slowmode Activated')
              .setDescription(`High message volume detected. Slowmode set to **${action.slowmodeSeconds}s**.`)
              .setTimestamp(),
          ],
        })
        .catch(() => null);
    } else {
      await channel.setRateLimitPerUser(action.slowmodeSeconds).catch(() => null);
    }
    await logger.log({
      level: 'info',
      message: `Auto-slowmode step up level ${action.level} in ${channel.id}`,
      data: { channelId: channel.id, slowmodeSeconds: action.slowmodeSeconds, level: action.level },
      target: 'surveillance',
      internalEmbed: new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle('🐌 Auto-slowmode — Stepped Up')
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Level', value: `${action.level}/${getConfig().config.thresholds.autoSlowmodeTiers.length}`, inline: true },
          { name: 'Slowmode', value: `${action.slowmodeSeconds}s`, inline: true }
        )
        .setTimestamp(),
    });
    await recordAuditEvent({
      eventType: AuditEventType.ChannelLocked,
      payload: { channelId: channel.id, slowmode: action.slowmodeSeconds, level: action.level, source: 'auto' },
    });
    return;
  }

  if (action.type === 'step_down') {
    await channel.setRateLimitPerUser(action.slowmodeSeconds).catch(() => null);
    await logger.log({
      level: 'info',
      message: `Auto-slowmode step down level ${action.level} in ${channel.id}`,
      data: { channelId: channel.id, slowmodeSeconds: action.slowmodeSeconds, level: action.level },
      target: 'surveillance',
      internalEmbed: new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle('🐌 Auto-slowmode — Stepped Down')
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Level', value: `${action.level}/${getConfig().config.thresholds.autoSlowmodeTiers.length}`, inline: true },
          { name: 'Slowmode', value: `${action.slowmodeSeconds}s`, inline: true }
        )
        .setTimestamp(),
    });
    await recordAuditEvent({
      eventType: AuditEventType.ChannelLocked,
      payload: { channelId: channel.id, slowmode: action.slowmodeSeconds, level: action.level, source: 'auto' },
    });
    return;
  }

  if (action.type === 'restore') {
    const lock = await findLockedChannel(channel.id);
    const previousSlowmode = lock?.previousSlowmode ?? 0;
    await channel.setRateLimitPerUser(previousSlowmode).catch(() => null);
    await unlockChannel(channel.id);
    clearChannelSlowmodeState(channel.id);
    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('✅ Auto-slowmode Removed')
            .setDescription(`Message volume normalized. Slowmode restored to **${previousSlowmode}s**.`)
            .setTimestamp(),
        ],
      })
      .catch(() => null);
    await logger.log({
      level: 'info',
      message: `Auto-slowmode removed from ${channel.id}`,
      data: { channelId: channel.id, previousSlowmode },
      target: 'surveillance',
      internalEmbed: new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Auto-slowmode Removed')
        .addFields({ name: 'Channel', value: `<#${channel.id}>`, inline: true }, { name: 'Restored to', value: `${previousSlowmode}s`, inline: true })
        .setTimestamp(),
    });
    await recordAuditEvent({ eventType: AuditEventType.ChannelUnlocked, payload: { channelId: channel.id, previousSlowmode, source: 'auto' } });
  }
};

const processMessage = async (client: Client, message: Message<true>): Promise<void> => {
  const settings = await getSettings();
  const logger = Logger.getInstance(AppFeature.Surveillance);

  // ── Step 0: Sticky counter ─────────────────────────────────────────────────
  const sticky = await getStickyForChannel(message.channelId);
  if (sticky) {
    const count = incrementStickyCounter(message.channelId);
    if (count >= sticky.interval) {
      resetStickyCounter(message.channelId);
      void handleStickyRepost(sticky, message.channel as TextChannel, logger);
    }
  }

  // ── Step 1: Auto-slowmode (channel-wide rate) ─────────────────────────────
  if (settings.featureAutoSlowmodeEnabled && message.channel.type === ChannelType.GuildText) {
    const action = recordAndCheckSlowmode(message.channelId, settings.autoSlowmodeThreshold, settings.autoSlowmodeWindowMs);
    if (action) {
      const existingLock = await findLockedChannel(message.channelId);
      const isManualLock = existingLock !== null && existingLock.moderatorId !== client.user?.id;
      if (!isManualLock) {
        await applyAutoSlowmodeAction(action, message.channel as TextChannel, message.guild, client, settings, logger);
      }
    }
  }

  // ── Step 2: Anti-spam rate limit ───────────────────────────────────────────
  if (settings.featureAntiSpamEnabled && settings.roleMutedId) {
    const triggered = recordAndCheck(message.author.id, message.channelId, settings.antiSpamMaxMessages, settings.antiSpamWindowMs);
    if (triggered) {
      clearUserChannelWindow(message.author.id, message.channelId);
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member && !member.roles.cache.has(settings.roleMutedId!)) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await upsertUser({ id: message.author.id, username: message.author.username });
        await upsertUser({ id: client.user!.id, username: client.user!.username });
        await member.roles.add(settings.roleMutedId!, '[anti-spam] message flood detected').catch(() => null);
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
      return;
    }
  }

  // ── Steps 3-5: Link filter, profanity, LLM harm detection ────────────────
  await runAutomod(message, settings);
};

/** MessageCreate fan-out entrypoint: queues the surveillance/automod pipeline for a human message. */
export const onMessageCreate = (client: Client, message: Message): void => {
  if (!message.inGuild()) return;
  if (message.author.bot || message.system) return;
  if (!message.content) return;

  const queued = messageQueue.enqueue(() => processMessage(client, message));
  if (!queued) {
    queueLogger.warn({ messageId: message.id }, 'Message queue full — dropped.');
  }
};
