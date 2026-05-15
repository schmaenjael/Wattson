import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { Event } from '~/core/models';

const MAX_EXCERPT = 512;

export default new Event({
  type: Events.MessageUpdate,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(event, client, oldMessage, newMessage) {
    if (!newMessage.inGuild()) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const settings = await getSettings();
    if (!settings.featureSurveillanceEnabled) return;

    await recordAuditEvent({
      eventType: AuditEventType.MessageEdited,
      targetUserId: newMessage.author?.id,
      payload: {
        messageId: newMessage.id,
        channelId: newMessage.channelId,
        before: oldMessage.content ? oldMessage.content.slice(0, MAX_EXCERPT) : null,
        after: newMessage.content ? newMessage.content.slice(0, MAX_EXCERPT) : null,
      },
    });
  },
});
