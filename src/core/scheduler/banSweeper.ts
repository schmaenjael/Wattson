import { Client } from '~/core/models';
import { AppFeature } from '~/settings';
import { AuditEventType, deactivateBan, listExpiredActiveBans, recordAuditEvent } from '~/database';
import { Logger } from '~/utilities';

const POLL_INTERVAL_MS = 60_000;

/**
 * Polls the `bans` table every minute for expired rows whose `active` flag is still
 * true. For each, lifts the Discord-side ban and deactivates the DB row. Designed
 * for single-process single-server use — if the bot is multi-process, move this
 * to a proper scheduler.
 */
export const startBanSweeper = (client: Client) => {
  const logger = Logger.getInstance(AppFeature.Ban);

  const sweep = async () => {
    try {
      const rows = await listExpiredActiveBans();
      if (rows.length === 0) return;

      const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
      if (!guild) {
        logger.error('Ban sweeper: guild not found; skipping this tick.');
        return;
      }

      for (const ban of rows) {
        try {
          await guild.bans.remove(ban.targetUserId, 'Automatic unban — ban expired');
          await deactivateBan(ban.id);
          await recordAuditEvent({
            eventType: AuditEventType.BanLifted,
            targetUserId: ban.targetUserId,
            payload: { banId: ban.id, reason: 'expired' },
          });
          logger.info(`Ban #${ban.id} expired and was lifted.`);
        } catch (err) {
          logger.error(Object(err), `Ban sweeper: failed to lift ban #${ban.id} for ${ban.targetUserId}.`);
        }
      }
    } catch (error) {
      logger.error(Object(error), 'Ban sweeper: unexpected failure.');
    }
  };

  sweep();
  return setInterval(sweep, POLL_INTERVAL_MS);
};
