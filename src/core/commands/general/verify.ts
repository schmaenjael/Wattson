import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { Command, Permission } from '~/core/models';
import { L } from '~/core/locales';
import { AppFeature } from '~/settings';
import { activeVerifications, activeVolterVerifications, runVerification, runVolterVerification } from '~/core/providers/verification';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Welcome,
  type: ApplicationCommandType.ChatInput,
  global: true,
  middleware: [],
  requiredPermissions: [Permission.Unregistered],
  allowDM: true,
  dmOnly: true,
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Server verification commands.')
    .setContexts([InteractionContextType.BotDM])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .addSubcommand((sub) => sub.setName('start').setDescription('Start or restart your server verification.'))
    .addSubcommand((sub) => sub.setName('volter').setDescription('Request Volt member (Volter) status via your Haiilo profile.')),
  async executeCommand(_command, client, interaction) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID!).catch(() => null);
    if (!guild) {
      await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_GUILD_UNAVAILABLE(), flags: MessageFlags.Ephemeral });
      return;
    }

    const locale = guild.preferredLocale;
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: L[locale].GENERAL.COMMAND_NOT_A_MEMBER(), flags: MessageFlags.Ephemeral });
      return;
    }

    const settings = await getSettings();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      const R = L[locale].SYSTEM.VERIFICATION.RESTART;

      if (activeVerifications.has(interaction.user.id)) {
        await interaction.reply({ content: R.ALREADY_ACTIVE(), flags: MessageFlags.Ephemeral });
        return;
      }

      if (settings.roleCommunityId && member.roles.cache.has(settings.roleCommunityId)) {
        await interaction.reply({ content: R.ALREADY_VERIFIED(), flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({ content: R.SUCCESS(), flags: MessageFlags.Ephemeral });
      await recordAuditEvent({ eventType: AuditEventType.VerificationRestarted, targetUserId: interaction.user.id, payload: {} });
      runVerification(client, member).catch(() => null);
      return;
    }

    if (subcommand === 'volter') {
      const V = L[locale].SYSTEM.VERIFICATION.VOLTER;

      if (activeVerifications.has(interaction.user.id) || activeVolterVerifications.has(interaction.user.id)) {
        await interaction.reply({ content: V.ALREADY_ACTIVE(), flags: MessageFlags.Ephemeral });
        return;
      }

      if (!settings.roleCommunityId || !member.roles.cache.has(settings.roleCommunityId)) {
        await interaction.reply({ content: V.NOT_VERIFIED(), flags: MessageFlags.Ephemeral });
        return;
      }

      if (settings.roleMemberId && member.roles.cache.has(settings.roleMemberId)) {
        await interaction.reply({ content: V.ALREADY_VOLTER(), flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({ content: V.SUCCESS(), flags: MessageFlags.Ephemeral });
      await recordAuditEvent({ eventType: AuditEventType.VerificationStarted, targetUserId: interaction.user.id, payload: { source: 'volter' } });
      runVolterVerification(client, member).catch(() => null);
    }
  },
});
