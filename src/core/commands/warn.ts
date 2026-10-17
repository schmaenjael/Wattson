import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission, BotException } from '~/core/models';
import { AppFeature, appFeatureMap, MOD_LIST_PAGE_SIZE } from '~/settings';
import { discordTimestamp, validateModerationTarget } from '~/utilities';
import { issueWarning } from '~/core/providers/moderation';
import {
  AuditEventType,
  findWarningById,
  listWarningsForUser,
  recordAuditEvent,
  revokeWarning,
  WARNING_DEFAULT_EXPIRY_DAYS,
  type Warning,
} from '~/database';

const statusBadge = (w: Warning, now: Date): string => {
  if (w.revokedAt) return '⚪ revoked';
  if (w.expiresAt && w.expiresAt < now) return '🔘 expired';
  return '🟡 active';
};

const line = (w: Warning, now: Date): string => {
  const expiry = !w.revokedAt && w.expiresAt ? ` · ${w.expiresAt < now ? 'expired' : 'expires'} ${discordTimestamp(w.expiresAt, 'R')}` : '';
  return `**#${w.id}** · ${statusBadge(w, now)} · ${discordTimestamp(w.createdAt, 'R')} by <@${w.moderatorId}>${expiry}\n> ${w.reason}`;
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Warn,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue and manage warnings.')
    .addSubcommand((s) =>
      s
        .setName('issue')
        .setDescription('Issue a warning to a user.')
        .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500))
        .addIntegerOption((o) =>
          o
            .setName('expiry-days')
            .setDescription(`Days until the warning expires (default: ${WARNING_DEFAULT_EXPIRY_DAYS}, 0 = never)`)
            .setMinValue(0)
            .setMaxValue(365)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription("List a user's warnings.")
        .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('revoke')
        .setDescription('Revoke a warning by ID.')
        .addIntegerOption((o) => o.setName('id').setDescription('Warning ID').setRequired(true).setMinValue(1))
    ),

  async executeCommand(command, client, interaction) {
    const sub = interaction.options.getSubcommand(true);

    if (sub === 'issue') {
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const expiryDays = interaction.options.getInteger('expiry-days');

      const targetError = validateModerationTarget(target, interaction.user, 'warn');
      if (targetError) {
        await interaction.reply({ content: targetError, flags: MessageFlags.Ephemeral });
        return;
      }

      const expiresAt = expiryDays === 0 ? null : new Date(Date.now() + (expiryDays ?? WARNING_DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000);

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { warning, escalationNote } = await issueWarning(client, interaction.guild!, { target, moderator: interaction.user, reason, expiresAt });
      const expiryLine = warning.expiresAt ? `Expires ${discordTimestamp(warning.expiresAt, 'R')}.` : 'No expiry.';

      await interaction.editReply({
        content: `Warned <@${target.id}> (reason: ${reason}). Warning **#${warning.id}** recorded. ${expiryLine}${escalationNote}`,
      });
      return;
    }

    if (sub === 'list') {
      const user = interaction.options.getUser('user', true);
      const rows = await listWarningsForUser(user.id);
      const now = new Date();
      const top = rows.slice(0, MOD_LIST_PAGE_SIZE);

      const activeCount = rows.filter((w) => !w.revokedAt && (!w.expiresAt || w.expiresAt > now)).length;
      const expiredCount = rows.filter((w) => !w.revokedAt && w.expiresAt && w.expiresAt <= now).length;
      const revokedCount = rows.filter((w) => !!w.revokedAt).length;

      const embed = new EmbedBuilder()
        .setColor(appFeatureMap[command.options.feature].color)
        .setTitle(`Warnings for ${user.tag}`)
        .setDescription(top.length === 0 ? '*No warnings.*' : top.map((w) => line(w, now)).join('\n\n'))
        .setFooter({ text: `${rows.length} total · ${activeCount} active · ${expiredCount} expired · ${revokedCount} revoked` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'revoke') {
      const id = interaction.options.getInteger('id', true);
      const existing = await findWarningById(id);
      if (!existing) {
        await interaction.reply({ content: `No warning #${id}.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (existing.revokedAt) {
        await interaction.reply({ content: `Warning #${id} is already revoked.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const updated = await revokeWarning(id, interaction.user.id);
      if (!updated) throw new BotException(client, `Failed to revoke warning #${id}`);

      await recordAuditEvent({
        eventType: AuditEventType.WarnRevoked,
        actorUserId: interaction.user.id,
        targetUserId: updated.targetUserId ?? undefined,
        payload: { warningId: id },
      });

      await interaction.reply({ content: `Warning #${id} revoked.`, flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
