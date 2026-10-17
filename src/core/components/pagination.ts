import {
  EmbedBuilder,
  ComponentType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  InteractionDeferReplyOptions,
  BaseMessageOptions,
  MessageFlags,
} from 'discord.js';
import { BotException } from '~/core/models';
import { L } from '~/core/locales';
import { AppFeature } from '~/settings';
import { softFail } from '~/utilities';

export const handlePaginatedEmbeds = async (
  embeds: EmbedBuilder[],
  interaction: ChatInputCommandInteraction<CacheType>,
  options: InteractionDeferReplyOptions & BaseMessageOptions,
  duration: number = 300_000
) => {
  if (embeds.length === 0) throw new BotException(interaction.client, 'No embeds to paginate');

  const message = await interaction.deferReply(options);
  let currentPage = 0;

  const updatePaginationButtons = () => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('⏮️ Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('Next ⏭️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === embeds.length - 1)
    );
  };

  try {
    await interaction.editReply({ embeds: [embeds[currentPage]], components: [updatePaginationButtons()], files: options.files });

    message
      .createMessageComponentCollector({ componentType: ComponentType.Button, time: duration })
      .on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          // Someone else clicking another member's paginator is normal, not an error — no BotException, no error log.
          return i.reply({ content: L[i.locale].GENERAL.COMMAND_PAGINATION_NOT_OWNER(), flags: MessageFlags.Ephemeral });
        }

        if (i.customId === 'prev' && currentPage > 0) currentPage--;
        if (i.customId === 'next' && currentPage < embeds.length - 1) currentPage++;

        await i.update({ embeds: [embeds[currentPage]], components: [updatePaginationButtons()] });
      })
      .on('end', async () => await message.edit({ components: [] }).catch(softFail(AppFeature.System, 'PAGINATION_COMPONENT_STRIP')));
  } catch (error) {
    throw new BotException(interaction.client, 'Failed to handle paginated embeds', error);
  }
};
