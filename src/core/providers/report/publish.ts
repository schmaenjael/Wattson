import type { AttachmentBuilder, Attachment, EmbedBuilder, Guild, TextChannel } from 'discord.js';

import { AppFeature } from '~/settings';
import { softFail } from '~/utilities';
import { getSettings, setReportMessageIds, type Report } from '~/database';
import { buildReportActionRow } from '~/core/components/Report';

const fetchSendable = async (guild: Guild, channelId: string | null, code: string): Promise<TextChannel | null> => {
  if (!channelId) {
    return null;
  }
  const channel = (await guild.channels.fetch(channelId).catch(softFail(AppFeature.Report, code, { channelId }))) as TextChannel | null;
  return channel?.isSendable() ? channel : null;
};

export type PublishReportResult = 'delivered' | 'unconfigured' | 'unreachable';

/**
 * Delivers a freshly filed report: a plain copy to the reports log (permanent record) and an
 * actionable copy to the reports todo channel (removed once handled). Persists both message IDs.
 * `unconfigured` when no channel is set (row still recorded), `unreachable` when a configured channel could not be posted to.
 */
export const publishReport = async (
  guild: Guild,
  report: Report,
  embed: EmbedBuilder,
  files: (AttachmentBuilder | Attachment)[]
): Promise<PublishReportResult> => {
  const settings = await getSettings();
  if (!settings.reportsLogChannelId && !settings.reportsTodoChannelId) {
    return 'unconfigured';
  }

  const [logChannel, todoChannel] = await Promise.all([
    fetchSendable(guild, settings.reportsLogChannelId, 'REPORT_LOG_CHANNEL_FETCH'),
    fetchSendable(guild, settings.reportsTodoChannelId, 'REPORT_TODO_CHANNEL_FETCH'),
  ]);
  if (!logChannel && !todoChannel) {
    return 'unreachable';
  }

  const [logMessage, todoMessage] = await Promise.all([
    logChannel?.send({ embeds: [embed], files }).catch(softFail(AppFeature.Report, 'REPORT_LOG_SEND', { reportId: report.id })) ?? null,
    todoChannel
      ?.send({ embeds: [embed], files, components: [buildReportActionRow(report.id)] })
      .catch(softFail(AppFeature.Report, 'REPORT_TODO_SEND', { reportId: report.id })) ?? null,
  ]);

  await setReportMessageIds(report.id, { logMessageId: logMessage?.id ?? null, todoMessageId: todoMessage?.id ?? null });
  return logMessage || todoMessage ? 'delivered' : 'unreachable';
};
