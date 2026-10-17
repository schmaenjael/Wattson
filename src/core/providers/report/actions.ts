import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  type User,
} from 'discord.js';

import type { Client } from '~/core/models';
import { AppFeature } from '~/settings';
import { discordTimestamp, resolveExpiresAt, softFail, validateModerationTarget } from '~/utilities';
import { ensureFeatureEnabled } from '~/core/middleware/useFeatureFlag';
import { findReportById, ReportStatus, WARNING_DEFAULT_EXPIRY_DAYS, type Report } from '~/database';
import { applyBan, applyMute, issueWarning } from '~/core/providers/moderation';
import { closeReport } from './close';

type ModalAction = 'warn' | 'mute' | 'ban';
type ButtonAction = 'dismiss' | ModalAction;

const BUTTON_ACTIONS: ReadonlySet<string> = new Set<ButtonAction>(['dismiss', 'warn', 'mute', 'ban']);
const MODAL_ACTIONS: ReadonlySet<string> = new Set<ModalAction>(['warn', 'mute', 'ban']);
const MODAL_TITLES: Record<ModalAction, string> = { warn: 'Warn reported user', mute: 'Mute reported user (also warns)', ban: 'Ban reported user' };
const DURATION_HINTS: Record<Exclude<ModalAction, 'warn'>, string> = { mute: 'blank = indefinite', ban: 'blank = permanent' };

const messageUrl = (report: Report): string =>
  report.messageId ? `https://discord.com/channels/${process.env.GUILD_ID}/${report.channelId}/${report.messageId}` : `<#${report.channelId}>`;

const parseCustomId = (customId: string): { action: string; reportId: number } => {
  const [, action = '', rawId = ''] = customId.split(':');
  return { action, reportId: parseInt(rawId, 10) };
};

const buildActionModal = (action: ModalAction, report: Report): ModalBuilder => {
  const modal = new ModalBuilder()
    .setCustomId(`report:${action}:${report.id}`)
    .setTitle(MODAL_TITLES[action])
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(`Reported message: ${messageUrl(report)}`)
          .setMaxLength(500)
          .setRequired(true)
      )
    );
  if (action !== 'warn') {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel(`Duration (${DURATION_HINTS[action]})`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 30m, 2h, 7d, 1w')
          .setMaxLength(16)
          .setRequired(false)
      )
    );
  }
  return modal;
};

/** Route handlers are log-only on throw; tell the moderator the report is still open before the error propagates. */
const withFailureReply = async (interaction: ButtonInteraction | ModalSubmitInteraction, report: Report, run: () => Promise<void>): Promise<void> => {
  try {
    await run();
  } catch (error) {
    await interaction
      .editReply({ content: `Action failed — report #${report.id} stays open. See the error log.` })
      .catch(softFail(AppFeature.Report, 'REPORT_FAILURE_REPLY', { reportId: report.id }));
    throw error;
  }
};

const alreadyHandled = (report: Report): string =>
  `Report #${report.id} is already ${report.status}${report.resolvedBy ? ` (by <@${report.resolvedBy}>)` : ''}.`;

/** `report:<dismiss|warn|mute|ban>:<reportId>` — dismiss closes directly; the rest open a reason modal. */
export const handleReportButton = async (_client: Client, interaction: ButtonInteraction): Promise<void> => {
  if (!(await ensureFeatureEnabled(interaction, 'featureReportsEnabled'))) return;

  const { action, reportId } = parseCustomId(interaction.customId);
  if (!BUTTON_ACTIONS.has(action) || isNaN(reportId)) return;

  // Plain DB reads only before showModal — a modal cannot follow a reply/defer.
  const report = await findReportById(reportId);
  if (!report) {
    await interaction.reply({ content: `No report #${reportId}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (report.status !== ReportStatus.Open) {
    await interaction.reply({ content: alreadyHandled(report), flags: MessageFlags.Ephemeral });
    return;
  }

  if (action !== 'dismiss') {
    await interaction.showModal(buildActionModal(action as ModalAction, report));
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await withFailureReply(interaction, report, async () => {
    await closeReport(interaction.guild!, report, interaction.user, 'dismiss', { sourceMessage: interaction.message });
    await interaction.editReply({ content: `Report #${report.id} dismissed.` });
  });
};

const executeAction = async (
  client: Client,
  interaction: ModalSubmitInteraction,
  action: ModalAction,
  report: Report,
  target: User,
  reason: string
): Promise<string | null> => {
  const guild = interaction.guild!;
  const moderator = interaction.user;

  const durationStr = action === 'warn' ? null : interaction.fields.getTextInputValue('duration').trim() || null;
  const expiresAt = resolveExpiresAt(durationStr);
  if (expiresAt === 'invalid') {
    await interaction.editReply({ content: `Invalid duration: \`${durationStr}\`. Use e.g. 30m, 2h, 7d, 1w. Report #${report.id} stays open.` });
    return null;
  }

  if (action === 'ban') {
    const ban = await applyBan(client, guild, { target, moderator, reason, expiresAt, appealable: false, deleteMessageSeconds: 0 });
    return `Banned <@${target.id}>. Ban **#${ban.id}** recorded${expiresAt ? `; expires ${discordTimestamp(expiresAt, 'R')}` : ' (permanent)'}.`;
  }

  let muteLine = '';
  if (action === 'mute') {
    // Mute before warn: warn auto-mute escalation skips members who already carry the muted role.
    const result = await applyMute(client, guild, { target, moderator, reason, expiresAt });
    if (!result.ok && result.reason !== 'already_muted') {
      const why = result.reason === 'not_configured' ? 'Muted role not configured (`roles.utility.muted`).' : `${target.tag} is not in the server.`;
      await interaction.editReply({ content: `${why} Report #${report.id} stays open.` });
      return null;
    }
    muteLine = result.ok
      ? `Muted <@${target.id}> (mute **#${result.mute.id}**${expiresAt ? `, expires ${discordTimestamp(expiresAt, 'R')}` : ', indefinite'}). `
      : `<@${target.id}> was already muted; warning issued only. `;
  }

  const warnExpiresAt = new Date(Date.now() + WARNING_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const { warning, escalationNote } = await issueWarning(client, guild, { target, moderator, reason, expiresAt: warnExpiresAt });
  return `${muteLine}Warned <@${target.id}>. Warning **#${warning.id}** recorded.${escalationNote}`;
};

/** `report:<warn|mute|ban>:<reportId>` modal submit — executes the moderation action, then closes the report. */
export const handleReportModal = async (client: Client, interaction: ModalSubmitInteraction): Promise<void> => {
  if (!(await ensureFeatureEnabled(interaction, 'featureReportsEnabled'))) return;

  const { action, reportId } = parseCustomId(interaction.customId);
  if (!MODAL_ACTIONS.has(action) || isNaN(reportId)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const report = await findReportById(reportId);
  if (!report) {
    await interaction.editReply({ content: `No report #${reportId}.` });
    return;
  }
  if (report.status !== ReportStatus.Open) {
    await interaction.editReply({ content: alreadyHandled(report) });
    return;
  }
  if (!report.reportedUserId) {
    await interaction.editReply({ content: `Report #${report.id} has no reported user on record (account purged). Dismiss it instead.` });
    return;
  }

  const target = await client.users
    .fetch(report.reportedUserId)
    .catch(softFail(AppFeature.Report, 'REPORT_TARGET_FETCH', { reportId: report.id, userId: report.reportedUserId }));
  if (!target) {
    await interaction.editReply({ content: `Could not resolve <@${report.reportedUserId}>. Report #${report.id} stays open.` });
    return;
  }

  const targetError = validateModerationTarget(target, interaction.user, action);
  if (targetError) {
    await interaction.editReply({ content: targetError });
    return;
  }

  const reason = interaction.fields.getTextInputValue('reason').trim();
  await withFailureReply(interaction, report, async () => {
    const summary = await executeAction(client, interaction, action as ModalAction, report, target, reason);
    if (!summary) {
      return;
    }

    await closeReport(interaction.guild!, report, interaction.user, action as ModalAction, {
      reason,
      sourceMessage: interaction.isFromMessage() ? interaction.message : undefined,
    });
    await interaction.editReply({ content: `${summary}\n\nReport #${report.id} closed.` });
  });
};
