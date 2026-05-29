import { AppFeature } from '~/settings';
import { AuditEventType, deactivateMute, getSettings, listExpiredActiveMutes, recordAuditEvent } from '~/database';
import { Schedulable } from '~/core/models/Schedulable';

export const muteSchedulable = new Schedulable({
  name: 'mute-sweeper',
  feature: AppFeature.Mute,
  description: 'Removes the muted role from members whose mute has expired.',
  defaultCron: '* * * * *',
  execute: async (client, logger) => {
    const rows = await listExpiredActiveMutes();
    if (rows.length === 0) {
      return;
    }

    const settings = await getSettings();
    if (!settings.roleMutedId) {
      return;
    }

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) {
      logger.error('Mute sweeper: guild not found; skipping this tick.');
      return;
    }

    let lifted = 0;
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
        logger.info({ muteId: mute.id }, 'Mute expired and was lifted.');
        lifted++;
      } catch (err) {
        logger.error(Object(err), `Failed to lift mute #${mute.id} for ${mute.targetUserId}.`);
      }
    }

    return `Lifted ${lifted} of ${rows.length} expired mute(s).`;
  },
});
