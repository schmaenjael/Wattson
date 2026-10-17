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
import { useFeatureFlag } from '~/core/middleware';
import { AppFeature } from '~/settings';
import { findAppealableBan, upsertUser } from '~/database';
import { L } from '~/core/locales';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Appeal,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [],
  allowDM: true,
  dmOnly: true,
  middleware: [useFeatureFlag('featureAppealEnabled')],
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Submit a ban appeal.')
    .setContexts([InteractionContextType.BotDM, InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),

  async executeCommand(_command, _client, interaction) {
    await upsertUser({ id: interaction.user.id, username: interaction.user.username });

    const T = L[interaction.locale].MODERATION.APPEAL;

    const ban = await findAppealableBan(interaction.user.id);
    if (!ban) {
      await interaction.reply({ content: T.NO_APPEALABLE_BAN(), flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`appeal:submit:${ban.id}`)
      .setTitle(T.MODAL_TITLE())
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('email')
            .setLabel(T.MODAL_EMAIL_LABEL())
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(256)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel(T.MODAL_REASON_LABEL())
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(T.MODAL_REASON_PLACEHOLDER())
            .setRequired(true)
            .setMaxLength(2000)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('other')
            .setLabel(T.MODAL_OTHER_LABEL())
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
        )
      );

    await interaction.showModal(modal);
  },
});
