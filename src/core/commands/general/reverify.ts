import { ApplicationCommandType, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { AuditEventType, recordAuditEvent } from '~/database';
import { Command } from '~/core/models';
import { L } from '~/core/locales';
import { AppFeature } from '~/settings';
import { activeVerifications, runVerification } from '~/core/providers/verification';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Welcome,
  type: ApplicationCommandType.ChatInput,
  global: true,
  middleware: [],
  requiredPermissions: [],
  data: new SlashCommandBuilder()
    .setName('reverify')
    .setDescription('Re-submit your verification to the moderation team.')
    .setContexts([InteractionContextType.BotDM]),
  async executeCommand(_command, client, interaction) {
    const locale = interaction.guildLocale ?? 'en-US';
    const R = L[locale].SYSTEM.VERIFICATION.RESTART;

    if (activeVerifications.has(interaction.user.id)) {
      await interaction.reply({ content: R.ALREADY_ACTIVE(), flags: MessageFlags.Ephemeral });
      return;
    }

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    const member = await guild?.members.fetch(interaction.user.id).catch(() => null);

    if (!guild || !member) {
      await interaction.reply({ content: 'You must be a member of the server to use this command.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: R.SUCCESS(), flags: MessageFlags.Ephemeral });
    await recordAuditEvent({ eventType: AuditEventType.VerificationRestarted, targetUserId: interaction.user.id, payload: {} });
    runVerification(client, member).catch(() => null);
  },
});
