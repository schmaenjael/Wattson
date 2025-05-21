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
} from 'discord.js';
import { FatalException, RecoverableException } from '../models';
import { ErrorEmbed } from './Error';
import { Colors } from '~/settings';

export const handlePaginatedEmbeds = async (
  embeds: EmbedBuilder[],
  interaction: ChatInputCommandInteraction<CacheType>,
  options: InteractionDeferReplyOptions & BaseMessageOptions,
  duration: number = 300_000
) => {
  if (embeds.length === 0) throw new RecoverableException(interaction.client, 'No embeds to paginate');

  const message = await interaction.deferReply(options);
  let currentPage = 0;

  const getButtons = () =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
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

  try {
    await interaction.editReply({ embeds: [embeds[currentPage]], components: [getButtons()], files: options.files });

    message
      .createMessageComponentCollector({ componentType: ComponentType.Button, time: duration })
      .on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          const errorEmbed = new ErrorEmbed({
            color: Colors.Red,
            locale: interaction.locale,
            error: new RecoverableException(interaction.client, 'Unauthorized interaction'),
          });
          return i.reply({ embeds: [errorEmbed.render()], files: errorEmbed.attachments, flags: errorEmbed.flags });
        }

        if (i.customId === 'prev' && currentPage > 0) currentPage--;
        if (i.customId === 'next' && currentPage < embeds.length - 1) currentPage++;

        await i.update({ embeds: [embeds[currentPage]], components: [getButtons()] });
      })
      .on('end', async () => await message.edit({ components: [] }));
  } catch (error) {
    throw new FatalException(interaction.client, 'Failed to handle paginated embeds', error);
  }
};
