import {
  ActionRowBuilder,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { Command } from '~/core/models';
import { AppFeature, ProcessExitCode } from '~/settings';
import { findAppealableBan, upsertUser } from '~/database';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Appeal,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [],
  allowDM: true,
  dmOnly: true,
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Submit a ban appeal.')
    .setContexts([InteractionContextType.BotDM, InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),

  async executeCommand(_command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    await upsertUser({ id: interaction.user.id, username: interaction.user.username });

    const ban = await findAppealableBan(interaction.user.id);
    if (!ban) {
      await interaction.reply({
        content: 'You do not have an active appealable ban, or your appeal has already been submitted.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`appeal:submit:${ban.id}`)
      .setTitle('Ban Appeal')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('email')
            .setLabel('Your e-mail address')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(256)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Why should you be unbanned?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
              'You can write here why you should be unbanned. This can be either 1) how you think the ban is unjustified and wrong or 2) that you changed your views. Please elaborate using convincing arguments.'
            )
            .setRequired(true)
            .setMaxLength(2000)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('other')
            .setLabel('Anything else you want to tell us?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
        )
      );

    await interaction.showModal(modal);
  },
});
