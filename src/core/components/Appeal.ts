import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { BaseEmbed } from '~/core/components/BaseEmbed';
import { Colors } from '~/settings';
import { L, baseLocale } from '~/core/locales';
import { discordTimestamp } from '~/utilities';

const T = L[baseLocale].MODERATION.APPEAL;

interface AppealEmbedParams {
  userId: string;
  accountCreatedTs: number;
  avatarUrl: string;
  email: string;
  reason: string;
  other: string | null;
  banReason: string;
  banCreatedAt: Date;
  appealId: number;
  voteCount: number;
  threshold: number;
}

export class AppealEmbed extends BaseEmbed<AppealEmbedParams> {
  constructor(params: AppealEmbedParams) {
    super({ ...params, color: Colors.Blue, locale: baseLocale });
  }

  render(): EmbedBuilder {
    const { userId, accountCreatedTs, avatarUrl, email, reason, other, banReason, banCreatedAt, appealId, voteCount, threshold } = this.required;

    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(T.EMBED_TITLE())
      .setDescription(T.EMBED_DESCRIPTION({ userId }))
      .setThumbnail(avatarUrl)
      .addFields(
        { name: T.FIELD_APPELLANT(), value: `<@${userId}>\n\`${userId}\``, inline: true },
        { name: T.FIELD_ACCOUNT_CREATED(), value: `<t:${Math.floor(accountCreatedTs / 1000)}:D>`, inline: true },
        { name: '​', value: '​', inline: true },
        { name: T.FIELD_EMAIL(), value: email, inline: false },
        { name: T.FIELD_REASON(), value: reason.slice(0, 1024), inline: false }
      );

    if (other) {
      embed.addFields({ name: T.FIELD_ADDITIONAL(), value: other.slice(0, 1024), inline: false });
    }

    embed.addFields(
      { name: T.FIELD_ORIGINAL_BAN(), value: banReason.slice(0, 1024), inline: false },
      { name: T.FIELD_BANNED(), value: `${discordTimestamp(banCreatedAt, 'R')}`, inline: true },
      { name: T.FIELD_APPROVALS(), value: `${voteCount}/${threshold}`, inline: true }
    );

    return embed.setFooter({ text: T.FOOTER({ appealId }) }).setTimestamp();
  }
}

export const buildAppealVoteRow = (appealId: number, voteCount: number, threshold: number): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`appeal:approve:${appealId}`).setLabel(T.BUTTON_APPROVE({ voteCount, threshold })).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`appeal:deny:${appealId}`).setLabel(T.BUTTON_DENY()).setStyle(ButtonStyle.Danger)
  );
