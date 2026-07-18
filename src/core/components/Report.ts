import { AttachmentBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

import { BaseEmbed } from '~/core/components/BaseEmbed';
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

export class ReportEmbed extends BaseEmbed<ReportEmbedParams> {
  render(): EmbedBuilder {
    const { color, locale } = this.required;
    const { authorName, authorIcon, authorId, targetChannel, reporterId, targetUrl } = this.required;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(L[locale].MODERATION.REPORT.EMBED_TITLE())
      .setAuthor({ name: authorName.slice(0, 256), iconURL: authorIcon || undefined })
      .addFields(
        { name: `${L[locale].MODERATION.REPORT.EMBED_OFFENDER()}`, value: `<@${authorId}>` },
        { name: `${L[locale].MODERATION.REPORT.EMBED_CHANNEL()}`, value: `<#${targetChannel}>` },
        { name: `${L[locale].MODERATION.REPORT.EMBED_REPORTER()}`, value: `<@${reporterId}>` },
        { name: `${L[locale].MODERATION.REPORT.EMBED_REPORTED_MESSAGE()}`, value: `${targetUrl}` }
      );

    return this.withBranding(embed);
  }
}

interface ReportReceivedEmbedParams {
  authorId: string;
  targetUrl: string;
}

export class ReportReceivedEmbed extends BaseEmbed<ReportReceivedEmbedParams> {
  public readonly attachments: AttachmentBuilder[] = [assets.volt['256x256'].file];
  public readonly flags = MessageFlags.Ephemeral;

  render(): EmbedBuilder {
    const { color, locale } = this.required;
    const { authorId, targetUrl } = this.required;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(L[locale].MODERATION.REPORT.EMBED_TITLE())
      .addFields(
        { name: `${L[locale].MODERATION.COMMAND_REPORT.EMBED_REPORTED_MESSAGE()}`, value: `${targetUrl}` },
        { name: `${L[locale].MODERATION.COMMAND_REPORT.EMBED_REPORTED_USER()}`, value: `<@${authorId}>` }
      );

    return this.withBranding(embed);
  }
}
