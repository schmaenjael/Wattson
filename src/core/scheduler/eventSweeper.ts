import { CronExpressionParser } from 'cron-parser';
import { EmbedBuilder, TextChannel } from 'discord.js';

import { Client } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { Logger } from '~/utilities';
import {
  getSettings,
  updateSettings,
  listAnnouncableEvents,
  listEventsInRange,
  listRegistrationsForEvent,
  setAnnouncedAt,
  createEvent,
  findNextRepeatInstance,
} from '~/database';

const POLL_INTERVAL_MS = 600_000;
const ANNOUNCEMENT_WINDOW_MS = 60 * 60 * 1000;

const logger = Logger.getInstance(AppFeature.Events);

const ts = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;

const announceEvent = async (client: Client, settings: Awaited<ReturnType<typeof getSettings>>) => {
  const upcoming = await listAnnouncableEvents(ANNOUNCEMENT_WINDOW_MS);
  if (upcoming.length === 0) return;

  for (const event of upcoming) {
    try {
      const registrations = await listRegistrationsForEvent(event.id);
      const pings = registrations.length > 0 ? registrations.map((r) => `<@${r.userId}>`).join(' ') : '';
      const color = appFeatureMap[AppFeature.Events].color;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`📅 ${event.name}`)
        .setDescription(event.description)
        .addFields({ name: 'When', value: ts(event.scheduledAt), inline: true }, { name: 'ID', value: `\`${event.id}\``, inline: true });

      if (event.textChannelId) {
        embed.addFields({ name: 'Channel', value: `<#${event.textChannelId}>`, inline: true });
      }
      if (event.voiceChannelId) {
        embed.addFields({ name: 'Voice', value: `<#${event.voiceChannelId}>`, inline: true });
      }

      const payload = { content: registrations.length > 0 ? `📣 **Event starting soon!** ${pings}` : '📣 **Event starting soon!**', embeds: [embed] };

      const sentChannels = new Set<string>();

      if (settings.eventAnnouncementChannelId) {
        try {
          const ch = (await client.channels.fetch(settings.eventAnnouncementChannelId)) as TextChannel;
          await ch.send(payload);
          sentChannels.add(settings.eventAnnouncementChannelId);
        } catch (err) {
          logger.error(Object(err), `Failed to send announcement to eventAnnouncementChannelId for event ${event.id}`);
        }
      }

      if (event.textChannelId && !sentChannels.has(event.textChannelId)) {
        try {
          const ch = (await client.channels.fetch(event.textChannelId)) as TextChannel;
          await ch.send(payload);
        } catch (err) {
          logger.error(Object(err), `Failed to send announcement to textChannelId for event ${event.id}`);
        }
      }

      await setAnnouncedAt(event.id);
      logger.info({ eventId: event.id }, 'Event announced');

      if (event.cronPattern) {
        const existing = await findNextRepeatInstance(event.id);
        if (!existing) {
          try {
            const parsed = CronExpressionParser.parse(event.cronPattern, { currentDate: event.scheduledAt });
            const nextDate = parsed.next().toDate();
            const rootId = event.parentEventId ?? event.id;
            await createEvent({
              creatorId: event.creatorId,
              name: event.name,
              description: event.description,
              scheduledAt: nextDate,
              textChannelId: event.textChannelId ?? undefined,
              voiceChannelId: event.voiceChannelId ?? undefined,
              cronPattern: event.cronPattern,
              parentEventId: rootId,
            });
            logger.info({ eventId: event.id, nextDate }, 'Next recurring event created');
          } catch (err) {
            logger.error(Object(err), `Failed to create next recurring instance for event ${event.id}`);
          }
        }
      }
    } catch (err) {
      logger.error(Object(err), `Error processing event ${event.id}`);
    }
  }
};

const weeklyDigest = async (client: Client, settings: Awaited<ReturnType<typeof getSettings>>) => {
  const now = new Date();
  if (now.getUTCDay() !== 1 || now.getUTCHours() !== 7) return;

  const lastDigest = settings.lastEventDigestAt;
  if (lastDigest) {
    const lastMonday = new Date(now);
    lastMonday.setUTCHours(0, 0, 0, 0);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - lastMonday.getUTCDay() + 1);
    if (lastDigest >= lastMonday) return;
  }

  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = await listEventsInRange(now, weekEnd);

  if (!settings.eventAnnouncementChannelId) {
    logger.warn('Weekly digest skipped: eventAnnouncementChannelId not set');
    await updateSettings({ lastEventDigestAt: now });
    return;
  }

  const color = appFeatureMap[AppFeature.Events].color;
  const embed = new EmbedBuilder().setColor(color).setTitle('📅 Events This Week').setTimestamp();

  if (events.length === 0) {
    embed.setDescription('No events scheduled for the next 7 days.');
  } else {
    embed.setDescription(events.map((e) => `**${e.name}** — ${ts(e.scheduledAt)} · ID \`${e.id}\``).join('\n'));
  }

  try {
    const ch = (await client.channels.fetch(settings.eventAnnouncementChannelId)) as TextChannel;
    await ch.send({ embeds: [embed] });
    logger.info({ count: events.length }, 'Weekly event digest sent');
  } catch (err) {
    logger.error(Object(err), 'Failed to send weekly event digest');
  }

  await updateSettings({ lastEventDigestAt: now });
};

export const startEventSweeper = (client: Client) => {
  const sweep = async () => {
    try {
      const settings = await getSettings();
      await announceEvent(client, settings);
      await weeklyDigest(client, settings);
    } catch (err) {
      logger.error(Object(err), 'Event sweeper failed');
    }
  };

  sweep();
  return setInterval(sweep, POLL_INTERVAL_MS);
};
