import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { AppFeature } from '~/settings';

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
