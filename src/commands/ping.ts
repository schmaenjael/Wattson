import { SlashCommandBuilder, type ChatInputCommandInteraction, type CacheType } from 'discord.js';
import { SlashCommand } from '~/models';

const data = new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!');

const execute = async (interaction: ChatInputCommandInteraction<CacheType>) => {
  await interaction.reply('Pong!');
};

export default { data, execute } as SlashCommand;
