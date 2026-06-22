import { ChannelType, type Guild } from 'discord.js';

import { getActiveUserCount, getMessageCountForDay, StatChannelType } from '~/database';

export const ACTIVE_MEMBER_WINDOW_DAYS = 30;

export const STAT_CHANNEL_LABELS: Record<StatChannelType, string> = {
  [StatChannelType.AllMembers]: 'All Members',
  [StatChannelType.ActiveMembers]: 'Active Members',
  [StatChannelType.TotalRoles]: 'Total Roles',
  [StatChannelType.TextChannels]: 'Text Channels',
  [StatChannelType.MessagesToday]: 'Messages today',
};

export const STAT_CHANNEL_CHOICES: { name: string; value: StatChannelType }[] = Object.values(StatChannelType).map((value) => ({
  name: STAT_CHANNEL_LABELS[value],
  value,
}));

const dayString = (date: Date): string => date.toISOString().slice(0, 10);

export const computeStatValue = async (guild: Guild, statType: StatChannelType): Promise<number> => {
  switch (statType) {
    case StatChannelType.AllMembers:
      return guild.memberCount;
    case StatChannelType.ActiveMembers: {
      const since = dayString(new Date(Date.now() - ACTIVE_MEMBER_WINDOW_DAYS * 24 * 60 * 60 * 1000));
      return getActiveUserCount(since);
    }
    case StatChannelType.TotalRoles:
      return Math.max(0, guild.roles.cache.size - 1);
    case StatChannelType.TextChannels:
      return guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    case StatChannelType.MessagesToday: {
      const yesterday = dayString(new Date(Date.now() - 24 * 60 * 60 * 1000));
      return getMessageCountForDay(yesterday);
    }
  }
};
