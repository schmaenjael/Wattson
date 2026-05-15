import { ApplicationCommandType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { Command } from '~/core/models';
import { L } from '~/core/locales';
import { AppFeature } from '~/settings';
import { activeVerifications, runVerification } from '~/core/providers/verification';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Welcome,
  type: ApplicationCommandType.ChatInput,
  middleware: [],
  requiredPermissions: [],
  data: new SlashCommandBuilder().setName('verify').setDescription('Start or restart your server verification.'),
  async executeCommand(_command, client, interaction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const locale = interaction.guild.preferredLocale;
    const R = L[locale].SYSTEM.VERIFICATION.RESTART;

    if (activeVerifications.has(interaction.user.id)) {
      await interaction.reply({ content: R.ALREADY_ACTIVE(), flags: MessageFlags.Ephemeral });
      return;
    }

    const settings = await getSettings();
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (settings.roleCommunityId && member.roles.cache.has(settings.roleCommunityId)) {
      await interaction.reply({ content: R.ALREADY_VERIFIED(), flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: R.SUCCESS(), flags: MessageFlags.Ephemeral });
    await recordAuditEvent({ eventType: AuditEventType.VerificationRestarted, targetUserId: interaction.user.id, payload: {} });
    runVerification(client, member).catch(() => null);
  },
});
