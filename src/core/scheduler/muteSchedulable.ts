import { AppFeature } from '~/settings';
import { AuditEventType, deactivateMute, getSettings, listExpiredActiveMutes, recordAuditEvent } from '~/database';
import { getConfig } from '~/config';
import { Schedulable } from '~/core/models/Schedulable';
import { logSoftFailure, softFail } from '~/utilities';

export const muteSchedulable = new Schedulable({
  name: 'mute-schedulable',
  feature: AppFeature.Mute,
  description: 'Removes the muted role from members whose mute has expired.',
  defaultCron: () => getConfig().config.schedules.muteSweep,
  execute: async (client, logger) => {
    const rows = await listExpiredActiveMutes();
    if (rows.length === 0) {
      return;
    }

    const settings = await getSettings();
    if (!settings.roleMutedId) {
      return;
    }

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(softFail(AppFeature.Mute, 'MUTE_GUILD_FETCH'));
    if (!guild) {
      logger.error('Mute sweeper: guild not found; skipping this tick.');
      return;
    }

    let lifted = 0;
    for (const mute of rows) {
      if (!mute.targetUserId) {
        await deactivateMute(mute.id);
        continue;
      }
      try {
        const member = await guild.members
          .fetch(mute.targetUserId)
          .catch(softFail(AppFeature.Mute, 'MUTE_MEMBER_FETCH', { targetUserId: mute.targetUserId }));
        if (member) {
          // Not caught here on purpose: a throw skips deactivateMute so the next tick retries,
          // instead of recording a lift that never reached Discord.
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
        logSoftFailure(AppFeature.Mute, 'MUTE_EXPIRY_LIFT', { muteId: mute.id, targetUserId: mute.targetUserId }, err);
      }
    }

    return `Lifted ${lifted} of ${rows.length} expired mute(s).`;
  },
});
