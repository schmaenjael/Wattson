import { ChannelType, Colors, EmbedBuilder, type Guild, type TextChannel } from 'discord.js';

import { AuditEventType, findLockedChannel, lockChannel, recordAuditEvent, unlockChannel, upsertUser, type Settings } from '~/database';
import type { Client } from '~/core/models';
import type { MessageContext } from '~/core/types';
import { getConfig } from '~/config';
import { Logger, runDiscordAction, softFail } from '~/utilities';
import { AppFeature } from '~/settings';

interface ChannelState {
  level: number;
  timestamps: number[];
  lastActionAt: number;
}

const channelStates = new Map<string, ChannelState>();

type SlowmodeAction =
  | { type: 'step_up'; level: number; slowmodeSeconds: number }
  | { type: 'step_down'; level: number; slowmodeSeconds: number }
  | { type: 'restore' }
  | null;

function recordAndCheckSlowmode(channelId: string, threshold: number, windowMs: number): SlowmodeAction {
  const { autoSlowmodeTiers, autoSlowmodeStepDownFactor } = getConfig().config.thresholds;
  const now = Date.now();
  const cutoff = now - windowMs;

  let state = channelStates.get(channelId);
  if (!state) {
    state = { level: 0, timestamps: [], lastActionAt: 0 };
    channelStates.set(channelId, state);
  }

  state.timestamps = state.timestamps.filter((t) => t > cutoff);
  state.timestamps.push(now);

  if (state.timestamps.length >= threshold) {
    state.lastActionAt = now;
    if (state.level < autoSlowmodeTiers.length) {
      state.level++;
      return { type: 'step_up', level: state.level, slowmodeSeconds: autoSlowmodeTiers[state.level - 1] };
    }
    return null;
  }

  if (state.level > 0 && now - state.lastActionAt > windowMs * autoSlowmodeStepDownFactor) {
    state.level--;
    state.lastActionAt = now;
    if (state.level === 0) {
      return { type: 'restore' };
    }
    return { type: 'step_down', level: state.level, slowmodeSeconds: autoSlowmodeTiers[state.level - 1] };
  }

  return null;
}

function clearChannelSlowmodeState(channelId: string): void {
  channelStates.delete(channelId);
}

async function applyAutoSlowmodeAction(
  action: SlowmodeAction,
  channel: TextChannel,
  guild: Guild,
  client: Client,
  settings: Settings,
  logger: ReturnType<typeof Logger.getInstance>
): Promise<void> {
  if (!action) return;

  if (action.type === 'step_up') {
    if (action.level === 1) {
      const previousSlowmode = channel.rateLimitPerUser ?? 0;
      await upsertUser({ id: client.user!.id, username: client.user!.username });
      const applied = await runDiscordAction(logger, 'channel.setRateLimitPerUser', { channelId: channel.id, seconds: action.slowmodeSeconds }, () =>
        channel.setRateLimitPerUser(action.slowmodeSeconds)
      );
      if (!applied) {
        // A lock row + public announcement for a slowmode that was never applied would claim the
        // channel is throttled while messages keep flowing.
        return;
      }
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
        .catch(softFail(AppFeature.AntiSpam, 'ANTISPAM_CHANNEL_SEND'));
    } else if (
      !(await runDiscordAction(logger, 'channel.setRateLimitPerUser', { channelId: channel.id, seconds: action.slowmodeSeconds }, () =>
        channel.setRateLimitPerUser(action.slowmodeSeconds)
      ))
    ) {
      return;
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
    await channel
      .setRateLimitPerUser(action.slowmodeSeconds)
      .catch(softFail(AppFeature.AntiSpam, 'ANTISPAM_SLOWMODE_SET', { slowmodeSeconds: action.slowmodeSeconds }));
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
    const restored = await runDiscordAction(logger, 'channel.setRateLimitPerUser', { channelId: channel.id, seconds: previousSlowmode }, () =>
      channel.setRateLimitPerUser(previousSlowmode)
    );
    if (!restored) {
      // Keep the lock row and the in-memory level: dropping both would leave the channel
      // permanently slowmoded with nothing left that knows to restore it.
      return;
    }
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
      .catch(softFail(AppFeature.AntiSpam, 'ANTISPAM_CHANNEL_SEND'));
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
}

/**
 * Records the message toward the channel's rate window and applies whatever slowmode action
 * results (step up, step down, restore). No-op outside guild text channels, when the feature is
 * disabled, or when the channel is already under a manual (non-auto) lock.
 */
export async function enforce(ctx: MessageContext): Promise<void> {
  const { client, message, settings, logger } = ctx;
  if (!settings.featureAutoSlowmodeEnabled || message.channel.type !== ChannelType.GuildText) return;

  const channel = message.channel;
  const action = recordAndCheckSlowmode(channel.id, settings.autoSlowmodeThreshold, settings.autoSlowmodeWindowMs);
  if (!action) return;

  const existingLock = await findLockedChannel(channel.id);
  const isManualLock = existingLock !== null && existingLock.moderatorId !== client.user?.id;
  if (isManualLock) return;

  await applyAutoSlowmodeAction(action, channel, message.guild, client, settings, logger);
}
