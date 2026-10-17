import { GuildMember, PartialGuildMember } from 'discord.js';

import { AppFeature } from '~/settings';
import { Client } from '~/core/models';
import { AuditEventType, recordAuditEvent, recordUsernameChange, upsertUser } from '~/database';
import { Logger } from '~/utilities';

const logger = Logger.getInstance(AppFeature.Surveillance);

/** Tracks display-name and role changes on a member for the surveillance audit trail. */
export const recordMemberUpdate = async (_client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> => {
  await upsertUser({ id: newMember.id, username: newMember.user.username });

  // Partials.GuildMember is enabled: an uncached old member has no roles and no nickname, so every
  // field below would diff as "everything just changed".
  if (oldMember.partial) return;

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
};
