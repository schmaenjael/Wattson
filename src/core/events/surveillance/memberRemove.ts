import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { AuditEventType, recordAuditEvent, recordMemberLeave } from '~/database';
import { Event } from '~/core/models';

export default new Event({
  type: Events.GuildMemberRemove,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(_event, _client, member) {
    await recordMemberLeave(member.id);
    await recordAuditEvent({
      eventType: AuditEventType.MemberLeft,
      targetUserId: member.id,
      payload: { username: member.user.username, roles: [...member.roles.cache.keys()] },
    });
  },
});
