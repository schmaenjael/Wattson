import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { handleReactionAdd } from '~/core/providers/starboard';

export default new Event({
  type: Events.MessageReactionAdd,
  feature: AppFeature.System,
  middleware: [],
  async executeCommand(event, client, reaction) {
    try {
      await handleReactionAdd(client, reaction);
    } catch (err) {
      Logger.getInstance(AppFeature.System).error(Object(err), 'Starboard handler failed');
    }
  },
});
