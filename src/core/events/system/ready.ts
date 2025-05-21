import { EmbedBuilder, Events, TextChannel } from 'discord.js';

import { AppFeature, appFeatureMap, assets } from '~/settings';
import DatabaseClient, { tblGuild } from '~/database';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { L } from '~/core/locales';

import { BigColumnPadding, SmallRowPadding } from '~/core/components/padding';

export default new Event({
  type: Events.ClientReady,
  feature: AppFeature.System,
  once: true,
  middleware: [],
  async executeCommand(event, client, interaction) {
    const logger = Logger.getInstance();
    const db = DatabaseClient.getInstance();
    const guilds = await db.select({ guildId: tblGuild.id }).from(tblGuild);

    guilds.forEach(async ({ guildId }) => {
      const config = await DatabaseClient.loadConfig(guildId);

      logger.info(`Loaded ${guilds.length} guilds from the database.`);

      logger.info(`Ready as ${interaction.user.username}#${interaction.user.discriminator}`);

      if (!config?.system?.notificationChannelId) return logger.error(`No system channel config found for guild ${guildId.trim()}.`);
      if (!config.system.systemNotificationEnabled) return logger.debug(`Disabled system notification channel for guild ${guildId.trim()}.`);

      const guild = await client.guilds.fetch(guildId);
      const channel = (await guild.channels.fetch(config.system.notificationChannelId)) as TextChannel;

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
              { name: `🔁 ${L[guild.preferredLocale].SYSTEM.STATUS.SHARDS()}`, value: `${client.shard?.count ?? 1}`, inline: true },
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
              { name: `👩‍💻 ${L[guild.preferredLocale].SYSTEM.STATUS.SERVICE_LATENCY()}`, value: `${Math.abs(interaction.ws.ping)}ms`, inline: true },
              { name: '\u200B', value: '\u200B', inline: true },
              SmallRowPadding
            )
            .setThumbnail(assets.wattson['256x256'].url)
            .setFooter({ text: L[guild.preferredLocale].GENERAL.WATTSON_IN_SERVICE(), iconURL: assets.volt['256x256'].url })
            .setTimestamp(),
        ],
        files: [assets.volt['256x256'].file, assets.wattson['256x256'].file],
      });
    });
  },
});
