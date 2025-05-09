import { SlashCommandBuilder, ApplicationCommandType, MessageFlags, EmbedBuilder } from 'discord.js';

import { assets, appFeatureMap, AppFeature } from '~/settings';
import { Command } from '~/core/models';
import { Logger } from '~/utilities';

import { L } from '~/core/locales';
import { SmallRowPadding } from '~/core/components/padding';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ping,
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  async executeCommand(command, client, interaction) {
    const logger = Logger.getInstance(AppFeature.Ping);
    const serviceLatency = Math.abs(Date.now() - interaction.createdTimestamp);
    const serviceUptime = Math.floor(process.uptime());
    const apiLatency = Math.abs(interaction.client.ws.ping);

    try {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        withResponse: true,
        embeds: [
          new EmbedBuilder()
            .setColor(appFeatureMap[command.options.feature].color)
            .setTitle(L[interaction.locale].UTIL.COMMAND_PING.EMBED_TITLE())
            .setDescription(`> *${L[interaction.locale].UTIL.COMMAND_PING.EMBED_DESCRIPTION()}*`)
            .addFields(
              SmallRowPadding,
              { name: `🏓 ${L[interaction.locale].SYSTEM.STATUS.SERVICE_LATENCY()}`, value: `${serviceLatency}ms` },
              { name: `⏰ ${L[interaction.locale].SYSTEM.STATUS.SERVICE_UPTIME()}`, value: `${serviceUptime}s` },
              { name: `👩‍💻 ${L[interaction.locale].SYSTEM.STATUS.API_LATENCY()}`, value: `${apiLatency}ms` },
              SmallRowPadding
            )
            .setFooter({ text: L[interaction.locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
            .setTimestamp(),
        ],
        files: [assets.volt['256x256'].file],
      });
      logger.info(
        `${interaction.user.username} executed ${interaction.commandName} at ${new Date().toISOString()}, localized as ${interaction.locale}.`
      );
    } catch (error) {
      logger.error(
        `Encountered an error while executing ${interaction.commandName} for ${interaction.user.username} at ${new Date().toISOString()}: ${error}`
      );
    }
  },
});
