import { EmbedBuilder } from 'discord.js';

import { AppFeature } from '~/settings';
import {
  deleteVerification,
  getSettings,
  listAllVerifications,
  listExpiredVerifications,
  listVerificationsExpiringSoon,
  setReverificationNotified,
} from '~/database';
import { getLogtoUser } from '~/core/providers/logto';
import { Schedulable } from '~/core/models/Schedulable';
import { Logger } from '~/utilities';

const REVERIFY_WARN_DAYS = 7;

export const verificationSchedulable = new Schedulable({
  name: 'verification-sweeper',
  feature: AppFeature.VerificationSweeper,
  description: 'Reverification DMs, Volt role expiry, and LogTo suspension checks.',
  defaultCron: '0 0 * * *',
  execute: async (client, logger) => {
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
    let rolesRevoked = 0;
    let suspended = 0;

    const expiringSoon = await listVerificationsExpiringSoon(REVERIFY_WARN_DAYS).catch(() => []);
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
                `Your Volt membership verification expires <t:${Math.floor(row.expiresAt.getTime() / 1000)}:R>.\n\nUse \`/verify volter\` in the server to re-verify within **${REVERIFY_WARN_DAYS} days** to keep your Volt member status.`
              )
              .setColor('#7C3AED'),
          ],
        });
        await setReverificationNotified(row.discordUserId);
        logger.info({ discordUserId: row.discordUserId }, 'Reverification DM sent.');
        dmsSent++;
      } catch (err) {
        logger.warn(Object(err), `Failed to send reverification DM to ${row.discordUserId}.`);
      }
    }

    const expired = await listExpiredVerifications().catch(() => []);
    for (const row of expired) {
      try {
        const member = await guild.members.fetch(row.discordUserId).catch(() => null);
        if (member && settings.roleMemberId) {
          await member.roles.remove(settings.roleMemberId, 'Volt verification expired').catch(() => null);
        }
        await deleteVerification(row.discordUserId);
        await log(
          new EmbedBuilder()
            .setTitle('⚠️ Volt Role Removed — Verification Expired')
            .setDescription(`<@${row.discordUserId}> did not re-verify their Volt membership in time.`)
            .addFields({ name: 'Discord ID', value: row.discordUserId, inline: true })
            .setColor('#EF4444')
            .setTimestamp(),
          `Volt verification expired — role removed for ${row.discordUserId}`
        );
        logger.info({ discordUserId: row.discordUserId }, 'Volt verification expired — role removed.');
        rolesRevoked++;
      } catch (err) {
        logger.error(Object(err), `Failed to process expiry for ${row.discordUserId}.`);
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
            .setColor('#DC2626')
            .setTimestamp(),
          `LogTo account suspended — Volt role removed for ${row.discordUserId}`
        );
        logger.info({ discordUserId: row.discordUserId }, 'LogTo account suspended — Volt role removed.');
        suspended++;
      } catch (err) {
        logger.warn(Object(err), `Failed suspension check for ${row.discordUserId}.`);
      }
    }

    if (dmsSent === 0 && rolesRevoked === 0 && suspended === 0) {
      return;
    }
    return `DMs sent: ${dmsSent}, roles revoked: ${rolesRevoked}, suspended: ${suspended}.`;
  },
});
