import { AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

import { BaseEmbed } from '~/core/components/BaseEmbed';
import { assets } from '~/settings';
import { L } from '~/core/locales';

interface ErrorEmbedParams {
  error: Error;
}

export class ErrorEmbed extends BaseEmbed<ErrorEmbedParams> {
  protected branded = true;
  public readonly flags = MessageFlags.Ephemeral;
  public readonly attachments: AttachmentBuilder[] = [assets.volt['256x256'].file];

  protected build(): EmbedBuilder {
    const { locale, error } = this.required;

    return new EmbedBuilder()
      .setTitle(L[locale].SYSTEM.ERROR.EMBED_TITLE())
      .setDescription(`> *${L[locale].SYSTEM.ERROR.EMBED_DESCRIPTION()}*`)
      .addFields({ name: `${L[locale].SYSTEM.ERROR.EMBED_MESSAGE()}`, value: `${error.toString()}`.slice(0, 1024) });
  }
}
