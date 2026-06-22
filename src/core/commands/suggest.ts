import {
  ActionRowBuilder,
  ApplicationCommandType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, ProcessExitCode } from '~/settings';
import { getSettings } from '~/database';

export const SUGGESTION_CREATE_MODAL = 'suggestion:create';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Suggestions,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Community],
  middleware: [],
  data: new SlashCommandBuilder().setName('suggest').setDescription('Submit a suggestion for the community to vote on.'),

  async executeCommand(_command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const settings = await getSettings();
    if (!settings.suggestionChannelId) {
      await interaction.reply({
        content: 'The suggestion system is not configured yet. Please contact an administrator.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(SUGGESTION_CREATE_MODAL)
      .setTitle('New Suggestion')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000)
            .setPlaceholder('Describe your suggestion in detail.')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reasoning (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
            .setPlaceholder('Why should this be adopted?')
        )
      );

    await interaction.showModal(modal);
  },
});
