import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission, BotException } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { AuditEventType, findWarningById, listWarningsForUser, recordAuditEvent, revokeWarning, type Warning } from '~/database';

const PAGE_SIZE = 10;

const line = (w: Warning) => {
  const badge = w.revokedAt ? '⚪ revoked' : '🟡 active';
  return `**#${w.id}** · ${badge} · <t:${Math.floor(w.createdAt.getTime() / 1000)}:R> by <@${w.moderatorId}>\n> ${w.reason}`;
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Warn,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Review or revoke warnings.')
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

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const sub = interaction.options.getSubcommand(true);

    if (sub === 'list') {
      const user = interaction.options.getUser('user', true);
      const rows = await listWarningsForUser(user.id);
      const top = rows.slice(0, PAGE_SIZE);

      const embed = new EmbedBuilder()
        .setColor(appFeatureMap[command.options.feature].color)
        .setTitle(`Warnings for ${user.tag}`)
        .setDescription(top.length === 0 ? '*No warnings.*' : top.map(line).join('\n\n'))
        .setFooter({ text: `${rows.length} total · ${rows.filter((w) => !w.revokedAt).length} active` })
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
        targetUserId: updated.targetUserId,
        payload: { warningId: id },
      });

      await interaction.reply({ content: `Warning #${id} revoked.`, flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
