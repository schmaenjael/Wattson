import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

import { Component } from '~/core/models';
import { assets } from '~/settings';
import { L } from '~/core/locales';

interface PingEmbedParams {
  serviceLatency: number;
  serviceUptime: number;
  apiLatency: number;
}

export class PingEmbed extends Component<PingEmbedParams> {
  public attachments: AttachmentBuilder[] = [assets.volt['256x256'].file];

  render(): EmbedBuilder {
    const { color, locale } = this.required;
    const { serviceLatency, serviceUptime, apiLatency } = this.required;

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(L[locale].UTIL.COMMAND_PING.EMBED_TITLE())
      .setDescription(`> *${L[locale].UTIL.COMMAND_PING.EMBED_DESCRIPTION()}*`)
      .addFields(
        { name: `🏓 ${L[locale].SYSTEM.STATUS.SERVICE_LATENCY()}`, value: `${serviceLatency}ms` },
        { name: `⏰ ${L[locale].SYSTEM.STATUS.SERVICE_UPTIME()}`, value: `${serviceUptime}s` },
        { name: `👩‍💻 ${L[locale].SYSTEM.STATUS.API_LATENCY()}`, value: `${apiLatency}ms` }
      )
      .setFooter({ text: L[locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
      .setTimestamp();
  }
}
