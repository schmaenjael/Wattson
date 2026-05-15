import { Client } from '~/core/models';
import { AppFeature } from '~/settings';
import { AuditEventType, deactivateMute, listExpiredActiveMutes, recordAuditEvent, getSettings } from '~/database';
import { Logger } from '~/utilities';

const POLL_INTERVAL_MS = 60_000;

export const startMuteSweeper = (client: Client) => {
  const logger = Logger.getInstance(AppFeature.Warn);

  const sweep = async () => {
    try {
      const rows = await listExpiredActiveMutes();
      if (rows.length === 0) return;

      const settings = await getSettings();
      if (!settings.roleMutedId) return;

      const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
      if (!guild) {
        logger.error('Mute sweeper: guild not found; skipping this tick.');
        return;
      }

      for (const mute of rows) {
        try {
          const member = await guild.members.fetch(mute.targetUserId).catch(() => null);
          if (member) {
            await member.roles.remove(settings.roleMutedId!, 'Automatic unmute — mute expired');
          }
          await deactivateMute(mute.id);
          await recordAuditEvent({
            eventType: AuditEventType.MuteLifted,
            targetUserId: mute.targetUserId,
            payload: { muteId: mute.id, reason: 'expired' },
          });
          logger.info(`Mute #${mute.id} expired and was lifted.`);
        } catch (err) {
          logger.error(Object(err), `Mute sweeper: failed to lift mute #${mute.id} for ${mute.targetUserId}.`);
        }
      }
    } catch (error) {
      logger.error(Object(error), 'Mute sweeper: unexpected failure.');
    }
  };

  sweep();
  return setInterval(sweep, POLL_INTERVAL_MS);
};
