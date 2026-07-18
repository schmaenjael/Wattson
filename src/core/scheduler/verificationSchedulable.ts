import { EmbedBuilder } from 'discord.js';

import { AppFeature, Colors } from '~/settings';
import {
  deleteVerification,
  getSettings,
  listAllVerifications,
  listExpiredPendingKickNotice,
  listExpiredPastKickDeadline,
  listVerificationsExpiringSoon,
  setKickNotified,
  setReverificationNotified,
} from '~/database';
import { getConfig } from '~/config';
import { getLogtoUser } from '~/core/providers/logto';
import { Schedulable } from '~/core/models/Schedulable';
import { Logger, discordTimestamp } from '~/utilities';

export const verificationSchedulable = new Schedulable({
  name: 'verification-schedulable',
  feature: AppFeature.VerificationSweeper,
  description: 'Reverification DMs, Volt role expiry, and LogTo suspension checks.',
  defaultCron: () => getConfig().config.schedules.reverify,
  execute: async (client, logger) => {
    const reverifyWarnDays = getConfig().config.thresholds.reverifyWarnDays;
    const settings = await getSettings();
    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) {
      logger.error('Verification sweeper: guild not found; skipping this tick.');
      return;
    }

    const survLogger = Logger.getInstance(AppFeature.VerificationSweeper);
    const log = async (embed: EmbedBuilder, pinoMessage: string) => {
      await survLogger.log({ level: 'info', message: pinoMessage, target: 'surveillance', internalEmbed: embed });
    };

    let dmsSent = 0;
    let kickNoticesSent = 0;
    let kicked = 0;
    let suspended = 0;

    const expiringSoon = await listVerificationsExpiringSoon(reverifyWarnDays).catch(() => []);
    for (const row of expiringSoon) {
      try {
        const member = await guild.members.fetch(row.discordUserId).catch(() => null);
        if (!member) {
          continue;
        }
        const dm = await member.createDM().catch(() => null);
        if (!dm) {
          logger.warn({ discordUserId: row.discordUserId }, 'Could not open DM for reverification notice.');
          continue;
        }
        await dm.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🟣 Volt Membership Re-verification Required')
              .setDescription(
                `Your Volt membership verification expires ${discordTimestamp(row.expiresAt, 'R')}.\n\nUse \`/verify volter\` in the server to re-verify within **${reverifyWarnDays} days** to keep your Volt member status.`
              )
              .setColor(Colors.Purple),
          ],
        });
        await setReverificationNotified(row.discordUserId);
        logger.info({ discordUserId: row.discordUserId }, 'Reverification DM sent.');
        dmsSent++;
      } catch (err) {
        logger.warn(Object(err), `Failed to send reverification DM to ${row.discordUserId}.`);
      }
    }

    const pendingNotice = await listExpiredPendingKickNotice().catch(() => []);
    for (const row of pendingNotice) {
      try {
        const member = await guild.members.fetch(row.discordUserId).catch(() => null);
        if (!member) {
          continue;
        }
        const dm = await member.createDM().catch(() => null);
        if (!dm) {
          logger.warn({ discordUserId: row.discordUserId }, 'Could not open DM for kick notice.');
          continue;
        }
        await dm.send({
          content:
            'Your Volt verification expired. Do you still hold Volt membership? Re-verify with `/verify volter` within 7 days or you will be removed from the server.',
        });
        await setKickNotified(row.discordUserId);
        logger.info({ discordUserId: row.discordUserId }, 'Kick notice DM sent.');
        kickNoticesSent++;
      } catch (err) {
        logger.warn(Object(err), `Failed to send kick notice DM to ${row.discordUserId}.`);
      }
    }

    const pastDeadline = await listExpiredPastKickDeadline().catch(() => []);
    for (const row of pastDeadline) {
      try {
        const member = await guild.members.fetch(row.discordUserId).catch(() => null);
        if (member) {
          await member.kick('Volt verification expired — no re-verification after 7-day notice').catch(() => null);
        }
        await deleteVerification(row.discordUserId);
        await log(
          new EmbedBuilder()
            .setTitle('🚫 Member Kicked — Volt Verification Expired')
            .setDescription(`<@${row.discordUserId}> was removed after failing to re-verify within 7 days of expiry notice.`)
            .addFields({ name: 'Discord ID', value: row.discordUserId, inline: true })
            .setColor(Colors.Red)
            .setTimestamp(),
          `Volt verification expired — member kicked: ${row.discordUserId}`
        );
        logger.info({ discordUserId: row.discordUserId }, 'Volt verification expired — member kicked.');
        kicked++;
      } catch (err) {
        logger.error(Object(err), `Failed to kick ${row.discordUserId}.`);
      }
    }

    const all = await listAllVerifications().catch(() => []);
    for (const row of all) {
      try {
        const { isSuspended } = await getLogtoUser(row.logtoSub);
        if (!isSuspended) {
          continue;
        }
        const member = await guild.members.fetch(row.discordUserId).catch(() => null);
        if (member && settings.roleMemberId) {
          await member.roles.remove(settings.roleMemberId, 'LogTo account suspended').catch(() => null);
        }
        await deleteVerification(row.discordUserId);
        await log(
          new EmbedBuilder()
            .setTitle('⛔ Volt Role Removed — Account Suspended')
            .setDescription(`<@${row.discordUserId}>'s LogTo account has been suspended.`)
            .addFields({ name: 'Discord ID', value: row.discordUserId, inline: true })
            .setColor(Colors.Red)
            .setTimestamp(),
          `LogTo account suspended — Volt role removed for ${row.discordUserId}`
        );
        logger.info({ discordUserId: row.discordUserId }, 'LogTo account suspended — Volt role removed.');
        suspended++;
      } catch (err) {
        logger.warn(Object(err), `Failed suspension check for ${row.discordUserId}.`);
      }
    }

    if (dmsSent === 0 && kickNoticesSent === 0 && kicked === 0 && suspended === 0) {
      return;
    }
    return `Reverify DMs: ${dmsSent}, kick notices: ${kickNoticesSent}, kicked: ${kicked}, suspended: ${suspended}.`;
  },
});
