import { eq, inArray, or } from 'drizzle-orm';

import { getDb } from '../client';
import { auditLog } from '../schema/auditLog';
import { bans } from '../schema/bans';
import { courtCases } from '../schema/courtCases';
import { externalPosts } from '../schema/externalPosts';
import { reports } from '../schema/reports';
import { starboardEntries } from '../schema/starboardEntries';
import { usernameHistory } from '../schema/usernameHistory';
import { users } from '../schema/users';
import { warnings } from '../schema/warnings';
import { mutes } from '../schema/mutes';
import { voltVerifications } from '../schema/voltVerifications';

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

    await tx.update(users).set({ username: GDPR_DELETED_USERNAME }).where(eq(users.id, targetUserId));

    await tx.insert(bans).values({ targetUserId, moderatorId, reason: 'Data Deletion Request (GDPR/DSGVO)', expiresAt: null, appealable: false });
  });
};
