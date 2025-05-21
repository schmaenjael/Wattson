import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

import { Component } from '~/core/models';
import { assets } from '~/settings';
import { Utils } from '~/utilities';
import { L } from '~/core/locales';

interface RulesEmbedParams {
  title: string;
  footerText: string;
  fieldList: { title: string; categoryIndex: number; content: string; category: string; example: string | null }[];
}

export class RulesEmbed extends Component<RulesEmbedParams> {
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
      .forEach((entry) => {
        embed.addFields({ name: Utils.toTitleCase(entry.title), value: `${entry.content}${entry.example ? `\n-# ⇒ ${entry.example}` : ''}` });
      });

    return embed;
  }
}

interface RuleHeaderEmbedParams {}

export class RuleHeaderEmbed extends Component<RuleHeaderEmbedParams> {
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
