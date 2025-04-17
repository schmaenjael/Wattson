import { Events } from 'discord.js';

import { Event, Logger } from '~/models';
import { AppFeature } from '~/constants';

export default new Event({
  name: Events.ClientReady,
  feature: AppFeature.System,
  once: true,
  middleware: [],
  async executeCommand(client, interaction) {
    const logger = Logger.getInstance();

    logger.info(`Ready as ${interaction.user.username}#${interaction.user.discriminator}`);
  },
});
