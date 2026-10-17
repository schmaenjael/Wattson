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
import { logSoftFailure, attempt, softFail } from '~/utilities';

export const modmailSchedulable = new Schedulable({
  name: 'modmail-schedulable',
  feature: AppFeature.Modmail,
  description: 'Sends inactivity reminders, stale warnings, and auto-closes expired modmails.',
  defaultCron: () => getConfig().config.schedules.modmailStale,
  execute: async (client, logger) => {
    if (!getConfig().config.features.modmail) return;

    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(softFail(AppFeature.Modmail, 'MODMAIL_GUILD_FETCH'));
    if (!guild) {
      return;
    }

    let reminders = 0;
    let staleWarnings = 0;
    let closedCount = 0;

    const pendingReminders = await listModmailsPendingReminder();
    for (const modmail of pendingReminders) {
      try {
        const user = modmail.userId
          ? await client.users.fetch(modmail.userId).catch(softFail(AppFeature.Modmail, 'MODMAIL_USER_FETCH', { userId: modmail.userId }))
          : null;
        let delivered = false;
        if (user) {
          const dmChannel = await user.createDM().catch(softFail(AppFeature.Modmail, 'MODMAIL_DM_OPEN'));
          delivered =
            (await dmChannel
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
              .then(() => true)
              .catch(softFail(AppFeature.Modmail, 'MODMAIL_STALE_PROMPT_DELIVERY', { modmailId: modmail.id, userId: modmail.userId }, false))) ??
            false;
        } else {
          logger.warn({ modmailId: modmail.id, userId: modmail.userId }, 'Could not fetch user for inactivity reminder DM.');
        }
        if (!delivered) {
          // Flagging the reminder as sent would retire the row from listModmailsPendingReminder(),
          // so the user is never warned before the stale sweeper closes their inquiry.
          logger.error({ modmailId: modmail.id }, 'Inactivity reminder DM failed — leaving the modmail eligible for a retry.');
          continue;
        }
        await setReminderSent(modmail.id);
        logger.info({ modmailId: modmail.id }, 'Sent 7-day inactivity reminder.');
        reminders++;
      } catch (err) {
        logSoftFailure(AppFeature.Modmail, 'MODMAIL_INACTIVITY_REMINDER', { modmailId: modmail.id, userId: modmail.userId }, err);
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
          guild.channels.fetch(modmail.threadId).catch(softFail(AppFeature.Modmail, 'MODMAIL_CHANNEL_FETCH', { threadId: modmail.threadId })),
          modmail.userId
            ? client.users.fetch(modmail.userId).catch(softFail(AppFeature.Modmail, 'MODMAIL_USER_FETCH', { userId: modmail.userId }))
            : Promise.resolve(null),
        ]);

        let threadMsgId: string | null = null;
        if (thread?.isThread()) {
          const msg = await thread
            .send({ embeds: [staleEmbed], components: [keepOpenRow] })
            .catch(softFail(AppFeature.Modmail, 'MODMAIL_THREAD_SEND'));
          threadMsgId = msg?.id ?? null;
        }

        let dmMsgId: string | null = null;
        if (user) {
          const dmChannel = await user.createDM().catch(softFail(AppFeature.Modmail, 'MODMAIL_DM_OPEN'));
          const msg = await dmChannel
            ?.send({ embeds: [staleEmbed], components: [keepOpenRow] })
            .catch(softFail(AppFeature.Modmail, 'MODMAIL_DM_SEND'));
          dmMsgId = msg?.id ?? null;
        } else {
          logger.warn({ modmailId: modmail.id, userId: modmail.userId }, 'Could not fetch user for stale warning DM.');
        }

        if (!threadMsgId && !dmMsgId) {
          // Neither warning was delivered, so nobody has a "Keep Open" button. Transitioning to
          // StalePending would auto-close a live inquiry 24h later with no chance to object.
          logger.error({ modmailId: modmail.id }, 'Stale warning could not be delivered anywhere — not marking the modmail stale-pending.');
          continue;
        }

        await setModmailStalePending(modmail.id, threadMsgId, dmMsgId);
        logger.info({ modmailId: modmail.id }, 'Sent 30-day stale warning.');
        staleWarnings++;
      } catch (err) {
        logSoftFailure(AppFeature.Modmail, 'MODMAIL_STALE_WARNING', { modmailId: modmail.id, userId: modmail.userId }, err);
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
          guild.channels.fetch(modmail.threadId).catch(softFail(AppFeature.Modmail, 'MODMAIL_CHANNEL_FETCH', { threadId: modmail.threadId })),
          modmail.userId
            ? client.users.fetch(modmail.userId).catch(softFail(AppFeature.Modmail, 'MODMAIL_USER_FETCH', { userId: modmail.userId }))
            : Promise.resolve(null),
        ]);

        if (thread?.isThread()) {
          const summary = await fetchModmailSummary(client, modmail.threadId);
          if (summary) {
            await setModmailSummary(modmail.id, summary);
          }
          if (modmail.staleMessageId) {
            const msg = await thread.messages
              .fetch(modmail.staleMessageId)
              .catch(softFail(AppFeature.Modmail, 'MODMAIL_MESSAGE_FETCH', { staleMessageId: modmail.staleMessageId }));
            await msg?.edit({ components: [] }).catch(softFail(AppFeature.Modmail, 'MODMAIL_MESSAGE_EDIT'));
          }
          await thread.send({ embeds: [closedEmbed] }).catch(softFail(AppFeature.Modmail, 'MODMAIL_THREAD_SEND'));
          if (summary) {
            await thread
              .send({ embeds: [new ModmailSummaryEmbed({ summary, modmailId: modmail.id }).render()] })
              .catch(softFail(AppFeature.Modmail, 'MODMAIL_THREAD_SEND'));
          }
          await attempt(async () => await thread.setArchived(true), {
            feature: AppFeature.Modmail,
            errorCode: 'MODMAIL_THREAD_ARCHIVE',
            context: { modmailId: modmail.id, threadId: modmail.threadId },
          });
        }

        if (user) {
          const dmChannel = await user.createDM().catch(softFail(AppFeature.Modmail, 'MODMAIL_DM_OPEN'));
          if (modmail.staleDmMessageId) {
            const msg = await dmChannel?.messages
              .fetch(modmail.staleDmMessageId)
              .catch(softFail(AppFeature.Modmail, 'MODMAIL_MESSAGE_FETCH', { staleDmMessageId: modmail.staleDmMessageId }));
            await msg?.edit({ components: [] }).catch(softFail(AppFeature.Modmail, 'MODMAIL_MESSAGE_EDIT'));
          }
          await dmChannel?.send({ embeds: [closedEmbed] }).catch(softFail(AppFeature.Modmail, 'MODMAIL_DM_SEND'));
        } else {
          logger.warn({ modmailId: modmail.id, userId: modmail.userId }, 'Could not fetch user for auto-close DM.');
        }

        await dispatchCloseAction(client, modmail);
        logger.info({ modmailId: modmail.id }, 'Auto-closed stale modmail.');
        closedCount++;
      } catch (err) {
        logSoftFailure(AppFeature.Modmail, 'MODMAIL_AUTO_CLOSE', { modmailId: modmail.id, threadId: modmail.threadId }, err);
      }
    }

    if (reminders === 0 && staleWarnings === 0 && closedCount === 0) {
      return;
    }
    return `Reminders: ${reminders}, stale warnings: ${staleWarnings}, auto-closed: ${closedCount}.`;
  },
});
