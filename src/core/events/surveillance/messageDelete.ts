import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { Event } from '~/core/models';

const MAX_EXCERPT = 512;

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
        content: message.content ? message.content.slice(0, MAX_EXCERPT) : null,
        attachments: [...message.attachments.values()].map((a) => a.url),
      },
    });
  },
});
