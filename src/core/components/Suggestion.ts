import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type HexColorString, type User } from 'discord.js';

import type { Suggestion, SuggestionVoteTally } from '~/database';
import { SuggestionStatus } from '~/database';
import { Colors } from '~/settings';

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

/** Public-facing suggestion embed posted in the suggestion channel and edited as the suggestion progresses. */
export const buildSuggestionEmbed = (
  suggestion: Suggestion,
  author: User | null,
  declineReason?: string | null,
  tally: SuggestionVoteTally = ZERO_TALLY
): EmbedBuilder => {
  const status = suggestion.status as SuggestionStatus;
  const net = tally.upvotes - tally.downvotes;

  const embed = new EmbedBuilder()
    .setColor(STATUS_COLORS[status])
    .setTitle(`💡 ${suggestion.title}`)
    .setDescription(suggestion.description.slice(0, 4096))
    .addFields(
      { name: 'Author', value: `<@${suggestion.userId}>`, inline: true },
      { name: 'Status', value: STATUS_LABELS[status], inline: true },
      { name: 'Votes', value: `${SUGGESTION_UPVOTE} ${tally.upvotes} · ${SUGGESTION_DOWNVOTE} ${tally.downvotes} · net **${net}**`, inline: true }
    )
    .setFooter({ text: `Suggestion #${suggestion.id}` })
    .setTimestamp();

  if (author) {
    embed.setThumbnail(author.displayAvatarURL());
  }

  if (status === SuggestionStatus.Declined && declineReason) {
    embed.addFields({ name: 'Reason for decline', value: declineReason.slice(0, 1024) });
  }

  return embed;
};

/** Moderator-facing approval embed posted in the approval channel once a suggestion reaches consideration. */
export const buildSuggestionApprovalEmbed = (suggestion: Suggestion, tally: SuggestionVoteTally = ZERO_TALLY): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(Colors.Yellow)
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
    .setFooter({ text: `Suggestion #${suggestion.id} · reached the vote threshold` })
    .setTimestamp();

export const buildSuggestionApprovalRow = (suggestionId: number, resolved = false): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`suggestion:accept:${suggestionId}`).setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(resolved),
    new ButtonBuilder().setCustomId(`suggestion:decline:${suggestionId}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setDisabled(resolved)
  );
