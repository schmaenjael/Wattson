import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission, BotException } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { AuditEventType, findReportById, listReports, recordAuditEvent, ReportStatus, resolveReport, type Report } from '~/database';

const PAGE_SIZE = 10;

const reportSummary = (r: Report) =>
  `**#${r.id}** · <t:${Math.floor(r.createdAt.getTime() / 1000)}:R> · ${statusBadge(r.status)} · reporter <@${r.reporterId}> → target <@${r.reportedUserId}>\n${r.messageLink}`;

const statusBadge = (s: ReportStatus): string => {
  switch (s) {
    case ReportStatus.Open:
      return '🟡 open';
    case ReportStatus.Resolved:
      return '✅ resolved';
    case ReportStatus.Dismissed:
      return '⚪ dismissed';
  }
};

const renderListEmbed = (items: Report[], status: ReportStatus | undefined) => {
  const title = status ? `Reports — ${status}` : 'Reports — all';
  const description = items.length === 0 ? '*No reports.*' : items.map(reportSummary).join('\n\n');
  return new EmbedBuilder().setColor(appFeatureMap[AppFeature.Report].color).setTitle(title).setDescription(description).setTimestamp();
};

const renderDetailEmbed = (r: Report) =>
  new EmbedBuilder()
    .setColor(appFeatureMap[AppFeature.Report].color)
    .setTitle(`Report #${r.id} · ${statusBadge(r.status)}`)
    .addFields(
      { name: 'Reporter', value: `<@${r.reporterId}>`, inline: true },
      { name: 'Target', value: `<@${r.reportedUserId}>`, inline: true },
      { name: 'Channel', value: `<#${r.channelId}>`, inline: true },
      { name: 'Filed', value: `<t:${Math.floor(r.createdAt.getTime() / 1000)}:F>` },
      { name: 'Message link', value: r.messageLink },
      { name: 'Content excerpt', value: r.messageContent ? r.messageContent.slice(0, 1024) : '—' },
      ...(r.resolvedBy ? [{ name: 'Resolved by', value: `<@${r.resolvedBy}>`, inline: true }] : []),
      ...(r.resolvedAt ? [{ name: 'Resolved at', value: `<t:${Math.floor(r.resolvedAt.getTime() / 1000)}:F>`, inline: true }] : [])
    )
    .setTimestamp();

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Report,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('reports')
    .setDescription('Review user reports.')
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription('List reports.')
        .addStringOption((o) =>
          o
            .setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'open', value: ReportStatus.Open },
              { name: 'resolved', value: ReportStatus.Resolved },
              { name: 'dismissed', value: ReportStatus.Dismissed }
            )
        )
    )
    .addSubcommand((s) =>
      s
        .setName('view')
        .setDescription('Show a single report.')
        .addIntegerOption((o) => o.setName('id').setDescription('Report ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s
        .setName('resolve')
        .setDescription('Mark a report as resolved.')
        .addIntegerOption((o) => o.setName('id').setDescription('Report ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s
        .setName('dismiss')
        .setDescription('Dismiss a report without action.')
        .addIntegerOption((o) => o.setName('id').setDescription('Report ID').setRequired(true).setMinValue(1))
    ),

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const sub = interaction.options.getSubcommand(true);

    if (sub === 'list') {
      const statusFilter = interaction.options.getString('status', false) as ReportStatus | null;
      const rows = await listReports(statusFilter ?? undefined);
      const top = rows.slice(0, PAGE_SIZE);
      await interaction.reply({ embeds: [renderListEmbed(top, statusFilter ?? undefined)], flags: MessageFlags.Ephemeral });
      return;
    }

    const id = interaction.options.getInteger('id', true);

    if (sub === 'view') {
      const r = await findReportById(id);
      if (!r) {
        await interaction.reply({ content: `No report #${id}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [renderDetailEmbed(r)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'resolve' || sub === 'dismiss') {
      const r = await findReportById(id);
      if (!r) {
        await interaction.reply({ content: `No report #${id}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (r.status !== ReportStatus.Open) {
        await interaction.reply({ content: `Report #${id} is already ${r.status}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const target = sub === 'resolve' ? ReportStatus.Resolved : ReportStatus.Dismissed;
      const updated = await resolveReport(id, interaction.user.id, target);
      if (!updated) throw new BotException(client, `Failed to update report #${id}`);

      await recordAuditEvent({
        eventType: AuditEventType.ReportResolved,
        actorUserId: interaction.user.id,
        targetUserId: updated.reportedUserId,
        payload: { reportId: id, outcome: target },
      });

      await interaction.reply({ embeds: [renderDetailEmbed(updated)], flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
