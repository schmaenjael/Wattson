import { ApplicationCommandType, MessageFlags } from 'discord.js';

import type { MiddlewareFunction } from '~/core/types';
import { L } from '~/core/locales';

export const useGuildOnlyChatInput: MiddlewareFunction<ApplicationCommandType.ChatInput> = async (command, client, interaction) => {
  if (interaction.guildId) return;
  return await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_INVALID_IN_DMS(), flags: MessageFlags.Ephemeral });
};

export const useGuildOnlyMessageCommand: MiddlewareFunction<ApplicationCommandType.Message> = async (command, client, interaction) => {
  if (interaction.guildId) return;
  return await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_INVALID_IN_DMS(), flags: MessageFlags.Ephemeral });
};
