import { ChannelType, EmbedBuilder, type Guild, type TextChannel, ThreadAutoArchiveDuration, type User } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
import {
  AuditEventType,
  countBansForUser,
  countReportsForUser,
  countWarningsForUser,
  insertCourtCase,
  recordAuditEvent,
  upsertUser,
  type CourtCase,
} from '~/database';
import { BotException } from '~/core/models';
import type { Client } from '~/core/models';

const COLOR = appFeatureMap[AppFeature.System].color;

/**
 * Opens a court case: creates the private thread, mutes the accused, records
 * the case + audit event, and posts the case-opened notice. Caller (the
 * command) is responsible for the precondition checks that produce
 * user-facing "configure X first" replies before calling this.
 */
export const openCourtCase = async (
  client: Client,
  guild: Guild,
  courtParentChannelId: string,
  roleMutedId: string,
  moderator: User,
  accused: User,
  reason: string
): Promise<CourtCase> => {
  const parent = (await guild.channels.fetch(courtParentChannelId)) as TextChannel | null;
  if (!parent) throw new BotException(client, 'Court parent channel not found.');

  await Promise.all([upsertUser({ id: accused.id, username: accused.username }), upsertUser({ id: moderator.id, username: moderator.username })]);

  const accusedMember = await guild.members.fetch(accused.id).catch(() => null);
  if (!accusedMember) throw new BotException(client, `Accused user ${accused.tag} is not in the guild.`);

  const [reportCount, warnCount, banCount] = await Promise.all([
    countReportsForUser(accused.id),
    countWarningsForUser(accused.id),
    countBansForUser(accused.id),
  ]);

  const thread = await parent.threads.create({
    name: `court-${accused.username.slice(0, 16)}-${Date.now().toString(36)}`,
    type: ChannelType.PrivateThread,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    invitable: false,
    reason: `Court case opened by ${moderator.tag}`,
  });

  await thread.members.add(accused.id).catch(() => null);
  await thread.members.add(moderator.id).catch(() => null);

  await accusedMember.roles.add(roleMutedId, `Court case opened: ${reason}`).catch(() => null);

  const record = await insertCourtCase({
    accusedUserId: accused.id,
    openedByModeratorId: moderator.id,
    threadId: thread.id,
    parentChannelId: parent.id,
    reason,
  });

  await recordAuditEvent({
    eventType: AuditEventType.CourtOpened,
    actorUserId: moderator.id,
    targetUserId: accused.id,
    payload: { caseId: record.id, threadId: thread.id, reason },
  });

  await thread.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`⚖️ Court Case #${record.id}`)
        .setDescription(
          [
            `<@${accused.id}>, a court case has been opened against you.`,
            `You are currently **muted server-wide** and may only respond **in this thread**.`,
            ``,
            `**Reason**`,
            reason,
            ``,
            `**User History**`,
            `Reports filed against you: **${reportCount}**`,
            `Warnings on record: **${warnCount}**`,
            `Bans on record: **${banCount}**`,
            ``,
            `**Notice**`,
            `We welcome members of all backgrounds. However, we reserve the right to decide who may remain on this server and may remove members or content at any time.`,
            ``,
            `Court cases may take time. **At least ${3} moderators** must reach a unanimous conclusion before this case can be closed.`,
          ].join('\n')
        )
        .setFooter({ text: `Opened by ${moderator.tag}` })
        .setTimestamp(record.openedAt),
    ],
  });

  return record;
};
