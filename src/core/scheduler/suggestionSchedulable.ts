import { type TextChannel } from 'discord.js';

import { AppFeature } from '~/settings';
import {
  countSuggestionVotes,
  getSettings,
  listExpiredActiveSuggestions,
  setSuggestionApprovalMessageId,
  setSuggestionStatus,
  SuggestionStatus,
} from '~/database';
import { getConfig } from '~/config';
import { SuggestionApprovalEmbed, SuggestionEmbed, buildSuggestionApprovalRow, buildSuggestionVoteRow } from '~/core/components/Suggestion';
import { Schedulable } from '~/core/models/Schedulable';
import { logSoftFailure, softFail } from '~/utilities';

export const suggestionSchedulable = new Schedulable({
  name: 'suggestion-schedulable',
  feature: AppFeature.Suggestions,
  description: 'Closes expired suggestion votes, escalates qualifying ones to approval, and declines the rest.',
  defaultCron: () => getConfig().config.schedules.suggestionSweep,
  execute: async (client, logger) => {
    if (!getConfig().config.features.suggestions) return;

    const settings = await getSettings();
    if (!settings.suggestionChannelId) {
      return;
    }

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(softFail(AppFeature.Suggestions, 'SUGGESTIONS_GUILD_FETCH'));
    const channel = guild
      ? ((await guild.channels
          .fetch(settings.suggestionChannelId)
          .catch(
            softFail(AppFeature.Suggestions, 'SUGGESTIONS_CHANNEL_FETCH', { suggestionChannelId: settings.suggestionChannelId })
          )) as TextChannel | null)
      : null;
    if (!channel?.isTextBased()) {
      logger.warn('Suggestion sweeper: suggestion channel unavailable; skipping this tick.');
      return;
    }

    const approvalChannel =
      settings.suggestionApprovalChannelId && guild
        ? ((await guild.channels
            .fetch(settings.suggestionApprovalChannelId)
            .catch(
              softFail(AppFeature.Suggestions, 'SUGGESTIONS_CHANNEL_FETCH', { suggestionApprovalChannelId: settings.suggestionApprovalChannelId })
            )) as TextChannel | null)
        : null;

    let escalated = 0;
    let declined = 0;

    const expired = await listExpiredActiveSuggestions();
    for (const suggestion of expired) {
      try {
        const message = suggestion.messageId
          ? await channel.messages
              .fetch(suggestion.messageId)
              .catch(softFail(AppFeature.Suggestions, 'SUGGESTIONS_MESSAGE_FETCH', { messageId: suggestion.messageId }))
          : null;
        const tally = await countSuggestionVotes(suggestion.id);

        if (suggestion.status === SuggestionStatus.InConsideration && approvalChannel?.isSendable()) {
          const approvalMessage = await approvalChannel.send({
            embeds: [new SuggestionApprovalEmbed({ suggestion, tally }).render()],
            components: [buildSuggestionApprovalRow(suggestion.id)],
          });
          await setSuggestionApprovalMessageId(suggestion.id, approvalMessage.id);
          logger.info({ suggestionId: suggestion.id }, 'Suggestion escalated to approval channel.');
          escalated++;
        } else if (suggestion.status === SuggestionStatus.Open) {
          suggestion.status = SuggestionStatus.Declined;
          await setSuggestionStatus(suggestion.id, SuggestionStatus.Declined);
          logger.info({ suggestionId: suggestion.id }, 'Suggestion declined — vote threshold not reached.');
          declined++;
        }

        if (message) {
          const author = suggestion.userId
            ? await client.users
                .fetch(suggestion.userId)
                .catch(softFail(AppFeature.Suggestions, 'SUGGESTIONS_USER_FETCH', { userId: suggestion.userId }))
            : null;
          await message
            .edit({
              embeds: [new SuggestionEmbed({ suggestion, author, declineReason: null, tally }).render()],
              components: [buildSuggestionVoteRow(suggestion, tally, true)],
            })
            .catch(softFail(AppFeature.Suggestions, 'SUGGESTIONS_MESSAGE_EDIT'));
        }
      } catch (err) {
        logSoftFailure(AppFeature.Suggestions, 'SUGGESTIONS_EXPIRY_PROCESSING', { suggestionId: suggestion.id }, err);
      }
    }

    if (escalated === 0 && declined === 0) {
      return;
    }
    return `Escalated: ${escalated}, declined: ${declined}.`;
  },
});
