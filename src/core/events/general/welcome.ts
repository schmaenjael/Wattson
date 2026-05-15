import { Events } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';

import { getSettings, recordAuditEvent, upsertUser, AuditEventType } from '~/database';
import { runVerification } from '~/core/providers/verification';

export default new Event({
  type: Events.GuildMemberAdd,
  feature: AppFeature.Welcome,
  middleware: [],
  async executeCommand(event, client, member) {
    const logger = Logger.getInstance(event.options.feature);
    const settings = await getSettings();

    await upsertUser({ id: member.id, username: member.user.username });
    await recordAuditEvent({
      eventType: AuditEventType.MemberJoined,
      targetUserId: member.id,
      payload: { username: member.user.username, joinedAt: member.joinedTimestamp },
    });

    if (!settings.featureWelcomeEnabled) return;

    // If OBSCR role is configured, mark the member as verification-in-progress.
    if (settings.roleObscrId) {
      await member.roles.add(settings.roleObscrId, 'Verification started').catch(() => null);
    }

    // Fire-and-forget the verification flow (it's long-running; don't block the event).
    runVerification(client, member).catch((err) => {
      logger.error(Object(err), `Verification flow crashed for ${member.user.tag}`);
    });
  },
});
