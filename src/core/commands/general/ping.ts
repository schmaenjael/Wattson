import { SlashCommandBuilder, ApplicationCommandType, MessageFlags, EmbedBuilder } from 'discord.js';

import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';
import { Command } from '~/core/models';
import L from '~/core/locales/i18n-node';

import { assets, appFeatureMap } from '~/settings';
import { detectLocale } from '~/core/locales';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Ping,
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  async executeCommand(command, client, interaction) {
    const locale = detectLocale(interaction.locale);

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
            .setTitle(L[locale].UTIL.PING.RESPONSE_TITLE())
            .setDescription(`> *${L[locale].UTIL.PING.RESPONSE_DESCRIPTION()}*`)
            .addFields(
              { name: `🏓 ${L[locale].UTIL.PING.RESPONSE_FIELD_SERVICE_LATENCY()}`, value: `${serviceLatency}ms` },
              { name: `⏰ ${L[locale].UTIL.PING.RESPONSE_FIELD_SERVICE_UPTIME()}`, value: `${serviceUptime}s` },
              { name: `👩‍💻 ${L[locale].UTIL.PING.RESPONSE_FIELD_API_LATENCY()}`, value: `${apiLatency}ms` }
            )
            .setFooter({ text: L[locale].GENERAL.EMBED_FOOTER_TEXT(), iconURL: assets.volt['256x256'].url })
            .setTimestamp(),
        ],
        files: [assets.volt['256x256'].file],
      });
      Logger.getInstance(AppFeature.Ping).info(
        `<${interaction.user.username}> executed ${interaction.commandName} at ${new Date().toISOString()} lang: ${locale}.`
      );
    } catch (error) {
      console.log(error);
    }
  },
});
