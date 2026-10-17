import { ApplicationCommandType, ChannelType, Message, MessageFlags, RESTJSONErrorCodes, SlashCommandBuilder, TextChannel } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { logModAction } from '~/core/middleware';
import { AppFeature } from '~/settings';
import { AuditEventType, upsertUser } from '~/database';
import { consumeMessageDeleteSuppression, suppressMessageDeleteLog } from '~/core/providers/surveillance';
import { logSoftFailure } from '~/utilities';

// Discord API hard limit: bulkDelete accepts at most 100 messages.
const BULK_DELETE_LIMIT = 100;
const BATCH_DELAY_MS = 1_000;
// Discord refuses to bulk-delete anything older than 14 days; those must be deleted one by one.
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1_000;
// Single deletes are rate-limited, so cap them to stay inside the 15-minute interaction token lifetime.
const SINGLE_DELETE_LIMIT = 200;
const SINGLE_DELETE_DELAY_MS = 350;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Clear,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  afterware: [logModAction],
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages from this channel.')
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('Number of messages to delete (1–1000)').setRequired(true).setMinValue(1).setMaxValue(1000)
    )
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user').setRequired(false)),

  async executeCommand(_command, _client, interaction) {
    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user', false);

    if (!interaction.channel || interaction.channel.type === ChannelType.DM) {
      await interaction.reply({ content: 'This command can only be used in server text channels.', flags: MessageFlags.Ephemeral });
      return;
    }

    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await upsertUser({ id: interaction.user.id, username: interaction.user.username });

    const collected: Message[] = [];
    let lastId: string | undefined;

    while (collected.length < amount) {
      const batch = await channel.messages.fetch({ limit: BULK_DELETE_LIMIT, ...(lastId ? { before: lastId } : {}) });
      if (batch.size === 0) break;

      const candidates = [...batch.values()];
      const filtered = targetUser ? candidates.filter((m) => m.author.id === targetUser.id) : candidates;
      collected.push(...filtered.slice(0, amount - collected.length));

      lastId = candidates.reduce((min, m) => (m.id < min ? m.id : min), candidates[0].id);

      if (batch.size < BULK_DELETE_LIMIT) break;
    }

    if (collected.length === 0) {
      const msg = targetUser ? `No messages from <@${targetUser.id}> found.` : 'No messages found to delete.';
      await interaction.editReply({ content: msg });
      return;
    }

    const cutoff = Date.now() - BULK_DELETE_MAX_AGE_MS;
    const recent = collected.filter((m) => m.createdTimestamp > cutoff);
    const old = collected.filter((m) => m.createdTimestamp <= cutoff);

    let deleted = 0;
    for (let i = 0; i < recent.length; i += BULK_DELETE_LIMIT) {
      const chunk = recent.slice(i, i + BULK_DELETE_LIMIT);
      const result = await channel.bulkDelete(chunk, true);
      deleted += result.size;
      if (i + BULK_DELETE_LIMIT < recent.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const slowTargets = old.slice(0, SINGLE_DELETE_LIMIT);
    if (slowTargets.length > 0) {
      await interaction.editReply({
        content: `Deleted ${deleted} recent message(s). Now removing ${slowTargets.length} message(s) older than 14 days one by one — this takes a while.`,
      });
    }

    let slowDeleted = 0;
    let firstError: string | null = null;

    for (const message of slowTargets) {
      try {
        suppressMessageDeleteLog(message.id);
        await message.delete();
        slowDeleted += 1;
      } catch (error) {
        // The delete never happened, so release the mark rather than blinding the next 60s of surveillance.
        consumeMessageDeleteSuppression(message.id);

        const details = logSoftFailure(AppFeature.Clear, 'CLEAR_OLD_MESSAGE_DELETE', { messageId: message.id, channelId: channel.id }, error);
        firstError ??= `\`${details.upstreamCode ?? details.errorName}\` — ${details.reason}`;

        // A permission failure applies to every remaining message; stop instead of grinding through the rate limit.
        if (details.upstreamCode === RESTJSONErrorCodes.MissingPermissions || details.upstreamCode === RESTJSONErrorCodes.MissingAccess) {
          break;
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, SINGLE_DELETE_DELAY_MS));
    }
    deleted += slowDeleted;

    const userPart = targetUser ? ` from <@${targetUser.id}>` : '';
    const skipped = old.length - slowTargets.length;
    const skippedPart = skipped > 0 ? ` ${skipped} message(s) older than 14 days were skipped — run the command again to continue.` : '';
    const failed = slowTargets.length - slowDeleted;
    const errorPart = firstError ? ` ${failed} old message(s) could not be deleted — first error: ${firstError}` : '';
    await interaction.editReply({ content: `Deleted ${deleted} message(s)${userPart}.${skippedPart}${errorPart}` });

    return {
      eventType: AuditEventType.BulkMessagesDeleted,
      actorUserId: interaction.user.id,
      payload: { channelId: interaction.channelId, targetUserId: targetUser?.id ?? null, requestedAmount: amount, deletedCount: deleted },
    };
  },
});
