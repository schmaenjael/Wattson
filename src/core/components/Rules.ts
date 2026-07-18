import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

import { BaseEmbed } from '~/core/components/BaseEmbed';
import { assets } from '~/settings';
import { toTitleCase } from '~/utilities';
import { L } from '~/core/locales';

interface RulesEmbedParams {
  title: string;
  footerText: string;
  fieldList: { title: string; categoryIndex: number; content: string; category: string; example: string | null }[];
}

export class RulesEmbed extends BaseEmbed<RulesEmbedParams> {
  public attachments: AttachmentBuilder[] = [assets.volt['banner'].file, assets.volt['256x256'].file];

  render(): EmbedBuilder {
    const { color } = this.required;
    const { title, fieldList, footerText } = this.required;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setImage(assets.volt['banner'].url)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: footerText, iconURL: assets.volt['256x256'].url });

    fieldList
      .sort((a, b) => a.categoryIndex - b.categoryIndex)
      .slice(0, 25)
      .forEach((entry) => {
        const value = `${entry.content}${entry.example ? `\n-# ⇒ ${entry.example}` : ''}`;
        embed.addFields({ name: toTitleCase(entry.title).slice(0, 256), value: value.slice(0, 1024) });
      });

    return embed;
  }
}

type RuleHeaderEmbedParams = object;

export class RuleHeaderEmbed extends BaseEmbed<RuleHeaderEmbedParams> {
  public attachments: AttachmentBuilder[] = [];

  public render(): EmbedBuilder {
    const { color, locale } = this.required;

    return new EmbedBuilder()
      .setTitle(`Volt Europa - Server Rules 💜`)
      .setColor(color)
      .setDescription(
        [`> *${L[locale].UTIL.COMMAND_RULES.EMBED_HEADER_DESCRIPTION_1()}*`, `> *${L[locale].UTIL.COMMAND_RULES.EMBED_HEADER_DESCRIPTION_2()}*`].join(
          '\n'
        )
      )
      .setTimestamp();
  }
}
