import { SlashCommandBuilder, ApplicationCommandType, MessageFlags } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
import { Command, Permission } from '~/core/models';

import { PingEmbed } from '~/core/components';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ping,
  type: ApplicationCommandType.ChatInput,
  middleware: [],
  requiredPermissions: [Permission.Community],
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  async executeCommand(command, client, interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new PingEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: interaction.locale,
      apiLatency: Math.abs(interaction.client.ws.ping),
      serviceLatency: Math.abs(Date.now() - interaction.createdTimestamp),
      serviceUptime: Math.floor(process.uptime()),
    });

    await interaction.editReply({ embeds: [embed.render()], files: embed.attachments });
  },
});
