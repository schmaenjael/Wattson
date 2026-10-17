import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
import { baseLocale } from '~/core/locales';
import { Command, BotException } from '~/core/models';
import { useFeatureFlag } from '~/core/middleware';
import { insertReport, recordAuditEvent, upsertUser, AuditEventType } from '~/database';
import { publishReport } from '~/core/providers/report';
import { ReportEmbed, ReportReceivedEmbed } from '~/core/components/Report';

export default new Command<ApplicationCommandType.Message>({
  type: ApplicationCommandType.Message,
  feature: AppFeature.Report,
  data: new ContextMenuCommandBuilder().setName('report').setType(ApplicationCommandType.Message).setContexts(InteractionContextType.Guild),
  middleware: [useFeatureFlag('featureReportsEnabled')],
  async executeCommand(command, client, interaction) {
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

    const reportEmbed = new ReportEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: baseLocale,
      reportId: report.id,
      authorName: interaction.targetMessage.author.displayName,
      authorIcon: interaction.targetMessage.author.avatarURL() || interaction.targetMessage.author.defaultAvatarURL,
      authorId: interaction.targetMessage.author.id,
      targetChannel: interaction.targetMessage.channelId,
      reporterId: interaction.user.id,
      targetUrl: interaction.targetMessage.url,
    });

    const published = await publishReport(interaction.guild!, report, reportEmbed.render(), [
      ...reportEmbed.attachments,
      ...interaction.targetMessage.attachments.values().toArray(),
    ]);
    if (published === 'unreachable') {
      await interaction.reply({ content: 'The reports channels are not reachable — please tell an administrator.', flags: MessageFlags.Ephemeral });
      return;
    }

    const appreciationEmbed = new ReportReceivedEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: interaction.locale,
      authorId: interaction.user.id,
      targetUrl: interaction.targetMessage.url,
    });
    await interaction.reply({ embeds: [appreciationEmbed.render()], flags: appreciationEmbed.flags });
  },
});
