import { ApplicationCommandType, MessageFlags, EmbedBuilder, ContextMenuCommandBuilder, TextChannel, InteractionContextType } from 'discord.js';

import { type InferSelectModel } from 'drizzle-orm';
import { appFeatureMap, AppFeature } from '~/settings';
import { useGuildOnlyMessageCommand } from '~/core/middleware';
import { baseLocale } from '~/core/locales';
import { Command, RecoverableException } from '~/core/models';
import DatabaseClient, { tblReports } from '~/database';

import { ReportEmbed, ReportReceivedEmbed } from '~/core/components/Report';

const insertReport = async (
  report: Pick<InferSelectModel<typeof tblReports>, 'fkUserReportedId' | 'fkUserReporterId' | 'fkGuildId' | 'message' | 'channelId' | 'messageLink'>
): Promise<boolean> => {
  const db = DatabaseClient.getInstance();

  try {
    const value = await db.insert(tblReports).values(report).returning();
    console.log(value);
    return !!value;
  } catch (error) {
    console.error('Error while inserting report into database', error);
    return false;
  }
};

export default new Command<ApplicationCommandType.Message>({
  type: ApplicationCommandType.Message,
  feature: AppFeature.Ping,
  data: new ContextMenuCommandBuilder().setName('report').setType(ApplicationCommandType.Message).setContexts(InteractionContextType.Guild),
  middleware: [useGuildOnlyMessageCommand], // gurantees a guild context
  async executeCommand(command, client, message) {
    const config = await DatabaseClient.loadConfig(message.guildId!);

    const reportEmbed = new ReportEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: baseLocale,
      authorName: message.targetMessage.author.displayName,
      authorIcon: message.targetMessage.author.avatarURL() || message.targetMessage.author.defaultAvatarURL,
      authorId: message.targetMessage.author.id,
      targetChannel: message.targetMessage.channelId,
      reporterId: message.user.id,
      targetUrl: message.targetMessage.url,
    });

    const appreciationEmbed = new ReportReceivedEmbed({
      color: appFeatureMap[command.options.feature].color,
      locale: message.locale,
      authorId: message.user.id,
      targetUrl: message.targetMessage.url,
    });

    console.log('yes');

    const reportSuccessful = await insertReport({
      fkUserReportedId: message.targetMessage.author.id,
      fkUserReporterId: message.user.id,
      fkGuildId: message.guildId!,
      message: message.targetMessage.content,
      channelId: message.targetMessage.channelId,
      messageLink: message.targetMessage.url,
    });

    console.log('no');

    const channel = (await message.guild!.channels.fetch(config.surveillance.reportsLogChannel!)) as TextChannel;
    channel.send({ embeds: [reportEmbed.render()], files: [...reportEmbed.attachments, ...message.targetMessage.attachments.values().toArray()] });

    await message.reply({ embeds: [appreciationEmbed.render()], flags: appreciationEmbed.flags });

    if (!reportSuccessful) {
      throw new RecoverableException(client, `Error while inserting report into database`);
    }
  },
});
