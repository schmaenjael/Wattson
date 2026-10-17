import { Guild } from 'discord.js';

import { Client } from '~/core/models';
import { AppFeature } from '~/settings';
import { logSoftFailure, Logger } from '~/utilities';

const logger = Logger.getInstance(AppFeature.System);

/** Single-server deployment guardrail: leave any guild that isn't process.env.GUILD_ID. */
export const enforceSingleGuild = async (_client: Client, guild: Guild): Promise<void> => {
  const expected = process.env.GUILD_ID;

  if (guild.id === expected) {
    logger.info(`Joined configured guild: ${guild.name} (${guild.id}).`);
    return;
  }

  logger.warn(`Leaving unexpected guild ${guild.name} (${guild.id}); expected ${expected}.`);
  try {
    await guild.leave();
  } catch (error) {
    logSoftFailure(AppFeature.System, 'SYSTEM_UNEXPECTED_GUILD_LEAVE', { guildId: guild.id, guildName: guild.name }, error);
  }
};
