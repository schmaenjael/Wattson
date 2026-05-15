import { AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

import { Component } from '~/core/models';
import { assets } from '~/settings';
import { L } from '~/core/locales';

interface ReportEmbedParams {
  authorName: string;
  authorIcon: string;
  authorId: string;
  targetChannel: string;
  reporterId: string;
  targetUrl: string;
}

export class ReportEmbed extends Component<ReportEmbedParams> {
  render(): EmbedBuilder {
    const { color, locale } = this.required;
    const { authorName, authorIcon, authorId, targetChannel, reporterId, targetUrl } = this.required;

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(L[locale].MODERATION.REPORT.EMBED_TITLE())
      .setAuthor({ name: authorName.slice(0, 256), iconURL: authorIcon || undefined })
      .addFields(
        { name: `${L[locale].MODERATION.REPORT.EMBED_OFFENDER()}`, value: `<@${authorId}>` },
        { name: `${L[locale].MODERATION.REPORT.EMBED_CHANNEL()}`, value: `<#${targetChannel}>` },
        { name: `${L[locale].MODERATION.REPORT.EMBED_REPORTER()}`, value: `<@${reporterId}>` },
        { name: `${L[locale].MODERATION.REPORT.EMBED_REPORTED_MESSAGE()}`, value: `${targetUrl}` }
      )
      .setFooter({ text: L[locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
      .setTimestamp();
  }
}

interface ReportReceivedEmbedParams {
  authorId: string;
  targetUrl: string;
}

export class ReportReceivedEmbed extends Component<ReportReceivedEmbedParams> {
  public readonly attachments: AttachmentBuilder[] = [assets.volt['256x256'].file];
  public readonly flags = MessageFlags.Ephemeral;

  render(): EmbedBuilder {
    const { color, locale } = this.required;
    const { authorId, targetUrl } = this.required;

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(L[locale].MODERATION.REPORT.EMBED_TITLE())
      .addFields(
        { name: `${L[locale].MODERATION.COMMAND_REPORT.EMBED_REPORTED_MESSAGE()}`, value: `${targetUrl}` },
        { name: `${L[locale].MODERATION.COMMAND_REPORT.EMBED_REPORTED_USER()}`, value: `<@${authorId}>` }
      )
      .setFooter({ text: L[locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
      .setTimestamp();
  }
}
