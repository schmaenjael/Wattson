import { EmbedBuilder, Events, TextChannel } from 'discord.js';

import { AppFeature, appFeatureMap, assets } from '~/settings';
import { getSettings } from '~/database';
import { Event, Permission } from '~/core/models';
import { Logger } from '~/utilities';
import { L } from '~/core/locales';
import { startBanSweeper } from '~/core/scheduler/banSweeper';
import { startMuteSweeper } from '~/core/scheduler/muteSweeper';
import { startModmailSweeper } from '~/core/scheduler/modmailSweeper';
import { warmupHarmDetector } from '~/core/providers/harm';

import { BigColumnPadding, SmallRowPadding } from '~/core/components/padding';

export default new Event({
  type: Events.ClientReady,
  feature: AppFeature.System,
  once: true,
  requiredPermissions: [Permission.Unregistered],
  middleware: [],
  async executeCommand(event, client, readyClient) {
    const logger = Logger.getInstance(AppFeature.System);
    const settings = await getSettings();

    logger.info(`Ready as ${readyClient.user.username}#${readyClient.user.discriminator}`);

    const expectedGuildId = process.env.GUILD_ID;
    for (const guildInCache of client.guilds.cache.values()) {
      if (guildInCache.id !== expectedGuildId) {
        logger.warn(`Leaving unexpected guild ${guildInCache.name} (${guildInCache.id}).`);
        await guildInCache.leave().catch((e) => logger.error(Object(e), 'leave() failed'));
      }
    }

    const guild = await client.guilds.fetch(expectedGuildId).catch(() => null);
    if (!guild) {
      logger.fatal(`Bot is not a member of configured GUILD_ID=${expectedGuildId}. Invite the bot before starting.`);
      return;
    }

    startBanSweeper(client);
    startMuteSweeper(client);
    startModmailSweeper(client);

    if (settings.featureHarmDetectionEnabled) {
      warmupHarmDetector().catch(() => null);
    }

    if (!settings.featureSystemNotificationsEnabled) {
      return logger.debug('System notifications disabled.');
    }
    if (!settings.notificationChannelId) {
      return logger.error('No notification channel configured. Set settings.notificationChannelId via /config.');
    }
    const channel = (await guild.channels.fetch(settings.notificationChannelId)) as TextChannel;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(appFeatureMap[event.options.feature].color)
          .setTitle(L[guild.preferredLocale].SYSTEM.EVENT_READY.EMBED_TITLE())
          .setDescription(`> *${L[guild.preferredLocale].SYSTEM.EVENT_READY.EMBED_DESCRIPTION()}*`)
          .addFields(
            SmallRowPadding,
            { name: `✅ ${L[guild.preferredLocale].SYSTEM.STATUS.STATE()}`, value: 'All services initialized successfully.', inline: true },
            { name: `🗄️ ${L[guild.preferredLocale].SYSTEM.STATUS.DATABASE()}`, value: 'Connected', inline: true },
            BigColumnPadding,
            { name: `🔁 ${L[guild.preferredLocale].SYSTEM.STATUS.SHARDS()}`, value: `${readyClient.shard?.count ?? 1}`, inline: true },
            {
              name: `📆 ${L[guild.preferredLocale].SYSTEM.STATUS.SERVICE_LAUNCH_TIME()}`,
              value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
              inline: true,
            },
            BigColumnPadding,
            {
              name: `📂 ${L[guild.preferredLocale].SYSTEM.STATUS.LOADED_COMMANDS()}`,
              value: `${client
                .getCommands()
                .map(({ options }) => `• ${options.data.name}`)
                .join('\n')}`,
              inline: true,
            },
            { name: `👩‍💻 ${L[guild.preferredLocale].SYSTEM.STATUS.SERVICE_LATENCY()}`, value: `${Math.abs(readyClient.ws.ping)}ms`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            SmallRowPadding
          )
          .setThumbnail(assets.wattson['256x256'].url)
          .setFooter({ text: L[guild.preferredLocale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
          .setTimestamp(),
      ],
      files: [assets.volt['256x256'].file, assets.wattson['256x256'].file],
    });
  },
});
