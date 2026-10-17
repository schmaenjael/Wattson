import { APIEmbedField, Client as DiscordClient, EmbedBuilder, TextChannel } from 'discord.js';

import { AppFeature, appFeatureMap, assets } from '~/settings';
import { getSettings } from '~/database';
import { Client } from '~/core/models';
import { ROLE_COLUMN_BY_PERMISSION } from '~/core/middleware/permissionCore';
import { Logger, softFail } from '~/utilities';
import { L } from '~/core/locales';
import { loadSchedulables, getSchedulables } from '~/core/loaders/loadSchedulables';
import { warmupHarmDetector } from '~/core/providers/harm';
import { initInviteCache } from '~/core/loaders/inviteCache';
import { startVoiceSession } from '~/core/providers/analytics';

/** ClientReady boot sequence: enforce single-guild, prime caches/schedulers, and post the status report. */
export const bootstrap = async (client: Client, readyClient: DiscordClient<true>): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.System);
  const settings = await getSettings();

  Logger.initDiscord(client);
  logger.info(`Ready as ${readyClient.user.username}#${readyClient.user.discriminator}`);

  const expectedGuildId = process.env.GUILD_ID;
  for (const guildInCache of client.guilds.cache.values()) {
    if (guildInCache.id !== expectedGuildId) {
      logger.warn(`Leaving unexpected guild ${guildInCache.name} (${guildInCache.id}).`);
      await guildInCache.leave().catch(softFail(AppFeature.System, 'SYSTEM_UNEXPECTED_GUILD_LEAVE', { guildId: guildInCache.id }));
    }
  }

  const guild = await client.guilds.fetch(expectedGuildId).catch(softFail(AppFeature.System, 'SYSTEM_GUILD_FETCH', { expectedGuildId }));
  if (!guild) {
    logger.fatal(`Bot is not a member of configured GUILD_ID=${expectedGuildId}. Invite the bot before starting.`);
    return;
  }

  for (const voiceState of guild.voiceStates.cache.values()) {
    if (voiceState.channelId && !voiceState.member?.user.bot) {
      startVoiceSession(voiceState.id);
    }
  }

  await loadSchedulables(client);

  if (settings.featureInviteTrackingEnabled) {
    await initInviteCache(guild);
  }

  if (settings.featureHarmDetectionEnabled) {
    warmupHarmDetector().catch(softFail(AppFeature.System, 'SYSTEM_WARMUP_HARM_DETECTOR'));
  }

  if (!settings.featureSystemNotificationsEnabled) {
    logger.debug('System notifications disabled.');
    return;
  }
  if (!settings.notificationChannelId) {
    logger.error('No notification channel configured. Set settings.notificationChannelId via /config.');
    return;
  }
  const channel = (await guild.channels.fetch(settings.notificationChannelId)) as TextChannel;

  const on = (v: boolean) => (v ? '🟢' : '⚫');
  const ch = (id: string | null | undefined) => (id ? `<#${id}>` : 'not set');

  const ollamaModel = process.env.OLLAMA_MODEL;
  const ollamaEndpoint = process.env.OLLAMA_ENDPOINT;
  const ragEndpoint = process.env.RAG_ENDPOINT;

  const serviceLines = [
    `🟢 Schedulables · ${[...getSchedulables().keys()].join(' / ')}`,
    `${on(!!ollamaModel)} Ollama · ${ollamaModel ?? 'not configured'}${ollamaEndpoint ? ` @ ${ollamaEndpoint}` : ''}`,
    `${on(settings.featureAskEnabled)} AI Ask · ${settings.featureAskEnabled ? 'enabled' : 'disabled'}`,
    `${on(settings.featureRagEnabled && !!ragEndpoint)} RAG · ${settings.featureRagEnabled ? (ragEndpoint ?? 'not configured') : 'disabled'}`,
    `${on(settings.featureInviteTrackingEnabled)} Invite cache · ${settings.featureInviteTrackingEnabled ? 'active' : 'disabled'}`,
  ];

  const featureLines = [
    `${on(settings.featureWelcomeEnabled)} Welcome${settings.featureWelcomeEnabled ? ` · ${ch(settings.welcomeChannelId)}` : ''}`,
    `${on(settings.featureSurveillanceEnabled)} Surveillance${settings.featureSurveillanceEnabled ? ` · ${ch(settings.surveillanceLogChannelId)}` : ''}`,
    `${on(settings.featureStarboardEnabled)} Starboard${settings.featureStarboardEnabled ? ` · ${ch(settings.starboardChannelId)} · ≥${settings.starboardThreshold}⭐` : ''}`,
    `${on(settings.featureCourtEnabled)} Court${settings.featureCourtEnabled ? ` · ${ch(settings.courtParentChannelId)}` : ''}`,
    `${on(settings.featureHarmDetectionEnabled)} Harm detection${settings.featureHarmDetectionEnabled ? ` · ${ollamaModel ?? '?'} · alerts → surveillance log` : ''}`,
    `${on(settings.featureBadWordsEnabled)} Bad words${settings.featureBadWordsEnabled ? ` · delete ≥ sev ${settings.badWordDeleteThreshold}` : ''}`,
    `${on(settings.featureAntiSpamEnabled)} Anti-spam${settings.featureAntiSpamEnabled ? ` · ${settings.antiSpamMaxMessages} msg / ${settings.antiSpamWindowMs}ms` : ''}`,
    `${on(settings.featureAntiHoistEnabled)} Anti-hoist`,
    `${on(settings.featureLinkFilterEnabled)} Link filter`,
    `${on(settings.featureWarnAutoMuteEnabled)} Warn auto-mute${settings.featureWarnAutoMuteEnabled ? ` · base ${settings.warnAutoMuteBaseMinutes}m` : ''}`,
    `${on(settings.featureVerificationRequiresApproval)} Verification approval${settings.featureVerificationRequiresApproval ? ` · ${ch(settings.approvalChannelId)}` : ''}`,
  ];

  const locale = guild.preferredLocale;
  const color = appFeatureMap[AppFeature.System].color;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(L[locale].SYSTEM.EVENT_READY.EMBED_TITLE())
        .setDescription(`> *${L[locale].SYSTEM.EVENT_READY.EMBED_DESCRIPTION()}*`)
        .addFields(
          { name: `✅ ${L[locale].SYSTEM.STATUS.STATE()}`, value: 'Online', inline: true },
          { name: `\u{1F5C4}️ ${L[locale].SYSTEM.STATUS.DATABASE()}`, value: 'Connected', inline: true },
          { name: `\u{1F469}‍\u{1F4BB} ${L[locale].SYSTEM.STATUS.SERVICE_LATENCY()}`, value: `${Math.abs(readyClient.ws.ping)}ms`, inline: true },
          { name: `\u{1F501} ${L[locale].SYSTEM.STATUS.SHARDS()}`, value: `${readyClient.shard?.count ?? 1}`, inline: true },
          { name: `\u{1F4C6} ${L[locale].SYSTEM.STATUS.SERVICE_LAUNCH_TIME()}`, value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: `\u{1F4C2} ${L[locale].SYSTEM.STATUS.LOADED_COMMANDS()}`, value: `${client.getCommands().size}`, inline: true },
          { name: '⚙️ Services', value: serviceLines.join('\n') },
          { name: '🧩 Features', value: featureLines.join('\n') }
        )
        .setThumbnail(assets.wattson['256x256'].url)
        .setFooter({ text: L[locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
        .setTimestamp(),
    ],
    files: [assets.volt['256x256'].file, assets.wattson['256x256'].file],
  });

  const sortedCommands = [...client.getCommands().values()].sort((a, b) => a.options.data.name.localeCompare(b.options.data.name));
  const protectedRows: string[] = [];
  const openRows: string[] = [];

  for (const cmd of sortedCommands) {
    const label = `\`/${cmd.options.data.name}\``;
    const perms = cmd.options.requiredPermissions ?? [];
    if (cmd.options.dmOnly) {
      openRows.push(`${label} · DM only`);
    } else if (perms.length === 0) {
      openRows.push(`${label} · everyone`);
    } else {
      const roleLabels = perms.map((p) => {
        const roleId = settings[ROLE_COLUMN_BY_PERMISSION[p]] as string | null;
        return roleId ? `<@&${roleId}>` : p;
      });
      protectedRows.push(`${label} · ${roleLabels.join(', ')}`);
    }
  }

  const toFields = (name: string, rows: string[]): APIEmbedField[] => {
    if (rows.length === 0) return [{ name, value: '-' }];
    const chunks: string[] = [];
    let current = '';
    for (const row of rows) {
      const appended = current ? `${current}\n${row}` : row;
      if (appended.length > 1024) {
        chunks.push(current);
        current = row;
      } else {
        current = appended;
      }
    }
    if (current) chunks.push(current);
    return chunks.map((value, i) => ({ name: i === 0 ? name : '​', value }));
  };

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(`\u{1F4C2} Loaded Commands (${client.getCommands().size})`)
        .addFields(...toFields('\u{1F512} Protected Commands', protectedRows), ...toFields('\u{1F310} Public & DM-only Commands', openRows))
        .setFooter({ text: L[locale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
        .setTimestamp(),
    ],
  });
};
