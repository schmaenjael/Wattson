import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import {
  CourtStatus,
  findActiveCaseByThreadId,
  findCaseById,
  findOpenCaseForUser,
  getSettings,
  listCasesForUser,
  listOpenCases,
  type CourtCase,
} from '~/database';
import { finalizeCourtCase, openCourtCase } from '~/core/providers/court';
import { discordTimestamp } from '~/utilities';

const statusBadge = (s: CourtStatus): string => {
  switch (s) {
    case CourtStatus.Open:
      return '🟡 open';
    case CourtStatus.Finalizing:
      return '🗳️ finalizing';
    case CourtStatus.Resolved:
      return '✅ resolved';
    case CourtStatus.Dismissed:
      return '⚪ dismissed';
    case CourtStatus.Escalated:
      return '🔺 escalated';
  }
};

const caseSummary = (c: CourtCase) =>
  `**#${c.id}** · ${statusBadge(c.status)} · ${discordTimestamp(c.openedAt, 'R')} · <@${c.accusedUserId}>\n> ${c.reason}`;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.System,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('court')
    .setDescription('Judicial thread workflow.')
    .addSubcommand((s) =>
      s
        .setName('open')
        .setDescription('Open a court case against a user.')
        .addUserOption((o) => o.setName('user').setDescription('The accused').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
    )
    .addSubcommand((s) => s.setName('finalize').setDescription('Lock the thread and open moderator vote. Run inside the court thread.'))
    .addSubcommand((s) => s.setName('list').setDescription('List open cases.'))
    .addSubcommand((s) =>
      s
        .setName('history')
        .setDescription("List a user's past cases.")
        .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('record')
        .setDescription('Show the full record of a court case including LLM summary.')
        .addIntegerOption((o) => o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1))
    ),

  async executeCommand(command, client, interaction) {
    const sub = interaction.options.getSubcommand(true);
    const settings = await getSettings();
    const color = appFeatureMap[command.options.feature].color;

    if (!settings.featureCourtEnabled) {
      await interaction.reply({ content: 'Court feature is disabled. Enable `features.court` in the bot config.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'open') {
      const accused = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);

      if (accused.bot || accused.id === interaction.user.id) {
        await interaction.reply({ content: 'Cannot open a court case against that user.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!settings.courtParentChannelId) {
        await interaction.reply({ content: 'Set `channels.courtParent` in the bot config first.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!settings.roleMutedId) {
        await interaction.reply({ content: 'Set `roles.utility.muted` in the bot config first.', flags: MessageFlags.Ephemeral });
        return;
      }

      const existing = await findOpenCaseForUser(accused.id);
      if (existing) {
        await interaction.reply({
          content: `An open case already exists: #${existing.id} (<#${existing.threadId}>).`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const record = await openCourtCase(
        client,
        interaction.guild!,
        settings.courtParentChannelId,
        settings.roleMutedId,
        interaction.user,
        accused,
        reason
      );

      await interaction.editReply({ content: `Opened case **#${record.id}** in <#${record.threadId}>.` });
      return;
    }

    if (sub === 'finalize') {
      const caseRow = await findActiveCaseByThreadId(interaction.channelId);

      if (!caseRow) {
        await interaction.reply({ content: 'This command must be run inside an active court thread.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (caseRow.status === CourtStatus.Finalizing) {
        await interaction.reply({ content: `Case #${caseRow.id} is already in deliberation.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const finalized = await finalizeCourtCase(client, caseRow);
      if (!finalized) {
        await interaction.editReply({ content: 'Could not fetch the court thread.' });
        return;
      }

      await interaction.editReply({ content: `Case #${caseRow.id} is now in deliberation. Thread locked; voting open to moderators.` });
      return;
    }

    if (sub === 'list') {
      const rows = await listOpenCases();
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Open court cases')
        .setDescription(rows.length === 0 ? '*No open cases.*' : rows.map(caseSummary).join('\n\n'))
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'history') {
      const user = interaction.options.getUser('user', true);
      const rows = await listCasesForUser(user.id);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Court history for ${user.tag}`)
        .setDescription(rows.length === 0 ? '*No cases.*' : rows.slice(0, 15).map(caseSummary).join('\n\n'))
        .setFooter({ text: `${rows.length} total` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'record') {
      const id = interaction.options.getInteger('id', true);
      const rec = await findCaseById(id);
      if (!rec) {
        await interaction.reply({ content: `No case #${id}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`Court Case #${rec.id}`)
        .addFields(
          { name: 'Status', value: statusBadge(rec.status), inline: true },
          { name: 'Accused', value: `<@${rec.accusedUserId}>`, inline: true },
          { name: 'Opened by', value: `<@${rec.openedByModeratorId}>`, inline: true },
          { name: 'Thread', value: `<#${rec.threadId}>`, inline: true },
          { name: 'Opened', value: `${discordTimestamp(rec.openedAt, 'F')}`, inline: true },
          ...(rec.closedAt ? [{ name: 'Closed', value: `${discordTimestamp(rec.closedAt, 'F')}`, inline: true }] : []),
          { name: 'Reason', value: rec.reason },
          ...(rec.verdict ? [{ name: 'Verdict', value: rec.verdict }] : []),
          ...(rec.summary ? [{ name: 'Notable Points (LLM Summary)', value: rec.summary.slice(0, 1024) }] : [])
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
