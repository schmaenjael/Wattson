import { AuditLogEvent, EmbedBuilder, Events, TextChannel } from 'discord.js';

import { AppFeature } from '~/settings';
import { Colors } from '~/settings/theme';
import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { Event } from '~/core/models';

const MAX_CONTENT = 1024;

export default new Event({
  type: Events.MessageDelete,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(event, client, message) {
    if (!message.inGuild()) return;
    if (message.author?.bot) return;

    const settings = await getSettings();
    if (!settings.featureSurveillanceEnabled) return;

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

    if (!settings.surveillanceLogChannelId) return;

    const logChannel = (await message.guild.channels.fetch(settings.surveillanceLogChannelId).catch(() => null)) as TextChannel | null;
    if (!logChannel) return;

    // Self-deletions are not recorded in the Discord audit log; only mod deletions appear there.
    let isModDelete = false;
    let modId: string | null = null;

    if (message.author?.id) {
      const auditLogs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 }).catch(() => null);

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

    await logChannel.send({ embeds: [embed] }).catch(() => null);
  },
});
