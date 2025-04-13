import { Event, Events } from '~/models/Event';
import { AppFeature, SystemCategories } from '~/constants';

import { Logger } from '~/models/Logger';

export default new Event({
  name: Events.ClientReady,
  feature: AppFeature.System,
  once: true,
  enabled: true,
  middleware: [],
  async execute(client, readyClient) {
    const logger = Logger.getInstance();

    logger.info(`Ready as ${readyClient.user.username}#${readyClient.user.discriminator}`);
  },
});
