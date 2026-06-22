import { ButtonInteraction, EmbedBuilder } from 'discord.js';

import { Client } from '~/core/models';
import { Colors } from '~/settings';
import { AuditEventType, recordAuditEvent, resolveReport, ReportStatus } from '~/database';

const ACTION_CONFIG = {
  dismiss: { color: Colors.White, status: ReportStatus.Dismissed, label: '❌ Dismissed' },
  warn: { color: Colors.Yellow, status: ReportStatus.Resolved, label: '⚠️ Warn issued' },
  ban: { color: Colors.Red, status: ReportStatus.Resolved, label: '🔨 Banned' },
} as const;

type ReportAction = keyof typeof ACTION_CONFIG;

export const handleReportButton = async (_client: Client, interaction: ButtonInteraction): Promise<void> => {
  const parts = interaction.customId.split(':');
  const action = parts[1] as ReportAction;
  const reportId = parseInt(parts[2] ?? '', 10);

  if (!action || !(action in ACTION_CONFIG) || isNaN(reportId)) return;

  const config = ACTION_CONFIG[action];

  await resolveReport(reportId, interaction.user.id, config.status);
  await recordAuditEvent({ eventType: AuditEventType.ReportResolved, actorUserId: interaction.user.id, payload: { reportId, action } });

  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(config.color)
    .addFields({ name: 'Resolution', value: `${config.label} by <@${interaction.user.id}>`, inline: false });

  await interaction.update({ embeds: [updatedEmbed], components: [] });
};
