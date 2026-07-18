import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type HexColorString, type User } from 'discord.js';

import { BaseEmbed } from '~/core/components/BaseEmbed';
import type { Suggestion, SuggestionVoteTally } from '~/database';
import { SuggestionStatus } from '~/database';
import { Colors } from '~/settings';
import { baseLocale } from '~/core/locales';

export const SUGGESTION_UPVOTE = '👍';
export const SUGGESTION_DOWNVOTE = '👎';

export const SUGGESTION_VOTE_UP_PREFIX = 'suggestion:vote:up:';
export const SUGGESTION_VOTE_DOWN_PREFIX = 'suggestion:vote:down:';

const ZERO_TALLY: SuggestionVoteTally = { upvotes: 0, downvotes: 0 };

export const buildSuggestionVoteRow = (suggestion: Suggestion, tally = ZERO_TALLY, resolved = false): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SUGGESTION_VOTE_UP_PREFIX}${suggestion.id}`)
      .setEmoji(SUGGESTION_UPVOTE)
      .setLabel(String(tally.upvotes))
      .setStyle(ButtonStyle.Success)
      .setDisabled(resolved),
    new ButtonBuilder()
      .setCustomId(`${SUGGESTION_VOTE_DOWN_PREFIX}${suggestion.id}`)
      .setEmoji(SUGGESTION_DOWNVOTE)
      .setLabel(String(tally.downvotes))
      .setStyle(ButtonStyle.Danger)
      .setDisabled(resolved)
  );

const STATUS_COLORS: Record<SuggestionStatus, HexColorString> = {
  [SuggestionStatus.Open]: Colors.Blue,
  [SuggestionStatus.InConsideration]: Colors.Yellow,
  [SuggestionStatus.Accepted]: Colors.Green,
  [SuggestionStatus.Declined]: Colors.Red,
};

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  [SuggestionStatus.Open]: '🟦 Open — voting',
  [SuggestionStatus.InConsideration]: '🟨 In consideration',
  [SuggestionStatus.Accepted]: '✅ Accepted',
  [SuggestionStatus.Declined]: '❌ Declined',
};

interface SuggestionEmbedParams {
  suggestion: Suggestion;
  author: User | null;
  declineReason?: string | null;
  tally?: SuggestionVoteTally;
}

/** Public-facing suggestion embed posted in the suggestion channel and edited as the suggestion progresses. */
export class SuggestionEmbed extends BaseEmbed<SuggestionEmbedParams> {
  constructor(params: SuggestionEmbedParams) {
    super({ ...params, color: STATUS_COLORS[params.suggestion.status as SuggestionStatus], locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { suggestion, author, declineReason, tally = ZERO_TALLY } = this.required;
    const status = suggestion.status as SuggestionStatus;
    const net = tally.upvotes - tally.downvotes;

    const embed = new EmbedBuilder()
      .setTitle(`💡 ${suggestion.title}`)
      .setDescription(suggestion.description.slice(0, 4096))
      .addFields(
        { name: 'Author', value: `<@${suggestion.userId}>`, inline: true },
        { name: 'Status', value: STATUS_LABELS[status], inline: true },
        { name: 'Votes', value: `${SUGGESTION_UPVOTE} ${tally.upvotes} · ${SUGGESTION_DOWNVOTE} ${tally.downvotes} · net **${net}**`, inline: true }
      )
      .setFooter({ text: `Suggestion #${suggestion.id}` });

    if (author) {
      embed.setThumbnail(author.displayAvatarURL());
    }

    if (status === SuggestionStatus.Declined && declineReason) {
      embed.addFields({ name: 'Reason for decline', value: declineReason.slice(0, 1024) });
    }

    return embed;
  }
}

interface SuggestionApprovalEmbedParams {
  suggestion: Suggestion;
  tally?: SuggestionVoteTally;
}

/** Moderator-facing approval embed posted in the approval channel once a suggestion reaches consideration. */
export class SuggestionApprovalEmbed extends BaseEmbed<SuggestionApprovalEmbedParams> {
  constructor(params: SuggestionApprovalEmbedParams) {
    super({ ...params, color: Colors.Yellow, locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { suggestion, tally = ZERO_TALLY } = this.required;

    return new EmbedBuilder()
      .setTitle(`🗳️ Suggestion Approval — #${suggestion.id}`)
      .setDescription(`**${suggestion.title}**\n\n${suggestion.description.slice(0, 3800)}`)
      .addFields(
        { name: 'Author', value: `<@${suggestion.userId}>`, inline: true },
        {
          name: 'Final votes',
          value: `${SUGGESTION_UPVOTE} ${tally.upvotes} · ${SUGGESTION_DOWNVOTE} ${tally.downvotes} · net **${tally.upvotes - tally.downvotes}**`,
          inline: true,
        }
      )
      .setFooter({ text: `Suggestion #${suggestion.id} · reached the vote threshold` });
  }
}

export const buildSuggestionApprovalRow = (suggestionId: number, resolved = false): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`suggestion:accept:${suggestionId}`).setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(resolved),
    new ButtonBuilder().setCustomId(`suggestion:decline:${suggestionId}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setDisabled(resolved)
  );
