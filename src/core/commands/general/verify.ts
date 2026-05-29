import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import { AuditEventType, findUserById, findVerificationByDiscordId, getSettings, recordAuditEvent, upsertVoltVerification } from '~/database';
import { Command, Permission } from '~/core/models';
import { L } from '~/core/locales';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';
import { activeVerifications, runVerification } from '~/core/providers/verification';
import { initiateDeviceFlow, pollForToken } from '~/core/providers/logto';

const activeVolterVerifications = new Set<string>();

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
    .setDescription('Server and Volt membership verification.')
    .setContexts([InteractionContextType.BotDM])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .addSubcommand((s) => s.setName('start').setDescription('Start or restart your server verification.'))
    .addSubcommand((s) => s.setName('volter').setDescription('Verify your active Volt membership via LogTo.')),

  async executeCommand(_command, client, interaction) {
    const sub = interaction.options.getSubcommand(true);

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

    if (sub === 'start') {
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

    if (sub === 'volter') {
      const V = L[locale].SYSTEM.VOLT_VERIFICATION;

      const userRecord = await findUserById(interaction.user.id);
      const hasCommunityRole = settings.roleCommunityId ? member.roles.cache.has(settings.roleCommunityId) : false;

      if (!userRecord || !hasCommunityRole) {
        await interaction.reply({ content: V.NOT_ENROLLED(), flags: MessageFlags.Ephemeral });
        return;
      }

      if (activeVolterVerifications.has(interaction.user.id)) {
        await interaction.reply({ content: V.IN_PROGRESS(), flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const existing = await findVerificationByDiscordId(interaction.user.id);
      if (existing && existing.expiresAt > new Date()) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(V.SUCCESS_TITLE())
              .setDescription(V.ALREADY_VERIFIED({ expiry: `<t:${Math.floor(existing.expiresAt.getTime() / 1000)}:D>` }))
              .setColor('#22C55E'),
          ],
        });
        return;
      }

      activeVolterVerifications.add(interaction.user.id);
      try {
        let flow;
        try {
          flow = await initiateDeviceFlow();
        } catch {
          await interaction.editReply({ content: V.ERROR() });
          return;
        }

        const expiry = `<t:${Math.floor((Date.now() + flow.expires_in * 1000) / 1000)}:R>`;
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(V.EMBED_TITLE())
              .setDescription(V.EMBED_DESCRIPTION({ url: flow.verification_uri_complete, code: flow.user_code, expiry }))
              .setColor('#7C3AED'),
          ],
        });

        const result = await pollForToken(flow.device_code, flow.expires_in, flow.interval);

        if (!result.success) {
          const msg = result.reason === 'denied' ? V.DENIED() : V.TIMEOUT();
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌').setDescription(msg).setColor('#EF4444')] });
          return;
        }

        await upsertVoltVerification(interaction.user.id, result.sub);

        const logger = Logger.getInstance(AppFeature.VolterVerification);
        if (settings.roleMemberId) {
          try {
            await member.roles.add(settings.roleMemberId, 'Volt membership verified via LogTo');
          } catch (err) {
            logger.error({ ...Object(err), roleId: settings.roleMemberId, userId: interaction.user.id }, 'Failed to assign Volter role.');
          }
        } else {
          logger.warn({ userId: interaction.user.id }, 'roleMemberId not configured — skipping Volter role assignment.');
        }

        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(V.SUCCESS_TITLE()).setDescription(V.SUCCESS()).setColor('#22C55E')] });

        const verification = await findVerificationByDiscordId(interaction.user.id);
        await logger.log({
          level: 'info',
          message: `Volt verification completed for ${interaction.user.id}`,
          data: { userId: interaction.user.id },
          target: 'moderation',
          internalEmbed: new EmbedBuilder()
            .setTitle(V.LOG_TITLE())
            .addFields(
              { name: 'User', value: `<@${interaction.user.id}> (${interaction.user.id})`, inline: true },
              { name: 'Expires', value: verification ? `<t:${Math.floor(verification.expiresAt.getTime() / 1000)}:D>` : '—', inline: true }
            )
            .setColor('#7C3AED')
            .setTimestamp(),
        });
      } finally {
        activeVolterVerifications.delete(interaction.user.id);
      }
    }
  },
});
