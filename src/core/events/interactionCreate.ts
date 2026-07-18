import { Events, Interaction } from 'discord.js';

import { AppFeature, Colors } from '~/settings';
import { BotException, Client, Event, Permission } from '~/core/models';
import { ErrorEmbed } from '~/core/components/Error';
import { usePermissions } from '~/core/middleware';
import { Logger } from '~/utilities';
import { handleCourtVote } from '~/core/providers/court';
import { handleGdprButton } from '~/core/providers/gdpr';
import { handleReportButton } from '~/core/providers/report';
import { handleAppealButton, handleAppealModal } from '~/core/providers/appeal';
import { handleSuggestionButton, handleSuggestionModal } from '~/core/providers/suggestions';
import { handleVerifyButton, handleVerifyModal } from '~/core/providers/verification';
import { handleKeepOpenButton, handleMessageModal } from '~/core/providers/modmail';

const MODERATOR: Permission[] = [Permission.Moderation, Permission.Administration];

const dispatchCommand = async (client: Client, interaction: Interaction): Promise<void> => {
  if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

  const logger = Logger.getInstance();
  const command = client.getCommands().get(interaction.commandName);
  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(client, interaction);
  } catch (error) {
    const errorEmbed = new ErrorEmbed({ color: Colors.Red, locale: interaction.locale, error: error as BotException });
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed.render()], files: errorEmbed.attachments, flags: errorEmbed.flags });
    } else {
      await interaction.reply({ embeds: [errorEmbed.render()], files: errorEmbed.attachments, flags: errorEmbed.flags });
    }
  }
};

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.System,
  middleware: [usePermissions],
  routes: [
    { kind: 'command', handler: dispatchCommand },
    {
      kind: 'autocomplete',
      handler: async (client, interaction) => {
        const logger = Logger.getInstance();
        const command = client.getCommands().get(interaction.commandName);
        if (!command?.options.autocomplete) return;
        try {
          await command.options.autocomplete(client, interaction);
        } catch (error) {
          logger.error(Object(error), `Autocomplete error for command ${interaction.commandName}`);
        }
      },
    },
    { kind: 'button', name: 'court_vote', rights: MODERATOR, handler: handleCourtVote },
    { kind: 'button', name: 'gdpr', rights: MODERATOR, handler: handleGdprButton },
    { kind: 'button', name: 'report', rights: MODERATOR, handler: handleReportButton },
    { kind: 'button', name: 'appeal', rights: MODERATOR, handler: handleAppealButton },
    { kind: 'button', name: 'suggestion', handler: handleSuggestionButton },
    { kind: 'button', name: 'verify', handler: handleVerifyButton },
    { kind: 'button', name: 'modmail_keep_open', handler: handleKeepOpenButton },
    { kind: 'modal', name: 'appeal', handler: handleAppealModal },
    { kind: 'modal', name: 'suggestion', handler: handleSuggestionModal },
    { kind: 'modal', name: 'verify', handler: handleVerifyModal },
    { kind: 'modal', name: 'modmail_msg', handler: handleMessageModal },
  ],
});
