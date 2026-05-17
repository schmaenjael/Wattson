import { ChannelType, Colors, EmbedBuilder, Events, Message, TextChannel } from 'discord.js';

import { AuditEventType, findLockedChannel, getSettings, insertMute, lockChannel, recordAuditEvent, unlockChannel, upsertUser } from '~/database';
import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { clearUserChannelWindow, recordAndCheck } from '~/core/providers/antispam';
import { clearChannelSlowmodeState, recordAndCheckSlowmode, SLOWMODE_TIERS, type SlowmodeAction } from '~/core/providers/autoslowmode';
import {
  getStickyForChannel,
  incrementStickyCounter,
  resetStickyCounter,
  updateCachedLastMessageId,
  type StickyMessage,
} from '~/core/providers/sticky';
import { runAutomod } from '~/core/providers/automod/run';
import { enqueueMessage } from '~/core/scheduler/messageQueue';
import type { Client } from '~/core/models';

const logToSurveillance = async (guild: NonNullable<TextChannel['guild']>, channelId: string | null | undefined, text: string): Promise<void> => {
  if (!channelId) return;
  const ch = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  await ch?.send({ content: text.slice(0, 2000) }).catch(() => null);
};

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
  guild: Message<true>['guild'],
  client: Client,
  settings: Awaited<ReturnType<typeof getSettings>>
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
    await logToSurveillance(
      guild,
      settings.surveillanceLogChannelId,
      `🐌 **auto-slowmode** ↑ level ${action.level}/${SLOWMODE_TIERS.length} → ${action.slowmodeSeconds}s in <#${channel.id}>`
    );
    await recordAuditEvent({
      eventType: AuditEventType.ChannelLocked,
      payload: { channelId: channel.id, slowmode: action.slowmodeSeconds, level: action.level, source: 'auto' },
    });
    return;
  }

  if (action.type === 'step_down') {
    await channel.setRateLimitPerUser(action.slowmodeSeconds).catch(() => null);
    await logToSurveillance(
      guild,
      settings.surveillanceLogChannelId,
      `🐌 **auto-slowmode** ↓ level ${action.level}/${SLOWMODE_TIERS.length} → ${action.slowmodeSeconds}s in <#${channel.id}>`
    );
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
    await logToSurveillance(
      guild,
      settings.surveillanceLogChannelId,
      `✅ **auto-slowmode** removed from <#${channel.id}> — restored to ${previousSlowmode}s`
    );
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
        await applyAutoSlowmodeAction(action, message.channel as TextChannel, message.guild, client, settings);
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
        await logToSurveillance(
          message.guild,
          settings.surveillanceLogChannelId,
          `🚫 **anti-spam** <@${message.author.id}> muted (mute #${mute.id}) in <#${message.channelId}> — >${settings.antiSpamMaxMessages} msg/${settings.antiSpamWindowMs}ms · expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
        );
        logger.info({ userId: message.author.id, channelId: message.channelId, muteId: mute.id }, 'Anti-spam triggered: user muted.');
      }
      return;
    }
  }

  // ── Steps 3-5: Link filter, profanity, LLM harm detection ────────────────
  await runAutomod(message, settings);
};

export default new Event({
  type: Events.MessageCreate,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(event, client, message) {
    if (!message.inGuild()) return;
    if (message.author.bot || message.system) return;
    if (!message.content) return;

    const queued = enqueueMessage(() => processMessage(client, message));
    if (!queued) {
      Logger.getInstance(AppFeature.Surveillance).warn({ messageId: message.id }, 'Message queue full — dropped.');
    }
  },
});
