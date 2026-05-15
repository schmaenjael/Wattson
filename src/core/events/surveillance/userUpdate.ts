import { Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { AuditEventType, recordAuditEvent, recordUsernameChange, upsertUser } from '~/database';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';

export default new Event({
  type: Events.GuildMemberUpdate,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(event, client, oldMember, newMember) {
    const logger = Logger.getInstance(AppFeature.Surveillance);

    await upsertUser({ id: newMember.id, username: newMember.user.username });

    if (oldMember.displayName !== newMember.displayName) {
      await recordUsernameChange(newMember.id, newMember.displayName);
      await recordAuditEvent({
        eventType: AuditEventType.MemberUsernameChanged,
        targetUserId: newMember.id,
        payload: { from: oldMember.displayName, to: newMember.displayName },
      });
      logger.debug(`${newMember.user.username}: displayName "${oldMember.displayName}" → "${newMember.displayName}"`);
    }

    const oldRoleIds = new Set(oldMember.roles.cache.keys());
    const newRoleIds = new Set(newMember.roles.cache.keys());
    const added = [...newRoleIds].filter((id) => !oldRoleIds.has(id));
    const removed = [...oldRoleIds].filter((id) => !newRoleIds.has(id));
    if (added.length || removed.length) {
      await recordAuditEvent({ eventType: AuditEventType.MemberRolesChanged, targetUserId: newMember.id, payload: { added, removed } });
    }
  },
});
