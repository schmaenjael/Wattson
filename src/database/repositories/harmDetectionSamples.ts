import { and, desc, eq, inArray, isNotNull, isNull, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';

import { getDb } from '~/database/client';
import { harmDetectionSamples } from '~/database/schema/harmDetectionSamples';
import { reports } from '~/database/schema/reports';
import { warnings } from '~/database/schema/warnings';
import { HarmSampleLabel, HarmSampleLabelSource, ReportStatus } from '~/database/schema/enums';

export type HarmDetectionSample = InferSelectModel<typeof harmDetectionSamples>;
export type NewHarmDetectionSample = Omit<
  InferInsertModel<typeof harmDetectionSamples>,
  'id' | 'humanLabel' | 'labelSource' | 'labeledAt' | 'createdAt'
>;

export const insertHarmSample = async (input: NewHarmDetectionSample): Promise<HarmDetectionSample> => {
  const db = getDb();
  const [row] = await db.insert(harmDetectionSamples).values(input).returning();
  return row;
};

export const listUnlabeledHarmSamples = async (limit = 1000): Promise<HarmDetectionSample[]> => {
  const db = getDb();
  return db
    .select()
    .from(harmDetectionSamples)
    .where(isNull(harmDetectionSamples.humanLabel))
    .orderBy(desc(harmDetectionSamples.createdAt))
    .limit(limit);
};

export const listLabeledHarmSamples = async (limit = 5000): Promise<HarmDetectionSample[]> => {
  const db = getDb();
  return db
    .select()
    .from(harmDetectionSamples)
    .where(isNotNull(harmDetectionSamples.humanLabel))
    .orderBy(desc(harmDetectionSamples.createdAt))
    .limit(limit);
};

/**
 * Retro-labels unlabeled samples from settled human decisions:
 *  - auto-warning lifted by a moderator -> the message was not harmful (false positive)
 *  - a human report on the same message resolved -> harmful / dismissed -> not harmful
 * Each pass only touches still-unlabeled rows, so the strongest signal (revoke) wins.
 * Returns the number of samples newly labeled.
 */
export const retroLabelHarmSamples = async (): Promise<number> => {
  const db = getDb();
  const now = new Date();
  let labeled = 0;

  const revokedWarningIds = db.select({ id: warnings.id }).from(warnings).where(isNotNull(warnings.revokedAt));
  const fromRevoked = await db
    .update(harmDetectionSamples)
    .set({ humanLabel: HarmSampleLabel.NotHarmful, labelSource: HarmSampleLabelSource.WarningRevoked, labeledAt: now })
    .where(
      and(
        isNull(harmDetectionSamples.humanLabel),
        isNotNull(harmDetectionSamples.warningId),
        inArray(harmDetectionSamples.warningId, revokedWarningIds)
      )
    )
    .returning({ id: harmDetectionSamples.id });
  labeled += fromRevoked.length;

  const labelFromReports = async (status: ReportStatus, label: HarmSampleLabel, source: HarmSampleLabelSource): Promise<number> => {
    const messageIds = db
      .select({ messageId: reports.messageId })
      .from(reports)
      .where(and(eq(reports.status, status), isNotNull(reports.messageId)));
    const updated = await db
      .update(harmDetectionSamples)
      .set({ humanLabel: label, labelSource: source, labeledAt: now })
      .where(and(isNull(harmDetectionSamples.humanLabel), inArray(harmDetectionSamples.messageId, messageIds)))
      .returning({ id: harmDetectionSamples.id });
    return updated.length;
  };

  labeled += await labelFromReports(ReportStatus.Resolved, HarmSampleLabel.Harmful, HarmSampleLabelSource.ReportResolved);
  labeled += await labelFromReports(ReportStatus.Dismissed, HarmSampleLabel.NotHarmful, HarmSampleLabelSource.ReportDismissed);

  return labeled;
};

export const deleteHarmSamplesForUser = async (userId: string): Promise<number> => {
  const db = getDb();
  const result = await db.delete(harmDetectionSamples).where(eq(harmDetectionSamples.authorId, userId)).returning();
  return result.length;
};
