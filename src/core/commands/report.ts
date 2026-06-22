import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  InteractionContextType,
  TextChannel,
} from 'discord.js';

import { appFeatureMap, AppFeature } from '~/settings';
import { baseLocale } from '~/core/locales';
import { Command, BotException } from '~/core/models';
import { getSettings, insertReport, recordAuditEvent, upsertUser, AuditEventType } from '~/database';

import { ReportEmbed, ReportReceivedEmbed } from '~/core/components/Report';

export default new Command<ApplicationCommandType.Message>({
  type: ApplicationCommandType.Message,
  feature: AppFeature.Report,
  data: new ContextMenuCommandBuilder().setName('report').setType(ApplicationCommandType.Message).setContexts(InteractionContextType.Guild),
  middleware: [],
  async executeCommand(command, client, interaction) {
    const settings = await getSettings();

    const reportEmbed = new ReportEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: baseLocale,
      authorName: interaction.targetMessage.author.displayName,
      authorIcon: interaction.targetMessage.author.avatarURL() || interaction.targetMessage.author.defaultAvatarURL,
      authorId: interaction.targetMessage.author.id,
      targetChannel: interaction.targetMessage.channelId,
      reporterId: interaction.user.id,
      targetUrl: interaction.targetMessage.url,
    });

    const appreciationEmbed = new ReportReceivedEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: interaction.locale,
      authorId: interaction.user.id,
      targetUrl: interaction.targetMessage.url,
    });

    await Promise.all([
      upsertUser({ id: interaction.user.id, username: interaction.user.username }),
      upsertUser({ id: interaction.targetMessage.author.id, username: interaction.targetMessage.author.username }),
    ]);

    let report;
    try {
      report = await insertReport({
        reporterId: interaction.user.id,
        reportedUserId: interaction.targetMessage.author.id,
        channelId: interaction.targetMessage.channelId,
        messageId: interaction.targetMessage.id,
        messageContent: interaction.targetMessage.content,
      });
    } catch (error) {
      throw new BotException(client, 'Error while inserting report into database', error);
    }

    await recordAuditEvent({
      eventType: AuditEventType.ReportFiled,
      actorUserId: interaction.user.id,
      targetUserId: interaction.targetMessage.author.id,
      payload: { reportId: report.id, messageLink: interaction.targetMessage.url },
    });

    if (settings.reportsLogChannelId) {
      const channel = (await interaction.guild!.channels.fetch(settings.reportsLogChannelId)) as TextChannel;
      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`report:dismiss:${report.id}`).setLabel('Dismiss').setEmoji('❌').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`report:warn:${report.id}`).setLabel('Warn').setEmoji('⚠️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`report:ban:${report.id}`).setLabel('Ban').setEmoji('🔨').setStyle(ButtonStyle.Danger)
      );
      await channel.send({
        embeds: [reportEmbed.render()],
        files: [...reportEmbed.attachments, ...interaction.targetMessage.attachments.values().toArray()],
        components: [actionRow],
      });
    }

    await interaction.reply({ embeds: [appreciationEmbed.render()], flags: appreciationEmbed.flags });
  },
});
