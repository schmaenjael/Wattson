import { AppFeature } from '~/settings';
import { AuditEventType, deactivateBan, listExpiredActiveBans, recordAuditEvent } from '~/database';
import { Schedulable } from '~/core/models/Schedulable';

export const banSchedulable = new Schedulable({
  name: 'ban-schedulable',
  feature: AppFeature.Ban,
  description: 'Lifts expired bans and records audit events.',
  defaultCron: '* * * * *',
  execute: async (client, logger) => {
    const rows = await listExpiredActiveBans();
    if (rows.length === 0) {
      return;
    }

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) {
      logger.error('Ban sweeper: guild not found; skipping this tick.');
      return;
    }

    let lifted = 0;
    for (const ban of rows) {
      if (!ban.targetUserId) {
        await deactivateBan(ban.id);
        continue;
      }
      try {
        await guild.bans.remove(ban.targetUserId, 'Automatic unban — ban expired');
        await deactivateBan(ban.id);
        await recordAuditEvent({
          eventType: AuditEventType.BanLifted,
          targetUserId: ban.targetUserId,
          payload: { banId: ban.id, reason: 'expired' },
        });
        logger.info({ banId: ban.id }, 'Ban expired and was lifted.');
        lifted++;
      } catch (err) {
        logger.error(Object(err), `Failed to lift ban #${ban.id} for ${ban.targetUserId}.`);
      }
    }

    return `Lifted ${lifted} of ${rows.length} expired ban(s).`;
  },
});
