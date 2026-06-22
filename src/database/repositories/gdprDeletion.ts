import { eq, inArray, or } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { auditLog } from '~/database/schema/auditLog';
import { bans } from '~/database/schema/bans';
import { courtCases } from '~/database/schema/courtCases';
import { eventRegistrations } from '~/database/schema/eventRegistrations';
import { externalPosts } from '~/database/schema/externalPosts';
import { memberActivityDaily } from '~/database/schema/memberActivityDaily';
import { memberHistory } from '~/database/schema/memberHistory';
import { reports } from '~/database/schema/reports';
import { starboardEntries } from '~/database/schema/starboardEntries';
import { suggestionVotes } from '~/database/schema/suggestionVotes';
import { usernameHistory } from '~/database/schema/usernameHistory';
import { users } from '~/database/schema/users';
import { warnings } from '~/database/schema/warnings';
import { mutes } from '~/database/schema/mutes';
import { voltVerifications } from '~/database/schema/voltVerifications';

export const GDPR_DELETED_USERNAME = '[deleted]';

export const executeGdprDeletion = async (targetUserId: string, moderatorId: string): Promise<void> => {
  const db = getDb();

  await db.transaction(async (tx) => {
    const userStarboard = await tx
      .select({ sourceMessageId: starboardEntries.sourceMessageId })
      .from(starboardEntries)
      .where(eq(starboardEntries.authorId, targetUserId));

    if (userStarboard.length > 0) {
      await tx.delete(externalPosts).where(
        inArray(
          externalPosts.sourceMessageId,
          userStarboard.map((e) => e.sourceMessageId)
        )
      );
    }

    await tx.delete(starboardEntries).where(eq(starboardEntries.authorId, targetUserId));
    await tx.delete(courtCases).where(eq(courtCases.accusedUserId, targetUserId));
    await tx.delete(reports).where(or(eq(reports.reporterId, targetUserId), eq(reports.reportedUserId, targetUserId)));
    await tx.delete(warnings).where(eq(warnings.targetUserId, targetUserId));
    await tx.delete(mutes).where(eq(mutes.targetUserId, targetUserId));
    await tx.delete(bans).where(eq(bans.targetUserId, targetUserId));
    await tx.delete(usernameHistory).where(eq(usernameHistory.userId, targetUserId));
    await tx.delete(auditLog).where(or(eq(auditLog.actorUserId, targetUserId), eq(auditLog.targetUserId, targetUserId)));
    await tx.delete(voltVerifications).where(eq(voltVerifications.discordUserId, targetUserId));

    // Anonymize data that cannot be fully deleted (PK part of composite key, or needed for integrity)
    await tx.update(memberHistory).set({ userId: null }).where(eq(memberHistory.userId, targetUserId));
    await tx.update(suggestionVotes).set({ voterId: null }).where(eq(suggestionVotes.voterId, targetUserId));
    // Activity and registrations have userId as part of composite PK — must delete rows
    await tx.delete(memberActivityDaily).where(eq(memberActivityDaily.userId, targetUserId));
    await tx.delete(eventRegistrations).where(eq(eventRegistrations.userId, targetUserId));

    await tx.update(users).set({ username: GDPR_DELETED_USERNAME }).where(eq(users.id, targetUserId));

    await tx.insert(bans).values({ targetUserId, moderatorId, reason: 'Data Deletion Request (GDPR/DSGVO)', expiresAt: null, appealable: false });
  });
};
