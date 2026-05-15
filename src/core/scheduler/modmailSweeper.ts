import { Colors, EmbedBuilder } from 'discord.js';

import type { Client } from '~/core/models';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';
import {
  AuditEventType,
  closeModmail,
  listModmailsPendingReminder,
  listModmailsPendingStale,
  listStalePendingExpired,
  recordAuditEvent,
  setModmailStalePending,
  setReminderSent,
} from '~/database';
import { buildKeepOpenRow } from '~/core/components/Modmail';

const POLL_INTERVAL_MS = 60 * 60 * 1000;

export const startModmailSweeper = (client: Client): ReturnType<typeof setInterval> => {
  const logger = Logger.getInstance(AppFeature.Modmail);

  const sweep = async () => {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
      if (!guild) return;

      // ── 7-day inactivity reminders ─────────────────────────────────────────
      const pendingReminders = await listModmailsPendingReminder();
      for (const modmail of pendingReminders) {
        try {
          const user = await client.users.fetch(modmail.userId).catch(() => null);
          if (user) {
            const dmChannel = await user.createDM().catch(() => null);
            await dmChannel
              ?.send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(Colors.Yellow)
                    .setTitle(`⏳ Modmail Reminder — #${modmail.id}`)
                    .setDescription(
                      'Your modmail has had no activity for 7 days. Please send a message or close it if your inquiry has been resolved.'
                    )
                    .addFields({ name: 'Actions', value: '`/modmail message` — Send a message\n`/modmail close` — Close this modmail' })
                    .setTimestamp(),
                ],
              })
              .catch(() => null);
          }
          await setReminderSent(modmail.id);
          logger.info({ modmailId: modmail.id }, 'Sent 7-day inactivity reminder.');
        } catch (err) {
          logger.error(Object(err), `Failed to send reminder for modmail #${modmail.id}.`);
        }
      }

      // ── 30-day stale warnings ──────────────────────────────────────────────
      const pendingStale = await listModmailsPendingStale();
      for (const modmail of pendingStale) {
        try {
          const staleEmbed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle(`⚠️ Modmail Going Stale — #${modmail.id}`)
            .setDescription(
              'This modmail has been open for **30 days** and will be **automatically closed in 24 hours** unless someone keeps it open.'
            )
            .setTimestamp();
          const keepOpenRow = buildKeepOpenRow(modmail.id);

          let threadMsgId = '';
          const thread = await guild.channels.fetch(modmail.threadId).catch(() => null);
          if (thread?.isThread()) {
            const msg = await thread.send({ embeds: [staleEmbed], components: [keepOpenRow] }).catch(() => null);
            threadMsgId = msg?.id ?? '';
          }

          let dmMsgId = '';
          const user = await client.users.fetch(modmail.userId).catch(() => null);
          if (user) {
            const dmChannel = await user.createDM().catch(() => null);
            const msg = await dmChannel?.send({ embeds: [staleEmbed], components: [keepOpenRow] }).catch(() => null);
            dmMsgId = msg?.id ?? '';
          }

          await setModmailStalePending(modmail.id, threadMsgId, dmMsgId);
          logger.info({ modmailId: modmail.id }, 'Sent 30-day stale warning.');
        } catch (err) {
          logger.error(Object(err), `Failed to send stale warning for modmail #${modmail.id}.`);
        }
      }

      // ── 24h stale expiry — auto-close ──────────────────────────────────────
      const expired = await listStalePendingExpired();
      for (const modmail of expired) {
        try {
          await closeModmail(modmail.id);
          await recordAuditEvent({ eventType: AuditEventType.ModmailStaleClosed, targetUserId: modmail.userId, payload: { modmailId: modmail.id } });

          const closedEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`🔒 Modmail Auto-Closed — #${modmail.id}`)
            .setDescription('This modmail was automatically closed after 30 days with no response to the stale warning.')
            .setTimestamp();

          const thread = await guild.channels.fetch(modmail.threadId).catch(() => null);
          if (thread?.isThread()) {
            if (modmail.staleMessageId) {
              const msg = await thread.messages.fetch(modmail.staleMessageId).catch(() => null);
              await msg?.edit({ components: [] }).catch(() => null);
            }
            await thread.send({ embeds: [closedEmbed] }).catch(() => null);
            try {
              await thread.setArchived(true);
            } catch {
              /* archive is best-effort */
            }
          }

          const user = await client.users.fetch(modmail.userId).catch(() => null);
          if (user) {
            const dmChannel = await user.createDM().catch(() => null);
            if (modmail.staleDmMessageId) {
              const msg = await dmChannel?.messages.fetch(modmail.staleDmMessageId).catch(() => null);
              await msg?.edit({ components: [] }).catch(() => null);
            }
            await dmChannel?.send({ embeds: [closedEmbed] }).catch(() => null);
          }

          logger.info({ modmailId: modmail.id }, 'Auto-closed stale modmail.');
        } catch (err) {
          logger.error(Object(err), `Failed to auto-close stale modmail #${modmail.id}.`);
        }
      }
    } catch (error) {
      logger.error(Object(error), 'Modmail sweeper: unexpected failure.');
    }
  };

  sweep();
  return setInterval(sweep, POLL_INTERVAL_MS);
};
