import { GuildMember, PartialGuildMember } from 'discord.js';

import { Client } from '~/core/models';
import { AuditEventType, recordAuditEvent, recordMemberLeave } from '~/database';

/** Records a member leaving the guild in the activity log and audit trail. */
export const recordMemberRemoval = async (_client: Client, member: GuildMember | PartialGuildMember): Promise<void> => {
  await recordMemberLeave(member.id);
  await recordAuditEvent({
    eventType: AuditEventType.MemberLeft,
    targetUserId: member.id,
    payload: { username: member.user.username, roles: [...member.roles.cache.keys()] },
  });
};
