import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type User,
} from 'discord.js';

import { Command } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import {
  AuditEventType,
  getSettings,
  listAllBansForUser,
  listModActionsAsActor,
  listReportsAgainstUser,
  listReportsFiledByUser,
  listWarningsForUser,
  type AuditLogRecord,
  type Ban,
  type Report,
  type Warning,
} from '~/database';

const WARNS_PER_PAGE = 3;
const BANS_PER_PAGE = 3;
const REPORTS_PER_PAGE = 3;
const MOD_ACTIONS_PER_PAGE = 8;

const MOD_AUDIT_EVENT_TYPES: AuditEventType[] = [
  AuditEventType.WarnIssued,
  AuditEventType.WarnRevoked,
  AuditEventType.MuteIssued,
  AuditEventType.MuteLifted,
  AuditEventType.BanIssued,
  AuditEventType.BanLifted,
  AuditEventType.BanAppealResolved,
  AuditEventType.ReportResolved,
  AuditEventType.CourtOpened,
  AuditEventType.CourtClosed,
  AuditEventType.CourtEscalated,
  AuditEventType.VerificationCompleted,
  AuditEventType.VerificationRejected,
  AuditEventType.ChannelLocked,
  AuditEventType.ChannelUnlocked,
];

const AUDIT_EVENT_LABEL: Partial<Record<AuditEventType, string>> = {
  [AuditEventType.WarnIssued]: 'Warn Issued',
  [AuditEventType.WarnRevoked]: 'Warn Revoked',
  [AuditEventType.MuteIssued]: 'Mute Issued',
  [AuditEventType.MuteLifted]: 'Mute Lifted',
  [AuditEventType.BanIssued]: 'Ban Issued',
  [AuditEventType.BanLifted]: 'Ban Lifted',
  [AuditEventType.BanAppealResolved]: 'Appeal Resolved',
  [AuditEventType.ReportResolved]: 'Report Resolved',
  [AuditEventType.CourtOpened]: 'Court Opened',
  [AuditEventType.CourtClosed]: 'Court Closed',
  [AuditEventType.CourtEscalated]: 'Court Escalated',
  [AuditEventType.VerificationCompleted]: 'Verification Approved',
  [AuditEventType.VerificationRejected]: 'Verification Rejected',
  [AuditEventType.ChannelLocked]: 'Channel Locked',
  [AuditEventType.ChannelUnlocked]: 'Channel Unlocked',
};

const stamp = (d: Date) => `<t:${Math.floor(d.getTime() / 1000)}:d>`;
const stampRel = (d: Date) => `<t:${Math.floor(d.getTime() / 1000)}:R>`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function pageCount(items: unknown[], perPage: number): number {
  return items.length === 0 ? 0 : Math.ceil(items.length / perPage);
}

function buildNavRow(current: number, total: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ur_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current === 0),
    new ButtonBuilder()
      .setCustomId('ur_counter')
      .setLabel(`${current + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('ur_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current === total - 1)
  );
}

function base(color: string, user: User): EmbedBuilder {
  return new EmbedBuilder().setColor(color as `#${string}`).setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() });
}

function buildPages(
  color: string,
  targetUser: User,
  warnings: Warning[],
  bans: Ban[],
  reportsReceived: Report[],
  reportsFiled: Report[],
  modActions: AuditLogRecord[]
): EmbedBuilder[] {
  const wc = pageCount(warnings, WARNS_PER_PAGE);
  const bc = pageCount(bans, BANS_PER_PAGE);
  const rrc = pageCount(reportsReceived, REPORTS_PER_PAGE);
  const rfc = pageCount(reportsFiled, REPORTS_PER_PAGE);
  const mac = pageCount(modActions, MOD_ACTIONS_PER_PAGE);
  const total = 1 + wc + bc + rrc + rfc + mac;
  const uid = targetUser.id;
  const fp = (n: number) => `Page ${n}/${total} · ID: ${uid}`;

  const pages: EmbedBuilder[] = [];

  // Summary
  const activeWarnings = warnings.filter((w) => !w.revokedAt).length;
  const activeBans = bans.filter((b) => b.active).length;
  pages.push(
    base(color, targetUser)
      .setTitle('User Record')
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'Warnings', value: `${activeWarnings} active · ${warnings.length} total`, inline: true },
        { name: 'Bans', value: `${activeBans} active · ${bans.length} total`, inline: true },
        { name: 'Reports Received', value: String(reportsReceived.length), inline: true },
        { name: 'Reports Filed', value: String(reportsFiled.length), inline: true },
        { name: 'Mod Actions', value: String(modActions.length), inline: true }
      )
      .setFooter({ text: fp(1) })
      .setTimestamp()
  );

  // Warnings
  for (let i = 0; i < warnings.length; i += WARNS_PER_PAGE) {
    const embed = base(color, targetUser)
      .setTitle(`Warnings — ${warnings.length} total`)
      .setFooter({ text: fp(pages.length + 1) });
    for (const w of warnings.slice(i, i + WARNS_PER_PAGE)) {
      const badge = w.revokedAt ? '⚪ Revoked' : '🟡 Active';
      let val = `**Reason:** ${w.reason}\n**Issued:** ${stamp(w.createdAt)} by <@${w.moderatorId}>`;
      if (w.revokedAt && w.revokedBy) {
        val += `\n**Revoked:** ${stamp(w.revokedAt)} by <@${w.revokedBy}>`;
      }
      embed.addFields({ name: `#${w.id} · ${badge}`, value: val });
    }
    pages.push(embed);
  }

  // Bans
  for (let i = 0; i < bans.length; i += BANS_PER_PAGE) {
    const embed = base(color, targetUser)
      .setTitle(`Bans — ${bans.length} total`)
      .setFooter({ text: fp(pages.length + 1) });
    for (const b of bans.slice(i, i + BANS_PER_PAGE)) {
      const badge = b.active ? '🔴 Active' : '⚫ Lifted';
      let val = `**Reason:** ${b.reason}\n**Issued:** ${stamp(b.createdAt)} by <@${b.moderatorId}>`;
      val += `\n**Expires:** ${b.expiresAt ? stamp(b.expiresAt) : 'Never'}`;
      val += `\n**Appealable:** ${b.appealable ? 'Yes' : 'No'}`;
      if (b.appealedAt) {
        const outcome = b.appealOutcome ? capitalize(b.appealOutcome) : 'Pending';
        val += `\n**Appeal:** filed ${stamp(b.appealedAt)} · ${outcome}`;
      }
      embed.addFields({ name: `#${b.id} · ${badge}`, value: val });
    }
    pages.push(embed);
  }

  // Reports received
  for (let i = 0; i < reportsReceived.length; i += REPORTS_PER_PAGE) {
    const embed = base(color, targetUser)
      .setTitle(`Reports Received — ${reportsReceived.length} total`)
      .setFooter({ text: fp(pages.length + 1) });
    for (const r of reportsReceived.slice(i, i + REPORTS_PER_PAGE)) {
      const statusBadge = r.status === 'open' ? '🔴 Open' : r.status === 'resolved' ? '✅ Resolved' : '⚫ Dismissed';
      let val = `**From:** <@${r.reporterId}> · ${stamp(r.createdAt)}\n**Status:** ${statusBadge}`;
      if (r.messageContent) {
        const excerpt = r.messageContent.length > 120 ? `${r.messageContent.slice(0, 120)}…` : r.messageContent;
        val += `\n**Message:** ${excerpt}`;
      }
      val += `\n[Jump to message](${r.messageLink})`;
      if (r.resolvedBy && r.resolvedAt) {
        val += `\n**Resolved by:** <@${r.resolvedBy}> · ${stamp(r.resolvedAt)}`;
      }
      embed.addFields({ name: `Report #${r.id}`, value: val });
    }
    pages.push(embed);
  }

  // Reports filed
  for (let i = 0; i < reportsFiled.length; i += REPORTS_PER_PAGE) {
    const embed = base(color, targetUser)
      .setTitle(`Reports Filed — ${reportsFiled.length} total`)
      .setFooter({ text: fp(pages.length + 1) });
    for (const r of reportsFiled.slice(i, i + REPORTS_PER_PAGE)) {
      const statusBadge = r.status === 'open' ? '🔴 Open' : r.status === 'resolved' ? '✅ Resolved' : '⚫ Dismissed';
      let val = `**Against:** <@${r.reportedUserId}> · ${stamp(r.createdAt)}\n**Status:** ${statusBadge}`;
      if (r.messageContent) {
        const excerpt = r.messageContent.length > 120 ? `${r.messageContent.slice(0, 120)}…` : r.messageContent;
        val += `\n**Message:** ${excerpt}`;
      }
      val += `\n[Jump to message](${r.messageLink})`;
      embed.addFields({ name: `Report #${r.id}`, value: val });
    }
    pages.push(embed);
  }

  // Mod actions
  for (let i = 0; i < modActions.length; i += MOD_ACTIONS_PER_PAGE) {
    const lines = modActions.slice(i, i + MOD_ACTIONS_PER_PAGE).map((a) => {
      const label = AUDIT_EVENT_LABEL[a.eventType] ?? a.eventType;
      const target = a.targetUserId ? ` → <@${a.targetUserId}>` : '';
      return `${stampRel(a.createdAt)} **${label}**${target}`;
    });
    pages.push(
      base(color, targetUser)
        .setTitle(`Mod Actions — ${modActions.length} total`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: fp(pages.length + 1) })
    );
  }

  return pages;
}

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.UserRecord,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('user-record')
    .setDescription('View the full moderation record for a user.')
    .addUserOption((o) => o.setName('user').setDescription('User to look up (defaults to yourself)').setRequired(false))
    .addBooleanOption((o) => o.setName('visible').setDescription('Show the response publicly (default: only visible to you)').setRequired(false)),

  async executeCommand(command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    if (!interaction.guild) {
      return;
    }

    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const visible = interaction.options.getBoolean('visible') ?? false;
    const isSelf = targetUser.id === interaction.user.id;

    const settings = await getSettings();
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const isMod = Boolean(
      member?.roles.cache.has(settings.roleModerationId ?? '') ||
      member?.roles.cache.has(settings.roleAdministrationId ?? '') ||
      member?.permissions.has(PermissionFlagsBits.ManageGuild)
    );

    if (!isSelf && !isMod) {
      await interaction.reply({ content: 'You can only view your own record.', flags: MessageFlags.Ephemeral });
      return;
    }

    const flags = visible ? undefined : MessageFlags.Ephemeral;
    await interaction.deferReply({ flags });

    const [warnings, bans, reportsReceived, reportsFiled, modActions] = await Promise.all([
      listWarningsForUser(targetUser.id),
      listAllBansForUser(targetUser.id),
      listReportsAgainstUser(targetUser.id),
      listReportsFiledByUser(targetUser.id),
      listModActionsAsActor(targetUser.id, MOD_AUDIT_EVENT_TYPES),
    ]);

    const color = appFeatureMap[command.options.feature].color;
    const pages = buildPages(color, targetUser, warnings, bans, reportsReceived, reportsFiled, modActions);

    if (pages.length === 1) {
      await interaction.editReply({ embeds: [pages[0]] });
      return;
    }

    let current = 0;
    const msg = await interaction.editReply({ embeds: [pages[0]], components: [buildNavRow(0, pages.length)] });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: 'This is not your record view.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (btn.customId === 'ur_prev' && current > 0) {
        current--;
      }
      if (btn.customId === 'ur_next' && current < pages.length - 1) {
        current++;
      }
      await btn.update({ embeds: [pages[current]], components: [buildNavRow(current, pages.length)] });
    });

    collector.on('end', async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
});
