import { Events, MessageFlags } from 'discord.js';

import { usePermissions } from '~/core/middleware';
import { AppFeature, Colors } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { RecoverableException } from '~/core/models/Exceptions';
import { ErrorEmbed } from '~/core/components/Error';

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.System,
  middleware: [usePermissions],
  async executeCommand(event, client, interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

    const logger = Logger.getInstance();
    const command = client.getCommands().get(interaction.commandName);

    if (!command) return logger.error(`No command matching ${interaction.commandName} was found.`);

    try {
      await command.execute(client, interaction);
    } catch (error) {
      const errorEmbed = new ErrorEmbed({ color: Colors.Red, locale: interaction.locale, error: error as RecoverableException });
      if (interaction.replied || interaction.deferred)
        await interaction.followUp({ embeds: [errorEmbed.render()], files: errorEmbed.attachments, flags: errorEmbed.flags });
      else await interaction.reply({ embeds: [errorEmbed.render()], files: errorEmbed.attachments, flags: errorEmbed.flags });
    }
  },
});
