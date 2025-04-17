import { SlashCommandBuilder, ApplicationCommandType, MessageFlags, EmbedBuilder } from 'discord.js';

import { AppFeature } from '~/constants';
import { Command } from '~/models';

import assets from '~/utilities/assetHandler';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ping,
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  executeCommand: async (client, interaction) => {
    const serviceLatency = Math.abs(Date.now() - interaction.createdTimestamp);
    const serviceUptime = Math.floor(process.uptime());
    const apiLatency = Math.abs(interaction.client.ws.ping);

    try {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        withResponse: true,
        embeds: [
          new EmbedBuilder()
            .setColor(0xc76611)
            .setTitle('Wattson - Constable Pong')
            .setDescription(`> *Ah! A signal most curious — I daresay, the latency is but a fleeting whisper..*`)
            .addFields(
              { name: '🏓 Service Latency', value: `${serviceLatency}ms` },
              { name: '⏰ Service Uptime', value: `${serviceUptime}s` },
              { name: '👩‍💻 API Latency', value: `${apiLatency}ms` }
            )
            .setFooter({ text: 'Wattson, in service for Europe', iconURL: assets.volt['256x256'].url })
            .setTimestamp(),
        ],
        files: [assets.volt['256x256'].file],
      });
    } catch (error) {
      console.log(error);
    }
  },
});
