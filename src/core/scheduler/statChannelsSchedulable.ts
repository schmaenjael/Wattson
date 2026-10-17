import { ChannelType } from 'discord.js';

import { AppFeature } from '~/settings';
import { getConfig, listStatChannels } from '~/config';
import { Schedulable } from '~/core/models/Schedulable';
import { type StatChannelType } from '~/database';
import { computeStatValue, STAT_CHANNEL_LABELS } from '~/core/providers/statChannels';
import { logSoftFailure, softFail } from '~/utilities';

export const statChannelsSchedulable = new Schedulable({
  name: 'stat-channels-schedulable',
  feature: AppFeature.Analytics,
  description: 'Updates configured voice-channel names with daily server statistics.',
  defaultCron: () => getConfig().config.schedules.statChannels,
  execute: async (client, logger) => {
    if (!getConfig().config.features.statChannels) return;

    const mappings = await listStatChannels();
    if (mappings.length === 0) {
      return;
    }

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(softFail(AppFeature.Stats, 'STATS_GUILD_FETCH'));
    if (!guild) {
      logger.error('Stat channels: guild not found; skipping this tick.');
      return;
    }

    let updated = 0;
    for (const mapping of mappings) {
      const statType = mapping.statType as StatChannelType;
      try {
        const channel = await guild.channels
          .fetch(mapping.channelId)
          .catch(softFail(AppFeature.Stats, 'STATS_CHANNEL_FETCH', { channelId: mapping.channelId }));
        if (!channel || channel.type !== ChannelType.GuildVoice) {
          logger.warn({ channelId: mapping.channelId, statType }, 'Stat channel missing or not a voice channel; skipping.');
          continue;
        }

        const value = await computeStatValue(guild, statType);
        const name = `${STAT_CHANNEL_LABELS[statType]}: ${value.toLocaleString('en')}`;
        if (channel.name === name) {
          continue;
        }

        await channel.setName(name);
        updated++;
      } catch (err) {
        logSoftFailure(AppFeature.Stats, 'STATS_CHANNEL_RENAME', { channelId: mapping.channelId, statType }, err);
      }
    }

    return `Updated ${updated} of ${mappings.length} stat channel(s).`;
  },
});
