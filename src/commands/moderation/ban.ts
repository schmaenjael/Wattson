import { ChatInputCommandInteraction, CacheType } from 'discord.js';

import { MessageFlags } from 'discord.js';

const execute = async (interaction: ChatInputCommandInteraction<CacheType>) => {
  await interaction.reply({ content: `A ban would have happened with parameters`, flags: MessageFlags.Ephemeral });
};

export default { data: null, execute };
