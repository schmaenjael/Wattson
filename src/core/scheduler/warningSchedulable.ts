import { AppFeature } from '~/settings';
import { AuditEventType, listExpiredActiveWarnings, ModerationStatus, recordAuditEvent, updateWarningStatus } from '~/database';
import { Schedulable } from '~/core/models/Schedulable';

export const warningSchedulable = new Schedulable({
  name: 'warning-schedulable',
  feature: AppFeature.Warn,
  description: 'Marks expired warnings as expired and records audit events.',
  defaultCron: '0 * * * *',
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
        logger.error(Object(err), `Failed to expire warning #${warning.id}.`);
      }
    }

    return `Expired ${expired} of ${rows.length} warning(s).`;
  },
});
