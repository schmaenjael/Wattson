import { ApplicationCommandType, ChannelType, Message, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { logModAction } from '~/core/middleware';
import { AppFeature, ProcessExitCode } from '~/settings';
import { AuditEventType, upsertUser } from '~/database';

const BULK_DELETE_LIMIT = 100;
const BATCH_DELAY_MS = 1_000;

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

  async executeCommand(_command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

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

    let deleted = 0;
    for (let i = 0; i < collected.length; i += BULK_DELETE_LIMIT) {
      const chunk = collected.slice(i, i + BULK_DELETE_LIMIT);
      const result = await channel.bulkDelete(chunk, true);
      deleted += result.size;
      if (i + BULK_DELETE_LIMIT < collected.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const userPart = targetUser ? ` from <@${targetUser.id}>` : '';
    await interaction.editReply({ content: `Deleted ${deleted} message(s)${userPart}.` });

    return {
      eventType: AuditEventType.BulkMessagesDeleted,
      actorUserId: interaction.user.id,
      payload: { channelId: interaction.channelId, targetUserId: targetUser?.id ?? null, requestedAmount: amount, deletedCount: deleted },
    };
  },
});
