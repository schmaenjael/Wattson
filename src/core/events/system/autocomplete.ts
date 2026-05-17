import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.System,
  middleware: [],
  async executeCommand(_event, client, interaction) {
    if (!interaction.isAutocomplete()) return;

    const logger = Logger.getInstance();
    const command = client.getCommands().get(interaction.commandName);

    if (!command) return logger.error(`No command matching ${interaction.commandName} was found.`);

    if (!command.options.autocomplete) return;

    try {
      await command.options.autocomplete(client, interaction);
    } catch (error) {
      logger.error(Object(error), `Autocomplete error for command ${interaction.commandName}`);
    }
  },
});
