import { EmbedBuilder, Events, MessageFlags, PermissionFlagsBits } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature, Colors } from '~/settings';
import { AuditEventType, getSettings, recordAuditEvent, resolveReport, ReportStatus } from '~/database';

const ACTION_CONFIG = {
  dismiss: { color: Colors.White, status: ReportStatus.Dismissed, label: '❌ Dismissed' },
  warn: { color: Colors.Yellow, status: ReportStatus.Resolved, label: '⚠️ Warn issued' },
  ban: { color: Colors.Red, status: ReportStatus.Resolved, label: '🔨 Banned' },
} as const;

type ReportAction = keyof typeof ACTION_CONFIG;

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.Report,
  middleware: [],
  async executeCommand(event, client, interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('report:')) return;

    const parts = interaction.customId.split(':');
    const action = parts[1] as ReportAction;
    const reportId = parseInt(parts[2] ?? '', 10);

    if (!action || !(action in ACTION_CONFIG) || isNaN(reportId)) return;

    const settings = await getSettings();
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    const isModerator =
      member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
      (settings.roleModerationId ? member?.roles.cache.has(settings.roleModerationId) : false) ||
      (settings.roleAdministrationId ? member?.roles.cache.has(settings.roleAdministrationId) : false);

    if (!isModerator) {
      await interaction.reply({ content: 'Only moderators can take action on reports.', flags: MessageFlags.Ephemeral });
      return;
    }

    const config = ACTION_CONFIG[action];

    await resolveReport(reportId, interaction.user.id, config.status);

    await recordAuditEvent({ eventType: AuditEventType.ReportResolved, actorUserId: interaction.user.id, payload: { reportId, action } });

    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(config.color)
      .addFields({ name: 'Resolution', value: `${config.label} by <@${interaction.user.id}>`, inline: false });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
  },
});
