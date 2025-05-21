import { SlashCommandBuilder, ApplicationCommandType, MessageFlags } from 'discord.js';

import { appFeatureMap, AppFeature } from '~/settings';
import { Command } from '~/core/models';

import { PingEmbed } from '~/core/components';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ping,
  type: ApplicationCommandType.ChatInput,
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  async executeCommand(command, client, interaction) {
    const embed = new PingEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: interaction.locale,
      apiLatency: Math.abs(interaction.client.ws.ping),
      serviceLatency: Math.abs(Date.now() - interaction.createdTimestamp),
      serviceUptime: Math.floor(process.uptime()),
    });

    await interaction.reply({ flags: MessageFlags.Ephemeral, withResponse: true, embeds: [embed.render()], files: embed.attachments });
  },
});
