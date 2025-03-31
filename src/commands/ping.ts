import { SlashCommandBuilder, type Interaction, type CacheType } from 'discord.js';
import { SlashCommand } from '~/models';

const data = new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!');

const execute = async (interaction: Interaction<CacheType>) => {
  await interaction.user.send('Pong!');
};

export default { data, execute } as SlashCommand;
