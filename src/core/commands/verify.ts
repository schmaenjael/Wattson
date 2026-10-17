import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import {
  AuditEventType,
  findUserById,
  findVerificationByDiscordId,
  getSettings,
  recordAuditEvent,
  upsertUser,
  upsertVoltVerification,
} from '~/database';
import { Command, Permission } from '~/core/models';
import { L } from '~/core/locales';
import { AppFeature, Colors } from '~/settings';
import { discordTimestamp, Logger, logSoftFailure, softFail } from '~/utilities';
import { activeVerifications, runVerification } from '~/core/providers/verification';
import { logtoClient } from '~/core/providers/logto';

const activeVolterVerifications = new Set<string>();

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.VolterVerification,
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

    const guild = await client.guilds.fetch(process.env.GUILD_ID!).catch(softFail(AppFeature.VolterVerification, 'VERIFICATION_GUILD_FETCH'));
    if (!guild) {
      await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_GUILD_UNAVAILABLE(), flags: MessageFlags.Ephemeral });
      return;
    }

    const locale = guild.preferredLocale;
    const member = await guild.members
      .fetch(interaction.user.id)
      .catch(softFail(AppFeature.VolterVerification, 'VERIFICATION_MEMBER_FETCH', { userId: interaction.user.id }));
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
      // audit_log.targetUserId is FK-constrained; a throw here would abort before runVerification
      // and the member would be told the flow started while no DM ever arrives.
      await upsertUser({ id: interaction.user.id, username: interaction.user.username });
      await recordAuditEvent({ eventType: AuditEventType.VerificationRestarted, targetUserId: interaction.user.id, payload: {} });
      runVerification(client, member).catch(softFail(AppFeature.VolterVerification, 'VERIFICATION_FLOW_RESTART', { userId: interaction.user.id }));
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
              .setDescription(V.ALREADY_VERIFIED({ expiry: `${discordTimestamp(existing.expiresAt, 'D')}` }))
              .setColor(Colors.Green),
          ],
        });
        return;
      }

      activeVolterVerifications.add(interaction.user.id);
      try {
        let flow;
        try {
          flow = await logtoClient.initiateDeviceFlow();
        } catch (error) {
          logSoftFailure(AppFeature.VolterVerification, 'VERIFICATION_DEVICE_FLOW_INIT_FAILED', { userId: interaction.user.id }, error, 'error');
          await interaction.editReply({ content: V.ERROR() });
          return;
        }

        const expiry = `<t:${Math.floor((Date.now() + flow.expires_in * 1000) / 1000)}:R>`;
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(V.EMBED_TITLE())
              .setDescription(V.EMBED_DESCRIPTION({ url: flow.verification_uri_complete, code: flow.user_code, expiry }))
              .setColor(Colors.Purple),
          ],
        });

        const result = await logtoClient.pollForToken(flow.device_code, flow.expires_in, flow.interval);

        if (!result.success) {
          const msg = result.reason === 'denied' ? V.DENIED() : V.TIMEOUT();
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌').setDescription(msg).setColor(Colors.Red)] });
          return;
        }

        const logger = Logger.getInstance(AppFeature.VolterVerification);
        let roleGranted = true;
        if (settings.roleMemberId) {
          try {
            await member.roles.add(settings.roleMemberId, 'Volt membership verified via LogTo');
          } catch (err) {
            roleGranted = false;
            logSoftFailure(
              AppFeature.VolterVerification,
              'VERIFICATION_VOLTER_ROLE_ADD',
              { roleId: settings.roleMemberId, userId: interaction.user.id },
              err
            );
          }
        } else {
          logger.warn({ userId: interaction.user.id }, 'roleMemberId not configured — skipping Volter role assignment.');
        }

        if (!roleGranted) {
          // Persisting the verification would make the row block every retry via the
          // "already verified" guard, leaving the member with no role and no way to self-repair.
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌').setDescription(V.ERROR()).setColor(Colors.Red)] });
          return;
        }

        await upsertVoltVerification(interaction.user.id, result.sub);

        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(V.SUCCESS_TITLE()).setDescription(V.SUCCESS()).setColor(Colors.Green)] });

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
              { name: 'Expires', value: verification ? `${discordTimestamp(verification.expiresAt, 'D')}` : '—', inline: true }
            )
            .setColor(Colors.Purple)
            .setTimestamp(),
        });
      } finally {
        activeVolterVerifications.delete(interaction.user.id);
      }
    }
  },
});
