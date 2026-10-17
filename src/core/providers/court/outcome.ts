import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, MessageFlags, type Message } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
import {
  AuditEventType,
  closeCourtCase,
  CourtStatus,
  CourtVoteOption,
  insertBan,
  insertWarning,
  recordAuditEvent,
  upsertUser,
  type CourtCase,
  type Settings,
} from '~/database';
import type { Client } from '~/core/models';
import { summarizeCourtThread } from './summarizer';
import { attempt, Logger, logSoftFailure, runDiscordAction, softFail } from '~/utilities';

const COLOR = appFeatureMap[AppFeature.System].color;
const logger = Logger.getInstance(AppFeature.System);

// ─── Vote embed ────────────────────────────────────────────────────────────────

export interface VoteTallies {
  ban: number;
  warn: number;
  dismiss: number;
}

export const VOTE_THRESHOLD = 3;

export const buildVoteEmbed = (caseRow: CourtCase, tallies: VoteTallies, winner?: CourtVoteOption): EmbedBuilder => {
  const tallyLine = `🔨 Ban: **${tallies.ban}** · ⚠️ Warn: **${tallies.warn}** · 🚫 Dismiss: **${tallies.dismiss}**`;
  const description = winner
    ? `**Verdict reached: ${winner.toUpperCase()}**\n\n${tallyLine}`
    : [
        `The court is now in **deliberation**. Participants may no longer send messages.`,
        `**${VOTE_THRESHOLD} moderators** must agree on the same outcome to close the case.`,
        ``,
        tallyLine,
        ``,
        `*Only moderators may vote. You may change your vote at any time before the threshold is reached.*`,
      ].join('\n');

  return new EmbedBuilder().setColor(COLOR).setTitle(`🏛️ Court Vote — Case #${caseRow.id}`).setDescription(description).setTimestamp();
};

export const buildVoteRow = (caseId: number, disabled = false): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`court_vote:${caseId}:ban`).setLabel('Ban').setEmoji('🔨').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`court_vote:${caseId}:warn`)
      .setLabel('Warn')
      .setEmoji('⚠️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`court_vote:${caseId}:dismiss`)
      .setLabel('Dismiss')
      .setEmoji('🚫')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );

// ─── Thread helpers ─────────────────────────────────────────────────────────

export const fetchCourtSummary = async (client: Client, caseRow: CourtCase): Promise<string | null> => {
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT;
  const ollamaModel = process.env.OLLAMA_MODEL;
  if (!ollamaEndpoint || !ollamaModel) return null;

  try {
    const channel = await client.channels.fetch(caseRow.threadId);
    if (!channel || !channel.isThread()) return null;

    const collected: Message[] = [];
    let lastId: string | undefined;

    while (collected.length < 200) {
      const batch = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
      if (batch.size === 0) break;
      const msgs = [...batch.values()];
      collected.push(...msgs);
      lastId = msgs[msgs.length - 1]?.id;
      if (batch.size < 100) break;
    }

    collected.reverse();

    const threadMessages = collected
      .filter((m) => !m.author.bot && m.content.trim().length > 0)
      .map((m) => ({ author: m.author.username, content: m.content }));

    return summarizeCourtThread(ollamaEndpoint, ollamaModel, threadMessages);
  } catch (error) {
    logSoftFailure(AppFeature.System, 'COURT_THREAD_SUMMARY_FAILED', { ollamaModel }, error);
    return null;
  }
};

export const archiveCourtThread = async (client: Client, caseRow: CourtCase, message: string): Promise<void> => {
  await attempt(
    async () => {
      const channel = await client.channels.fetch(caseRow.threadId);
      if (channel && channel.isThread()) {
        await channel.send({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('Case closed').setDescription(message).setTimestamp()] });
        await attempt(async () => await channel.setArchived(true), {
          errorCode: 'COURT_THREAD_ARCHIVE',
          context: { caseId: caseRow.id, threadId: caseRow.threadId },
        });
      }
    },
    { errorCode: 'COURT_CLOSING_NOTICE_SEND', context: { caseId: caseRow.id, threadId: caseRow.threadId } }
  );
};

// ─── Outcome execution ───────────────────────────────────────────────────────

const DM_CONTENT: Record<CourtVoteOption, (id: number) => string> = {
  [CourtVoteOption.Ban]: (id) =>
    `The moderator panel has reviewed your court case (#${id}) and reached a verdict: **you have been permanently banned from the server**. If you believe this decision was made in error, you may appeal through official Volt Europa channels.`,
  [CourtVoteOption.Warn]: (id) =>
    `The moderator panel has reviewed your court case (#${id}) and reached a verdict: **you have received a formal warning**. Please review the server rules to avoid further action.`,
  [CourtVoteOption.Dismiss]: (id) =>
    `The moderator panel has reviewed your court case (#${id}) and decided to **dismiss it**. No action has been taken against you.`,
};

export const executeCaseOutcome = async (
  client: Client,
  guild: Guild,
  caseRow: CourtCase,
  outcome: CourtVoteOption,
  settings: Settings
): Promise<string[]> => {
  const botId = client.user!.id;
  const botUsername = client.user!.username;
  const failures: string[] = [];

  await upsertUser({ id: botId, username: botUsername });

  const dbStatus = outcome === CourtVoteOption.Dismiss ? CourtStatus.Dismissed : CourtStatus.Escalated;
  const summary = await fetchCourtSummary(client, caseRow);

  // Claim the case before acting on it. Two moderators can cross the threshold in the same tick;
  // without this compare-and-swap both would ban, both would insert a ban row, and both would DM.
  const closed = await closeCourtCase(caseRow.id, botId, dbStatus, `${outcome} — moderator panel vote`, summary, CourtStatus.Finalizing);
  if (!closed) {
    return failures;
  }

  if (caseRow.accusedUserId) {
    if (outcome === CourtVoteOption.Warn) {
      await insertWarning({ targetUserId: caseRow.accusedUserId, moderatorId: botId, reason: `Court case #${caseRow.id} — moderator panel verdict` });
    } else if (outcome === CourtVoteOption.Ban) {
      const banned = await runDiscordAction(logger, 'guild.bans.create', { userId: caseRow.accusedUserId, caseId: caseRow.id }, () =>
        guild.bans.create(caseRow.accusedUserId!, { reason: `[court #${caseRow.id}] moderator panel verdict` })
      );
      if (banned) {
        await insertBan({
          targetUserId: caseRow.accusedUserId,
          moderatorId: botId,
          reason: `Court case #${caseRow.id} — moderator panel verdict`,
          expiresAt: null,
          appealable: true,
        });
      } else {
        // No ban row: an active ban record for a user still in the guild would mislead
        // /userRecord, the ban sweeper, and any future appeal.
        failures.push('the Discord ban could not be applied — apply it manually');
      }
    }

    if (outcome !== CourtVoteOption.Ban && settings.roleMutedId) {
      const member = await guild.members
        .fetch(caseRow.accusedUserId)
        .catch(softFail(AppFeature.System, 'COURT_MEMBER_FETCH', { accusedUserId: caseRow.accusedUserId }));
      if (member) {
        const unmuted = await runDiscordAction(logger, 'member.roles.remove', { userId: member.id, roleId: settings.roleMutedId }, () =>
          member.roles.remove(settings.roleMutedId!, `Court #${caseRow.id} ${outcome}`)
        );
        if (!unmuted) {
          failures.push('the muted role could not be removed — remove it manually');
        }
      }
    }
  }

  await recordAuditEvent({
    eventType: outcome === CourtVoteOption.Dismiss ? AuditEventType.CourtClosed : AuditEventType.CourtEscalated,
    actorUserId: botId,
    targetUserId: caseRow.accusedUserId ?? undefined,
    payload: { caseId: caseRow.id, outcome },
  });

  await attempt(
    async () => {
      if (!caseRow.accusedUserId) return;
      const dmUser = await client.users.fetch(caseRow.accusedUserId);
      await dmUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(`⚖️ Court Case #${caseRow.id} — Verdict`)
            .setDescription(DM_CONTENT[outcome](caseRow.id))
            .setTimestamp(),
        ],
        flags: MessageFlags.SuppressNotifications,
      });
    },
    { errorCode: 'COURT_VERDICT_DM_SEND', context: { caseId: caseRow.id, accusedUserId: caseRow.accusedUserId } }
  );

  await archiveCourtThread(client, caseRow, `Verdict: **${outcome.toUpperCase()}** — reached by moderator panel vote.`);

  return failures;
};
