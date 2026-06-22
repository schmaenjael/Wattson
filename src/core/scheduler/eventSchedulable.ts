import { Cron } from 'croner';
import { EmbedBuilder, TextChannel } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
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
import { Schedulable } from '~/core/models/Schedulable';
import { Client } from '~/core/models/Client';
import { Logger } from '~/utilities';

const ts = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;

const announceEvent = async (client: Client, settings: Awaited<ReturnType<typeof getSettings>>, logger: Logger) => {
  const ANNOUNCEMENT_WINDOW_MS = 60 * 60 * 1000;
  const upcoming = await listAnnouncableEvents(ANNOUNCEMENT_WINDOW_MS);
  if (upcoming.length === 0) {
    return 0;
  }

  const color = appFeatureMap[AppFeature.Events].color;

  for (const event of upcoming) {
    try {
      const registrations = await listRegistrationsForEvent(event.id);
      const pings = registrations.length > 0 ? registrations.map((r) => `<@${r.userId}>`).join(' ') : '';

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
        const rootId = event.parentEventId ?? event.id;
        const existing = await findNextRepeatInstance(rootId);
        if (!existing) {
          try {
            const nextDate = new Cron(event.cronPattern).nextRun(new Date(event.scheduledAt.getTime() + 1));
            if (!nextDate) {
              continue;
            }
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

  return upcoming.length;
};

const weeklyDigest = async (client: Client, settings: Awaited<ReturnType<typeof getSettings>>, logger: Logger) => {
  const now = new Date();
  if (now.getUTCDay() !== 1 || now.getUTCHours() !== 7) {
    return false;
  }

  const lastDigest = settings.lastEventDigestAt;
  if (lastDigest) {
    const lastMonday = new Date(now);
    lastMonday.setUTCHours(0, 0, 0, 0);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - lastMonday.getUTCDay() + 1);
    if (lastDigest >= lastMonday) {
      return false;
    }
  }

  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = await listEventsInRange(now, weekEnd);

  if (!settings.eventAnnouncementChannelId) {
    logger.warn('Weekly digest skipped: eventAnnouncementChannelId not set');
    await updateSettings({ lastEventDigestAt: now });
    return false;
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
  return true;
};

export const eventSchedulable = new Schedulable({
  name: 'event-schedulable',
  feature: AppFeature.Events,
  description: 'Announces upcoming events and sends weekly digests.',
  defaultCron: '*/10 * * * *',
  execute: async (client, logger) => {
    const settings = await getSettings();
    const announced = await announceEvent(client, settings, logger);
    const digest = await weeklyDigest(client, settings, logger);

    if (!announced && !digest) {
      return;
    }
    const parts: string[] = [];
    if (announced) {
      parts.push(`Announced ${announced} event(s).`);
    }
    if (digest) {
      parts.push('Sent weekly digest.');
    }
    return parts.join(' ');
  },
});
