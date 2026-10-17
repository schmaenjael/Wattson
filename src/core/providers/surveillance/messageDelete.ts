import { AuditLogEvent, EmbedBuilder, Message, PartialMessage } from 'discord.js';

import { AppFeature } from '~/settings';
import { Colors } from '~/settings/theme';
import { Client } from '~/core/models';
import { AuditEventType, getSettings, recordAuditEvent, upsertUser } from '~/database';
import { Logger, softFail } from '~/utilities';
import { consumeMessageDeleteSuppression } from './suppression';

const MAX_CONTENT = 1024;
const logger = Logger.getInstance(AppFeature.Surveillance);

/** Records a deleted message and posts a surveillance embed, distinguishing self-deletes from moderator removals. */
export const reportMessageDelete = async (_client: Client, message: Message<boolean> | PartialMessage): Promise<void> => {
  if (!message.inGuild()) return;
  if (message.author?.bot) return;
  // Moderator bulk removals are audited once by the command itself; skip the per-message trail.
  if (consumeMessageDeleteSuppression(message.id)) return;

  const settings = await getSettings();
  if (!settings.featureSurveillanceEnabled) return;

  // audit_log.target_user_id is FK-constrained to users; the author may never have been seen before.
  if (message.author) {
    await upsertUser({ id: message.author.id, username: message.author.username });
  }

  await recordAuditEvent({
    eventType: AuditEventType.MessageDeleted,
    targetUserId: message.author?.id,
    payload: {
      messageId: message.id,
      channelId: message.channelId,
      content: message.content ? message.content.slice(0, 512) : null,
      attachments: [...message.attachments.values()].map((a) => a.url),
    },
  });

  // Self-deletions are not recorded in the Discord audit log; only mod deletions appear there.
  let isModDelete = false;
  let modId: string | null = null;

  if (message.author?.id) {
    const auditLogs = await message.guild
      .fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 })
      .catch(softFail(AppFeature.Surveillance, 'SURVEILLANCE_FETCH_AUDIT_LOGS'));

    if (auditLogs) {
      const entry = auditLogs.entries.find(
        (e) => e.targetId === message.author!.id && e.extra.channel.id === message.channelId && Date.now() - e.createdTimestamp < 5000
      );
      if (entry && entry.executorId !== message.author?.id) {
        isModDelete = true;
        modId = entry.executorId;
      }
    }
  }

  const color = isModDelete ? Colors.Purple : Colors.Red;
  const title = isModDelete ? '🛡️ Message Removed by Moderator' : '🗑️ Message Deleted';

  const descLines = [`<@${message.author?.id ?? 'unknown'}> in <#${message.channelId}>`];
  if (isModDelete && modId) {
    descLines.push(`Removed by <@${modId}>`);
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(descLines.join('\n'))
    .setFooter({ text: `Message ID: ${message.id}` })
    .setTimestamp();

  const content = message.content?.slice(0, MAX_CONTENT);
  if (content) {
    embed.addFields({ name: 'Content', value: content });
  }

  if (message.attachments.size > 0) {
    const urls = [...message.attachments.values()]
      .map((a) => a.url)
      .slice(0, 5)
      .join('\n');
    embed.addFields({ name: 'Attachments', value: urls });
  }

  await logger.log({
    level: 'info',
    message: `Message deleted by ${message.author?.id ?? 'unknown'} in ${message.channelId}`,
    data: { messageId: message.id, channelId: message.channelId, isModDelete, modId },
    target: 'surveillance',
    internalEmbed: embed,
  });
};
