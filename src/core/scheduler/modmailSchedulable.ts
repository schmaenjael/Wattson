import { Colors, EmbedBuilder } from 'discord.js';

import { AppFeature } from '~/settings';
import {
  AuditEventType,
  closeModmail,
  listModmailsPendingReminder,
  listModmailsPendingStale,
  listStalePendingExpired,
  recordAuditEvent,
  setModmailStalePending,
  setModmailSummary,
  setReminderSent,
} from '~/database';
import { getConfig } from '~/config';
import { ModmailSummaryEmbed, buildKeepOpenRow } from '~/core/components/Modmail';
import { dispatchCloseAction, fetchModmailSummary } from '~/core/providers/modmail';
import { Schedulable } from '~/core/models/Schedulable';
import { attempt } from '~/utilities';

export const modmailSchedulable = new Schedulable({
  name: 'modmail-schedulable',
  feature: AppFeature.Modmail,
  description: 'Sends inactivity reminders, stale warnings, and auto-closes expired modmails.',
  defaultCron: () => getConfig().config.schedules.modmailStale,
  execute: async (client, logger) => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) {
      return;
    }

    let reminders = 0;
    let staleWarnings = 0;
    let closedCount = 0;

    const pendingReminders = await listModmailsPendingReminder();
    for (const modmail of pendingReminders) {
      try {
        const user = modmail.userId ? await client.users.fetch(modmail.userId).catch(() => null) : null;
        if (user) {
          const dmChannel = await user.createDM().catch(() => null);
          await dmChannel
            ?.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(Colors.Yellow)
                  .setTitle(`⏳ Modmail Reminder — #${modmail.id}`)
                  .setDescription('Your modmail has had no activity for 7 days. Please send a message or close it if your inquiry has been resolved.')
                  .addFields({ name: 'Actions', value: '`/modmail message` — Send a message\n`/modmail close` — Close this modmail' })
                  .setTimestamp(),
              ],
            })
            .catch(() => null);
        } else {
          logger.warn({ modmailId: modmail.id, userId: modmail.userId }, 'Could not fetch user for inactivity reminder DM.');
        }
        await setReminderSent(modmail.id);
        logger.info({ modmailId: modmail.id }, 'Sent 7-day inactivity reminder.');
        reminders++;
      } catch (err) {
        logger.error(Object(err), `Failed to send reminder for modmail #${modmail.id}.`);
      }
    }

    const pendingStale = await listModmailsPendingStale();
    for (const modmail of pendingStale) {
      try {
        const staleEmbed = new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle(`⚠️ Modmail Going Stale — #${modmail.id}`)
          .setDescription('This modmail has been open for **30 days** and will be **automatically closed in 24 hours** unless someone keeps it open.')
          .setTimestamp();
        const keepOpenRow = buildKeepOpenRow(modmail.id);

        const [thread, user] = await Promise.all([
          guild.channels.fetch(modmail.threadId).catch(() => null),
          modmail.userId ? client.users.fetch(modmail.userId).catch(() => null) : Promise.resolve(null),
        ]);

        let threadMsgId: string | null = null;
        if (thread?.isThread()) {
          const msg = await thread.send({ embeds: [staleEmbed], components: [keepOpenRow] }).catch(() => null);
          threadMsgId = msg?.id ?? null;
        }

        let dmMsgId: string | null = null;
        if (user) {
          const dmChannel = await user.createDM().catch(() => null);
          const msg = await dmChannel?.send({ embeds: [staleEmbed], components: [keepOpenRow] }).catch(() => null);
          dmMsgId = msg?.id ?? null;
        } else {
          logger.warn({ modmailId: modmail.id, userId: modmail.userId }, 'Could not fetch user for stale warning DM.');
        }

        await setModmailStalePending(modmail.id, threadMsgId, dmMsgId);
        logger.info({ modmailId: modmail.id }, 'Sent 30-day stale warning.');
        staleWarnings++;
      } catch (err) {
        logger.error(Object(err), `Failed to send stale warning for modmail #${modmail.id}.`);
      }
    }

    const expired = await listStalePendingExpired();
    for (const modmail of expired) {
      try {
        await closeModmail(modmail.id);
        await recordAuditEvent({
          eventType: AuditEventType.ModmailStaleClosed,
          targetUserId: modmail.userId ?? undefined,
          payload: { modmailId: modmail.id },
        });

        const closedEmbed = new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle(`🔒 Modmail Auto-Closed — #${modmail.id}`)
          .setDescription('This modmail was automatically closed after 30 days with no response to the stale warning.')
          .setTimestamp();

        const [thread, user] = await Promise.all([
          guild.channels.fetch(modmail.threadId).catch(() => null),
          modmail.userId ? client.users.fetch(modmail.userId).catch(() => null) : Promise.resolve(null),
        ]);

        if (thread?.isThread()) {
          const summary = await fetchModmailSummary(client, modmail.threadId);
          if (summary) {
            await setModmailSummary(modmail.id, summary);
          }
          if (modmail.staleMessageId) {
            const msg = await thread.messages.fetch(modmail.staleMessageId).catch(() => null);
            await msg?.edit({ components: [] }).catch(() => null);
          }
          await thread.send({ embeds: [closedEmbed] }).catch(() => null);
          if (summary) {
            await thread.send({ embeds: [new ModmailSummaryEmbed({ summary, modmailId: modmail.id }).render()] }).catch(() => null);
          }
          await attempt(async () => {
            await thread.setArchived(true);
          });
        }

        if (user) {
          const dmChannel = await user.createDM().catch(() => null);
          if (modmail.staleDmMessageId) {
            const msg = await dmChannel?.messages.fetch(modmail.staleDmMessageId).catch(() => null);
            await msg?.edit({ components: [] }).catch(() => null);
          }
          await dmChannel?.send({ embeds: [closedEmbed] }).catch(() => null);
        } else {
          logger.warn({ modmailId: modmail.id, userId: modmail.userId }, 'Could not fetch user for auto-close DM.');
        }

        await dispatchCloseAction(client, modmail);
        logger.info({ modmailId: modmail.id }, 'Auto-closed stale modmail.');
        closedCount++;
      } catch (err) {
        logger.error(Object(err), `Failed to auto-close stale modmail #${modmail.id}.`);
      }
    }

    if (reminders === 0 && staleWarnings === 0 && closedCount === 0) {
      return;
    }
    return `Reminders: ${reminders}, stale warnings: ${staleWarnings}, auto-closed: ${closedCount}.`;
  },
});
