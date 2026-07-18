import { ApplicationCommandType, AttachmentBuilder, EmbedBuilder, MessageFlags, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import {
  getActivityStats,
  getDailyActivitySeries,
  getDailyJoins,
  getEngagementTotals,
  getInviteStats,
  getJoinStats,
  getModerationStats,
  getMonthlyModeration,
  getMonthlyVerifications,
  getTopByMessages,
} from '~/database';
import { renderEngagementChart, renderModerationChart, renderVerificationsChart } from '~/core/providers/charts';

const DEFAULT_DAYS = 30;
const DEFAULT_MONTHS = 12;

const sinceDate = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const sinceDay = (days: number) => sinceDate(days).toISOString().slice(0, 10);

const sparkline = (values: number[]): string => {
  if (values.length === 0) return '—';
  const max = Math.max(...values, 1);
  const blocks = '▁▂▃▄▅▆▇█';
  return values.map((v) => blocks[Math.min(blocks.length - 1, Math.floor((v / max) * (blocks.length - 1)))]).join('');
};

const monthsOption = (o: SlashCommandIntegerOption) =>
  o.setName('months').setDescription('Time frame in months (default 12)').setRequired(false).setMinValue(1).setMaxValue(24);

const daysOption = (o: SlashCommandIntegerOption) =>
  o.setName('days').setDescription('Window in days (default 30)').setRequired(false).setMinValue(1).setMaxValue(365);

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Stats,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Server stats.')
    .addSubcommand((s) =>
      s
        .setName('joins')
        .setDescription('Member join/leave stats.')
        .addIntegerOption((o) => o.setName('days').setDescription('Window in days (default 30)').setRequired(false).setMinValue(1).setMaxValue(365))
    )
    .addSubcommand((s) =>
      s
        .setName('moderation')
        .setDescription('Moderation action stats.')
        .addIntegerOption((o) => o.setName('days').setDescription('Window in days (default 30)').setRequired(false).setMinValue(1).setMaxValue(365))
    )
    .addSubcommand((s) =>
      s
        .setName('activity')
        .setDescription('Activity stats (automod, messages, verifications).')
        .addIntegerOption((o) => o.setName('days').setDescription('Window in days (default 30)').setRequired(false).setMinValue(1).setMaxValue(365))
    )
    .addSubcommand((s) =>
      s.setName('engagement').setDescription('Member engagement (messages, voice time, reactions, active members).').addIntegerOption(daysOption)
    )
    .addSubcommand((s) => s.setName('invites').setDescription('Top invite codes by joins with retention stats.'))
    .addSubcommandGroup((g) =>
      g
        .setName('chart')
        .setDescription('Generate chart images from historical data.')
        .addSubcommand((s) =>
          s.setName('verifications').setDescription('Monthly verification approvals vs rejections.').addIntegerOption(monthsOption)
        )
        .addSubcommand((s) => s.setName('moderation').setDescription('Monthly warnings, bans, and reports.').addIntegerOption(monthsOption))
        .addSubcommand((s) => s.setName('engagement').setDescription('Daily messages and active members.').addIntegerOption(daysOption))
    ),

  async executeCommand(command, _client, interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand(true);
    const color = appFeatureMap[command.options.feature].color;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (group === 'chart') {
      if (sub === 'engagement') {
        const days = interaction.options.getInteger('days', false) ?? DEFAULT_DAYS;
        const since = sinceDay(days);
        const data = await getDailyActivitySeries(since);
        const buf = await renderEngagementChart(data, days);
        const file = new AttachmentBuilder(buf, { name: 'engagement.png' });
        const totalMessages = data.reduce((s, d) => s + d.messages, 0);
        const peakActive = data.reduce((m, d) => Math.max(m, d.activeMembers), 0);
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`Engagement — last ${days} days`)
          .addFields(
            { name: 'Total messages', value: totalMessages.toLocaleString('en'), inline: true },
            { name: 'Peak daily active', value: peakActive.toLocaleString('en'), inline: true },
            { name: 'Days with activity', value: String(data.length), inline: true }
          )
          .setImage('attachment://engagement.png')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed], files: [file] });
        return;
      }

      const months = interaction.options.getInteger('months', false) ?? DEFAULT_MONTHS;

      if (sub === 'verifications') {
        const data = await getMonthlyVerifications(months);
        const buf = await renderVerificationsChart(data, months);
        const file = new AttachmentBuilder(buf, { name: 'verifications.png' });
        const totalApproved = data.reduce((s, d) => s + d.completed, 0);
        const totalRejected = data.reduce((s, d) => s + d.rejected, 0);
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`Verifications — last ${months} months`)
          .addFields(
            { name: 'Total approved', value: String(totalApproved), inline: true },
            { name: 'Total rejected', value: String(totalRejected), inline: true },
            {
              name: 'Approval rate',
              value: totalApproved + totalRejected > 0 ? `${Math.round((totalApproved / (totalApproved + totalRejected)) * 100)}%` : '—',
              inline: true,
            }
          )
          .setImage('attachment://verifications.png')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed], files: [file] });
        return;
      }

      if (sub === 'moderation') {
        const data = await getMonthlyModeration(months);
        const buf = await renderModerationChart(data, months);
        const file = new AttachmentBuilder(buf, { name: 'moderation.png' });
        const totals = data.reduce((acc, d) => ({ warnings: acc.warnings + d.warnings, bans: acc.bans + d.bans, reports: acc.reports + d.reports }), {
          warnings: 0,
          bans: 0,
          reports: 0,
        });
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`Moderation Actions — last ${months} months`)
          .addFields(
            { name: 'Total warnings', value: String(totals.warnings), inline: true },
            { name: 'Total bans', value: String(totals.bans), inline: true },
            { name: 'Total reports', value: String(totals.reports), inline: true }
          )
          .setImage('attachment://moderation.png')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed], files: [file] });
        return;
      }

      return;
    }

    const days = interaction.options.getInteger('days', false) ?? DEFAULT_DAYS;
    const since = sinceDate(days);

    if (sub === 'joins') {
      const [s, daily] = await Promise.all([getJoinStats(since), getDailyJoins(days)]);
      const values = daily.map((d) => d.joins);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Joins — last ${days} days`)
        .addFields(
          { name: 'Joins', value: String(s.joins), inline: true },
          { name: 'Leaves', value: String(s.leaves), inline: true },
          { name: 'Net', value: (s.net >= 0 ? '+' : '') + s.net, inline: true },
          { name: 'Daily joins', value: `\`${sparkline(values)}\`\n(${values.length} days with activity)` }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'moderation') {
      const s = await getModerationStats(since);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Moderation — last ${days} days`)
        .addFields(
          { name: 'Warnings', value: String(s.warnings), inline: true },
          { name: 'Bans', value: String(s.bans), inline: true },
          { name: 'Reports', value: `${s.reports.total} total · ${s.reports.open} open`, inline: true }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'invites') {
      const s = await getInviteStats(5);
      const fields = s.topCodes.map((c) => {
        const retention = c.totalJoins > 0 ? Math.round((c.activeMembers / c.totalJoins) * 100) : 0;
        const inviter = c.inviterId ? `<@${c.inviterId}>` : 'Unknown';
        const label = c.code === 'VANITY' ? 'Vanity URL' : c.code === 'UNKNOWN' ? 'Untracked' : `\`${c.code}\``;
        return { name: label, value: `${inviter} · ${c.totalJoins} joins · ${c.activeMembers} active · ${retention}% retention`, inline: false };
      });
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Top Invite Codes')
        .addFields(
          { name: 'Total tracked joins', value: String(s.totalTrackedJoins), inline: true },
          { name: '​', value: '​', inline: false },
          ...(fields.length > 0 ? fields : [{ name: 'No data', value: 'No joins tracked yet.', inline: false }])
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'activity') {
      const s = await getActivityStats(since);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Activity — last ${days} days`)
        .addFields(
          { name: 'Automod triggered', value: String(s.automodTriggered), inline: true },
          { name: 'Messages deleted', value: String(s.messagesDeleted), inline: true },
          { name: 'Messages edited', value: String(s.messagesEdited), inline: true },
          { name: 'Verifications started', value: String(s.verificationsStarted), inline: true },
          { name: 'Verifications completed', value: String(s.verificationsCompleted), inline: true }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'engagement') {
      const sinceStr = sinceDay(days);
      const [totals, top, series] = await Promise.all([
        getEngagementTotals(sinceStr),
        getTopByMessages(sinceStr, 5),
        getDailyActivitySeries(sinceStr),
      ]);
      const voiceHours = (totals.voiceSeconds / 3600).toFixed(1);
      const topList =
        top.length > 0 ? top.map((t, i) => `${i + 1}. <@${t.userId}> — ${t.messages.toLocaleString('en')}`).join('\n') : '*No tracked activity yet.*';
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Engagement — last ${days} days`)
        .addFields(
          { name: 'Messages', value: totals.messages.toLocaleString('en'), inline: true },
          { name: 'Voice time', value: `${voiceHours}h`, inline: true },
          { name: 'Reactions', value: totals.reactions.toLocaleString('en'), inline: true },
          { name: 'Active members', value: totals.activeMembers.toLocaleString('en'), inline: true },
          { name: 'Daily messages', value: `\`${sparkline(series.map((d) => d.messages))}\`\n(${series.length} days with activity)` },
          { name: 'Top message senders', value: topList }
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
});
