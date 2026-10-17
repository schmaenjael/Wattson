import { AppFeature } from '~/settings';
import { AuditEventType, listExpiredActiveWarnings, ModerationStatus, recordAuditEvent, updateWarningStatus } from '~/database';
import { getConfig } from '~/config';
import { Schedulable } from '~/core/models/Schedulable';
import { logSoftFailure } from '~/utilities';

export const warningSchedulable = new Schedulable({
  name: 'warning-schedulable',
  feature: AppFeature.Warn,
  description: 'Marks expired warnings as expired and records audit events.',
  defaultCron: () => getConfig().config.schedules.warningSweep,
  execute: async (_client, logger) => {
    const rows = await listExpiredActiveWarnings();
    if (rows.length === 0) {
      return;
    }

    let expired = 0;

    for (const warning of rows) {
      try {
        await updateWarningStatus(warning.id, ModerationStatus.Expired);
        await recordAuditEvent({
          eventType: AuditEventType.WarnRevoked,
          targetUserId: warning.targetUserId ?? undefined,
          payload: { warningId: warning.id, reason: 'expired' },
        });
        logger.info({ warningId: warning.id }, 'Warning expired.');
        expired++;
      } catch (err) {
        logSoftFailure(AppFeature.Warn, 'WARN_EXPIRY', { warningId: warning.id }, err);
      }
    }

    return `Expired ${expired} of ${rows.length} warning(s).`;
  },
});
