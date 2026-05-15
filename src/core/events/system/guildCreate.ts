import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

/**
 * Single-server deployment guardrail. If the bot is added to any guild that
 * doesn't match process.env.GUILD_ID, it leaves immediately.
 */
export default new Event({
  type: Events.GuildCreate,
  feature: AppFeature.System,
  middleware: [],
  async executeCommand(event, client, guild) {
    const logger = Logger.getInstance(AppFeature.System);
    const expected = process.env.GUILD_ID;

    if (guild.id === expected) {
      logger.info(`Joined configured guild: ${guild.name} (${guild.id}).`);
      return;
    }

    logger.warn(`Leaving unexpected guild ${guild.name} (${guild.id}); expected ${expected}.`);
    try {
      await guild.leave();
    } catch (error) {
      logger.error(Object(error), `Failed to leave unexpected guild ${guild.id}.`);
    }
  },
});
