import {
  ApplicationCommandType,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';

import { Command, Permission, BotException } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import {
  AuditEventType,
  countBansForUser,
  countReportsForUser,
  countWarningsForUser,
  CourtStatus,
  findActiveCaseByThreadId,
  findCaseById,
  findOpenCaseForUser,
  getSettings,
  insertCourtCase,
  listCasesForUser,
  listOpenCases,
  recordAuditEvent,
  setCourtCaseFinalizing,
  upsertUser,
  type CourtCase,
} from '~/database';
import { buildVoteEmbed, buildVoteRow } from '~/core/providers/court/outcome';

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
  `**#${c.id}** · ${statusBadge(c.status)} · <t:${Math.floor(c.openedAt.getTime() / 1000)}:R> · <@${c.accusedUserId}>\n> ${c.reason}`;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.System,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation],
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

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const sub = interaction.options.getSubcommand(true);
    const settings = await getSettings();
    const color = appFeatureMap[command.options.feature].color;

    if (!settings.featureCourtEnabled) {
      await interaction.reply({ content: 'Court feature is disabled. Enable it via `/config feature`.', flags: MessageFlags.Ephemeral });
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
        await interaction.reply({ content: 'Set the court parent channel via `/config channel` first.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!settings.roleMutedId) {
        await interaction.reply({ content: 'Set the Muted role via `/config role` first.', flags: MessageFlags.Ephemeral });
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

      const parent = (await interaction.guild!.channels.fetch(settings.courtParentChannelId)) as TextChannel | null;
      if (!parent) throw new BotException(client, 'Court parent channel not found.');

      await Promise.all([
        upsertUser({ id: accused.id, username: accused.username }),
        upsertUser({ id: interaction.user.id, username: interaction.user.username }),
      ]);

      const accusedMember = await interaction.guild!.members.fetch(accused.id).catch(() => null);
      if (!accusedMember) throw new BotException(client, `Accused user ${accused.tag} is not in the guild.`);

      const [reportCount, warnCount, banCount] = await Promise.all([
        countReportsForUser(accused.id),
        countWarningsForUser(accused.id),
        countBansForUser(accused.id),
      ]);

      const thread = await parent.threads.create({
        name: `court-${accused.username.slice(0, 16)}-${Date.now().toString(36)}`,
        type: ChannelType.PrivateThread,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        invitable: false,
        reason: `Court case opened by ${interaction.user.tag}`,
      });

      await thread.members.add(accused.id).catch(() => null);
      await thread.members.add(interaction.user.id).catch(() => null);

      await accusedMember.roles.add(settings.roleMutedId, `Court case opened: ${reason}`).catch(() => null);

      const record = await insertCourtCase({
        accusedUserId: accused.id,
        openedByModeratorId: interaction.user.id,
        threadId: thread.id,
        parentChannelId: parent.id,
        reason,
      });

      await recordAuditEvent({
        eventType: AuditEventType.CourtOpened,
        actorUserId: interaction.user.id,
        targetUserId: accused.id,
        payload: { caseId: record.id, threadId: thread.id, reason },
      });

      await thread.send({
        embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setTitle(`⚖️ Court Case #${record.id}`)
            .setDescription(
              [
                `<@${accused.id}>, a court case has been opened against you.`,
                `You are currently **muted server-wide** and may only respond **in this thread**.`,
                ``,
                `**Reason**`,
                reason,
                ``,
                `**User History**`,
                `Reports filed against you: **${reportCount}**`,
                `Warnings on record: **${warnCount}**`,
                `Bans on record: **${banCount}**`,
                ``,
                `**Notice**`,
                `We welcome members of all backgrounds. However, we reserve the right to decide who may remain on this server and may remove members or content at any time.`,
                ``,
                `Court cases may take time. **At least ${3} moderators** must reach a unanimous conclusion before this case can be closed.`,
              ].join('\n')
            )
            .setFooter({ text: `Opened by ${interaction.user.tag}` })
            .setTimestamp(record.openedAt),
        ],
      });

      await interaction.editReply({ content: `Opened case **#${record.id}** in <#${thread.id}>.` });
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

      const thread = await client.channels.fetch(caseRow.threadId);
      if (thread && thread.isThread()) {
        try {
          await thread.setLocked(true, 'Court finalization — moderator deliberation in progress');
        } catch {
          // best-effort
        }
      }

      const tallies = { ban: 0, warn: 0, dismiss: 0 };
      if (!thread || !thread.isThread()) {
        await interaction.editReply({ content: 'Could not fetch the court thread.' });
        return;
      }
      const voteMsg = await thread.send({ embeds: [buildVoteEmbed(caseRow, tallies)], components: [buildVoteRow(caseRow.id)] });

      await setCourtCaseFinalizing(caseRow.id, voteMsg.id);

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
          { name: 'Opened', value: `<t:${Math.floor(rec.openedAt.getTime() / 1000)}:F>`, inline: true },
          ...(rec.closedAt ? [{ name: 'Closed', value: `<t:${Math.floor(rec.closedAt.getTime() / 1000)}:F>`, inline: true }] : []),
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
