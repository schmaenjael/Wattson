import { Events, MessageFlags } from 'discord.js';

import { Event, Logger } from '~/models';
import { AppFeature } from '~/constants';

import { usePermissions } from '~/middleware';

export default new Event({
  name: Events.InteractionCreate,
  feature: AppFeature.System,
  middleware: [usePermissions],
  async executeCommand(client, interaction) {
    if (!interaction.isChatInputCommand()) return;

    const logger = Logger.getInstance();
    const command = client.getCommands().get(interaction.commandName);

    if (!command) return logger.error(`No command matching ${interaction.commandName} was found.`);

    try {
      await command.execute(client, interaction);
    } catch (error) {
      logger.error(Object(error), `Encountered an error while executing ${interaction.commandName}`);
      if (interaction.replied || interaction.deferred)
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      else
        await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    }
  },
});
