import { GuildMember } from 'discord.js';

import { Client } from '~/core/models';
import { AppFeature } from '~/settings';
import { softFail } from '~/utilities';
import { AuditEventType, getSettings, recordAuditEvent, upsertUser } from '~/database';
import { runVerification } from '~/core/providers/verification';

/** Records the join in the audit log and, when welcome is enabled, kicks off the (long-running) verification flow. */
export const welcomeMember = async (client: Client, member: GuildMember): Promise<void> => {
  const settings = await getSettings();

  await upsertUser({ id: member.id, username: member.user.username });
  await recordAuditEvent({
    eventType: AuditEventType.MemberJoined,
    targetUserId: member.id,
    payload: { username: member.user.username, joinedAt: member.joinedTimestamp },
  });

  if (!settings.featureWelcomeEnabled) return;

  runVerification(client, member).catch(softFail(AppFeature.Welcome, 'WELCOME_VERIFICATION_FLOW', { memberId: member.id }));
};
