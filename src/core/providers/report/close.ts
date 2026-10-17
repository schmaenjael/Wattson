import { EmbedBuilder, type ColorResolvable, type Guild, type Message, type TextChannel, type User } from 'discord.js';

import { AppFeature, Colors } from '~/settings';
import { softFail } from '~/utilities';
import { AuditEventType, getSettings, recordAuditEvent, ReportStatus, resolveReport, upsertUser, type Report } from '~/database';

export const REPORT_RESOLUTIONS = {
  dismiss: { status: ReportStatus.Dismissed, color: Colors.White, label: '❌ Dismissed' },
  resolve: { status: ReportStatus.Resolved, color: Colors.Green, label: '✅ Resolved' },
  warn: { status: ReportStatus.Resolved, color: Colors.Yellow, label: '⚠️ Warn issued' },
  mute: { status: ReportStatus.Resolved, color: Colors.Orange, label: '🔇 Muted + warned' },
  ban: { status: ReportStatus.Resolved, color: Colors.Red, label: '🔨 Banned' },
} as const satisfies Record<string, { status: ReportStatus; color: ColorResolvable; label: string }>;

export type ReportResolution = keyof typeof REPORT_RESOLUTIONS;

const fetchMessage = async (guild: Guild, channelId: string | null, messageId: string | null, code: string) => {
  if (!channelId || !messageId) {
    return null;
  }
  const channel = (await guild.channels.fetch(channelId).catch(softFail(AppFeature.Report, code, { channelId }))) as TextChannel | null;
  if (!channel?.isTextBased()) {
    return null;
  }
  return channel.messages.fetch(messageId).catch(softFail(AppFeature.Report, code, { channelId, messageId }));
};

export interface CloseReportOptions {
  reason?: string;
  /** Message the moderator acted on; stamped in place when it is not the todo copy (reports filed before message IDs were stored). */
  sourceMessage?: Message;
}

const stampResolution = (message: Message, color: ColorResolvable, value: string, reportId: number) =>
  message.embeds[0]
    ? message
        .edit({ embeds: [EmbedBuilder.from(message.embeds[0]).setColor(color).addFields({ name: 'Resolution', value })], components: [] })
        .catch(softFail(AppFeature.Report, 'REPORT_MESSAGE_STAMP', { reportId, messageId: message.id }))
    : null;

/**
 * Single closure path for every report outcome (buttons, modals, `/reports resolve|dismiss`):
 * persists status + audit entry, removes the todo-channel copy, and stamps the resolution onto the log copy.
 */
export const closeReport = async (
  guild: Guild,
  report: Report,
  actor: User,
  resolution: ReportResolution,
  { reason, sourceMessage }: CloseReportOptions = {}
): Promise<Report> => {
  const outcome = REPORT_RESOLUTIONS[resolution];

  // reports.resolvedBy and audit_log.actorUserId are FK-constrained to users.
  await upsertUser({ id: actor.id, username: actor.username });
  const updated = (await resolveReport(report.id, actor.id, outcome.status)) ?? report;

  await recordAuditEvent({
    eventType: AuditEventType.ReportResolved,
    actorUserId: actor.id,
    targetUserId: report.reportedUserId ?? undefined,
    payload: { reportId: report.id, action: resolution, outcome: outcome.status, ...(reason ? { reason } : {}) },
  });

  const settings = await getSettings();
  const [todoMessage, logMessage] = await Promise.all([
    fetchMessage(guild, settings.reportsTodoChannelId, report.todoMessageId, 'REPORT_TODO_MESSAGE_FETCH'),
    fetchMessage(guild, settings.reportsLogChannelId, report.logMessageId, 'REPORT_LOG_MESSAGE_FETCH'),
  ]);

  const resolutionValue = `${outcome.label} by <@${actor.id}>${reason ? `\n> ${reason.slice(0, 900)}` : ''}`;
  const legacySource = sourceMessage && sourceMessage.id !== todoMessage?.id && sourceMessage.id !== logMessage?.id ? sourceMessage : null;
  await Promise.all([
    todoMessage?.delete().catch(softFail(AppFeature.Report, 'REPORT_TODO_MESSAGE_DELETE', { reportId: report.id })),
    logMessage ? stampResolution(logMessage, outcome.color, resolutionValue, report.id) : null,
    legacySource ? stampResolution(legacySource, outcome.color, resolutionValue, report.id) : null,
  ]);

  return updated;
};
