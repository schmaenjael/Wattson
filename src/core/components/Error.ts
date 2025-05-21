import { AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

import { Component, GenericException } from '~/core/models';
import { assets } from '~/settings';
import { L } from '~/core/locales';

interface ErrorEmbedParams {
  error: GenericException;
}

export class ErrorEmbed extends Component<ErrorEmbedParams> {
  public readonly flags = MessageFlags.Ephemeral;
  public readonly attachments: AttachmentBuilder[] = [assets.volt['256x256'].file];

  render(): EmbedBuilder {
    const { color, locale } = this.required;
    const { error } = this.required;

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(L[locale].SYSTEM.ERROR.EMBED_TITLE())
      .setDescription(`> *${L[locale].SYSTEM.ERROR.EMBED_DESCRIPTION()}*`)
      .addFields(
        { name: `${L[locale].SYSTEM.ERROR.EMBED_RECOVERABLE()}`, value: `${error.recoverable}` },
        { name: `${L[locale].SYSTEM.ERROR.EMBED_MESSAGE()}`, value: `${error.toString()}` }
      )
      .setFooter({ text: L[locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
      .setTimestamp();
  }
}
