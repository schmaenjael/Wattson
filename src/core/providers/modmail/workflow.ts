import type { Attachment, AnyThreadChannel, PublicThreadChannel, TextChannel, User } from 'discord.js';
import { Colors, EmbedBuilder, ThreadAutoArchiveDuration } from 'discord.js';

import {
  AuditEventType,
  ModmailCategory,
  ModmailStatus,
  closeModmail,
  getSettings,
  openModmail,
  recordAuditEvent,
  setModmailChannelMessage,
  setModmailSummary,
  touchModmailActivity,
  upsertUser,
  type Modmail,
} from '~/database';
import {
  ModmailChannelEmbed,
  ModmailClosedByModEmbed,
  ModmailClosedByUserEmbed,
  ModmailClosedDmEmbed,
  ModmailOpenThreadEmbed,
  ModmailSummaryEmbed,
  ModmailThreadTutorialEmbed,
  UserDmGuideEmbed,
  buildKeepOpenDisabledRow,
} from '~/core/components/Modmail';
import type { Client } from '~/core/models';
import { fetchModmailSummary } from './summarizer';
import { attempt } from '~/utilities';

export const openModmailFlow = async (
  channel: TextChannel,
  user: User,
  category: ModmailCategory,
  reason: string
): Promise<{ modmail: Modmail; guideEmbed: EmbedBuilder }> => {
  await upsertUser({ id: user.id, username: user.username });

  const channelMsg = await channel.send({ content: '📬 Opening modmail…' });
  const thread = (await channelMsg.startThread({
    name: `📬 Modmail — ${user.username}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    reason: `Modmail opened by ${user.username} (${user.id})`,
  })) as PublicThreadChannel;

  const modmail = await openModmail({ userId: user.id, threadId: thread.id, category, reason, status: ModmailStatus.Open });

  await thread.setName(`📬 Modmail #${modmail.id} — ${user.username}`).catch(() => null);
  await channelMsg.edit({ content: null, embeds: [new ModmailChannelEmbed({ modmail, user }).render()] });
  await setModmailChannelMessage(modmail.id, channelMsg.id);

  const settings = await getSettings();
  const pingContent = settings.roleModmailHandlerId ? `<@&${settings.roleModmailHandlerId}>` : undefined;
  await thread.send({ content: pingContent, embeds: [new ModmailOpenThreadEmbed({ modmail, user }).render()] });
  await thread.send({ embeds: [new ModmailThreadTutorialEmbed({ modmail }).render()] });

  await recordAuditEvent({
    eventType: AuditEventType.ModmailOpened,
    actorUserId: user.id,
    targetUserId: user.id,
    payload: { modmailId: modmail.id, category, threadId: thread.id },
  });

  const guideEmbed = new UserDmGuideEmbed({ modmail }).render();
  return { modmail, guideEmbed };
};

export const sendModmailAttachment = async (
  client: Client,
  thread: AnyThreadChannel,
  modmail: Modmail,
  sender: User,
  side: 'user' | 'mod',
  file: Attachment
): Promise<void> => {
  const embed =
    side === 'user'
      ? new EmbedBuilder()
          .setColor(Colors.Blue)
          .setAuthor({ name: `${sender.username} — User`, iconURL: sender.displayAvatarURL() })
          .setDescription('📎 Sent an attachment')
          .setTimestamp()
      : new EmbedBuilder()
          .setColor(Colors.Green)
          .setAuthor({ name: `${sender.username} — Moderator`, iconURL: sender.displayAvatarURL() })
          .setDescription('📎 Sent an attachment')
          .setFooter({ text: 'Moderator reply' })
          .setTimestamp();

  await thread.send({ embeds: [embed], files: [{ attachment: file.url, name: file.name }] });

  if (side === 'mod') {
    const targetUser = modmail.userId ? await client.users.fetch(modmail.userId).catch(() => null) : null;
    if (targetUser) {
      const dmEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(`💬 Moderator Attachment — Modmail #${modmail.id}`)
        .setDescription('📎 A moderator sent an attachment.')
        .setFooter({ text: 'Reply via /modmail message · /modmail attach · /modmail close' })
        .setTimestamp();
      const dmChannel = await targetUser.createDM().catch(() => null);
      await dmChannel?.send({ embeds: [dmEmbed], files: [{ attachment: file.url, name: file.name }] }).catch(() => null);
    }
  }

  await touchModmailActivity(modmail.id);
};

/**
 * Closes a modmail (either the owner from their DM, or a moderator from the thread) and
 * runs the shared close sequence: audit record, summary fetch, channel-message edit,
 * closed-notice embed, stale-button disable, and thread archive. Only the mod-initiated
 * path also DMs the owner a closed notice — the user-initiated path doesn't need to notify
 * the person who just closed it themselves.
 */
export const finalizeModmailClose = async (client: Client, modmail: Modmail, closedBy: 'user' | 'mod', closer: User): Promise<void> => {
  await closeModmail(modmail.id);
  await recordAuditEvent({
    eventType: AuditEventType.ModmailClosed,
    actorUserId: closer.id,
    targetUserId: modmail.userId ?? undefined,
    payload: { modmailId: modmail.id, closedBy },
  });

  const targetUser = modmail.userId ? await client.users.fetch(modmail.userId).catch(() => null) : null;
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);

  if (thread?.isThread()) {
    const summary = await fetchModmailSummary(client, modmail.threadId);
    if (summary) {
      await setModmailSummary(modmail.id, summary);
    }

    if (modmail.channelMessageId && thread.parentId) {
      const parentChannel = await guild?.channels.fetch(thread.parentId).catch(() => null);
      if (parentChannel?.isTextBased()) {
        const channelMsg = await parentChannel.messages.fetch(modmail.channelMessageId).catch(() => null);
        if (channelMsg) {
          const closedModmail = { ...modmail, status: ModmailStatus.Closed, closedAt: new Date() };
          const embeds: EmbedBuilder[] = [
            new ModmailChannelEmbed({ modmail: closedModmail, user: closedBy === 'user' ? closer : targetUser }).render(),
          ];
          if (summary) embeds.push(new ModmailSummaryEmbed({ summary, modmailId: modmail.id }).render());
          await channelMsg.edit({ embeds }).catch(() => null);
        }
      }
    }

    await thread.send({
      embeds: [closedBy === 'user' ? new ModmailClosedByUserEmbed({ user: closer }).render() : new ModmailClosedByModEmbed({ mod: closer }).render()],
    });

    if (summary) {
      await thread.send({ embeds: [new ModmailSummaryEmbed({ summary, modmailId: modmail.id }).render()] });
    }

    if (modmail.staleMessageId) {
      const msg = await thread.messages.fetch(modmail.staleMessageId).catch(() => null);
      await msg?.edit({ components: [buildKeepOpenDisabledRow(modmail.id)] }).catch(() => null);
    }

    await attempt(async () => {
      await thread.setArchived(true);
    });
  }

  if (closedBy === 'mod' && targetUser) {
    const dmChannel = await targetUser.createDM().catch(() => null);
    await dmChannel?.send({ embeds: [new ModmailClosedDmEmbed().render()] }).catch(() => null);
  }
};
