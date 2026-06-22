import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { AppFeature } from '~/settings';
import { Client } from '~/core/models';
import { Permission } from '~/core/models/Permission';
import { memberHasAnyPermission } from '~/core/middleware/permissionCore';
import { Logger } from '~/utilities';
import {
  countSuggestionVotes,
  createSuggestion,
  findSuggestionById,
  findSuggestionByMessageId,
  getSettings,
  setSuggestionMessageId,
  setSuggestionStatus,
  setSuggestionVote,
  type Settings,
  type Suggestion,
  SuggestionStatus,
  SuggestionVoteDirection,
  upsertUser,
} from '~/database';
import { buildSuggestionApprovalRow, buildSuggestionEmbed, buildSuggestionVoteRow } from '~/core/components/Suggestion';

const DECLINE_REASON_PREFIX = 'suggestion:decline-reason:';
const logger = Logger.getInstance(AppFeature.Suggestions);

type ButtonHandler = (client: Client, interaction: ButtonInteraction) => Promise<void>;
type ModalHandler = (client: Client, interaction: ModalSubmitInteraction) => Promise<void>;

const refreshSuggestionMessage = async (client: Client, settings: Settings, suggestion: Suggestion, declineReason?: string | null): Promise<void> => {
  if (!settings.suggestionChannelId || !suggestion.messageId) {
    return;
  }
  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
  const channel = guild ? await guild.channels.fetch(settings.suggestionChannelId).catch(() => null) : null;
  if (!channel?.isTextBased()) {
    return;
  }
  const message = await (channel as TextChannel).messages.fetch(suggestion.messageId).catch(() => null);
  if (!message) {
    return;
  }
  const author = suggestion.userId ? (client.users.cache.get(suggestion.userId) ?? null) : null;
  await message
    .edit({ embeds: [buildSuggestionEmbed(suggestion, author, declineReason)], components: [buildSuggestionVoteRow(suggestion, undefined, true)] })
    .catch(() => null);
};

const isModerator = async (interaction: ButtonInteraction, settings: Settings): Promise<boolean> => {
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  return member ? memberHasAnyPermission(member, settings, [Permission.Moderation, Permission.Administration]) : false;
};

const handleCreate: ModalHandler = async (client, interaction) => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const settings = await getSettings();
  if (!settings.suggestionChannelId) {
    await interaction.editReply({ content: 'The suggestion system is not configured yet. Please contact an administrator.' });
    return;
  }

  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
  const channel = guild ? await guild.channels.fetch(settings.suggestionChannelId).catch(() => null) : null;
  if (!channel?.isTextBased() || !channel.isSendable()) {
    await interaction.editReply({ content: 'The suggestion channel is unavailable. Please contact an administrator.' });
    return;
  }

  const title = interaction.fields.getTextInputValue('title').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const reason = interaction.fields.getTextInputValue('reason').trim();
  const body = reason ? `${description}\n\n**Reasoning:** ${reason}` : description;

  await upsertUser({ id: interaction.user.id, username: interaction.user.username });

  const expiresAt = new Date(Date.now() + settings.suggestionVoteDurationHours * 60 * 60 * 1000);
  const suggestion = await createSuggestion({ userId: interaction.user.id, title, description: body, expiresAt });

  const message = await (channel as TextChannel).send({
    embeds: [buildSuggestionEmbed(suggestion, interaction.user)],
    components: [buildSuggestionVoteRow(suggestion)],
  });
  await setSuggestionMessageId(suggestion.id, message.id);

  await interaction.editReply({ content: `✅ Your suggestion **#${suggestion.id}** has been posted in <#${channel.id}>.` });
};

const handleDeclineReason: ModalHandler = async (client, interaction) => {
  const id = parseInt(interaction.customId.slice(DECLINE_REASON_PREFIX.length), 10);
  if (isNaN(id)) {
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const suggestion = await findSuggestionById(id);
  if (!suggestion || suggestion.status === SuggestionStatus.Accepted || suggestion.status === SuggestionStatus.Declined) {
    await interaction.editReply({ content: 'This suggestion has already been resolved.' });
    return;
  }

  const reason = interaction.fields.getTextInputValue('reason').trim();
  await setSuggestionStatus(suggestion.id, SuggestionStatus.Declined);
  suggestion.status = SuggestionStatus.Declined;

  const settings = await getSettings();
  await refreshSuggestionMessage(client, settings, suggestion, reason);
  await interaction.message?.edit({ components: [buildSuggestionApprovalRow(suggestion.id, true)] }).catch(() => null);

  await interaction.editReply({ content: `❌ Suggestion **#${suggestion.id}** declined.` });
};

const handleVote: ButtonHandler = async (client, interaction) => {
  const isUp = interaction.customId.split(':')[2] === 'up';
  const messageId = interaction.message.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const suggestion = await findSuggestionByMessageId(messageId);
    if (!suggestion) {
      await interaction.editReply({ content: 'Suggestion not found.' });
      return;
    }

    const isActive = suggestion.status === SuggestionStatus.Open || suggestion.status === SuggestionStatus.InConsideration;
    if (!isActive) {
      await interaction.editReply({ content: 'This suggestion is no longer open for voting.' });
      return;
    }

    const direction = isUp ? SuggestionVoteDirection.Up : SuggestionVoteDirection.Down;
    await upsertUser({ id: interaction.user.id, username: interaction.user.username });
    await setSuggestionVote(suggestion.id, interaction.user.id, direction);

    const tally = await countSuggestionVotes(suggestion.id);

    const settings = await getSettings();
    if (suggestion.status === SuggestionStatus.Open && tally.upvotes - tally.downvotes >= settings.suggestionVoteThreshold) {
      suggestion.status = SuggestionStatus.InConsideration;
      await setSuggestionStatus(suggestion.id, SuggestionStatus.InConsideration);
    }

    const author = client.users.cache.get(suggestion.userId ?? '') ?? null;
    await interaction.message
      .edit({ embeds: [buildSuggestionEmbed(suggestion, author, null, tally)], components: [buildSuggestionVoteRow(suggestion, tally)] })
      .catch(() => null);

    await interaction.editReply({ content: `Your ${isUp ? '👍' : '👎'} vote has been recorded.` });
  } catch (err) {
    logger.error(Object(err), 'Suggestion vote handler failed.');
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred while recording your vote.', flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  }
};

const resolveApproval = async (client: Client, interaction: ButtonInteraction, action: string): Promise<void> => {
  const id = parseInt(interaction.customId.split(':')[2] ?? '', 10);
  if (isNaN(id)) {
    return;
  }

  const settings = await getSettings();
  if (!(await isModerator(interaction, settings))) {
    await interaction.reply({ content: 'Only moderators can act on suggestions.', flags: MessageFlags.Ephemeral });
    return;
  }

  const suggestion = await findSuggestionById(id);
  if (!suggestion) {
    await interaction.reply({ content: 'Suggestion not found.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (suggestion.status === SuggestionStatus.Accepted || suggestion.status === SuggestionStatus.Declined) {
    await interaction.reply({ content: 'This suggestion has already been resolved.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'decline') {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`${DECLINE_REASON_PREFIX}${suggestion.id}`)
        .setTitle(`Decline Suggestion #${suggestion.id}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for declining').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
          )
        )
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await setSuggestionStatus(suggestion.id, SuggestionStatus.Accepted);
  suggestion.status = SuggestionStatus.Accepted;

  await refreshSuggestionMessage(client, settings, suggestion);
  await interaction.message.edit({ components: [buildSuggestionApprovalRow(suggestion.id, true)] }).catch(() => null);

  await interaction.editReply({ content: `✅ Suggestion **#${suggestion.id}** accepted.` });
};

const BUTTON_ACTIONS: Record<string, ButtonHandler> = {
  vote: handleVote,
  accept: (client, interaction) => resolveApproval(client, interaction, 'accept'),
  decline: (client, interaction) => resolveApproval(client, interaction, 'decline'),
};

const MODAL_ACTIONS: Record<string, ModalHandler> = {
  create: handleCreate,
  'decline-reason': handleDeclineReason,
};

export const handleSuggestionButton: ButtonHandler = async (client, interaction) => {
  await BUTTON_ACTIONS[interaction.customId.split(':')[1]]?.(client, interaction);
};

export const handleSuggestionModal: ModalHandler = async (client, interaction) => {
  await MODAL_ACTIONS[interaction.customId.split(':')[1]]?.(client, interaction);
};
