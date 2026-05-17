import {
  ApplicationCommandType,
  ChannelType,
  EmbedBuilder,
  Message,
  MessageCreateOptions,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { getSettings } from '~/database';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Say,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as the bot.')
    .addStringOption((o) => o.setName('text').setDescription('Message text').setRequired(false).setMaxLength(2000))
    .addAttachmentOption((o) => o.setName('attachment').setDescription('File to attach').setRequired(false))
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to send to (defaults to current)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addStringOption((o) => o.setName('reply_to').setDescription('Message ID to reply to').setRequired(false)),

  async executeCommand(command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const text = interaction.options.getString('text', false);
    const attachment = interaction.options.getAttachment('attachment', false);
    const targetChannel = (interaction.options.getChannel('channel', false) ?? interaction.channel) as TextChannel;
    const replyToId = interaction.options.getString('reply_to', false)?.trim();

    if (!text && !attachment) {
      await interaction.reply({ content: 'Provide at least `text` or an `attachment`.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let replyTarget: Message | null = null;
    if (replyToId) {
      replyTarget = await targetChannel.messages.fetch(replyToId).catch(() => null);
      if (!replyTarget) {
        await interaction.editReply({ content: `Message \`${replyToId}\` not found in <#${targetChannel.id}>.` });
        return;
      }
    }

    const sendOptions: MessageCreateOptions = {};
    if (text) {
      sendOptions.content = text;
    }
    if (attachment) {
      sendOptions.files = [{ attachment: attachment.url, name: attachment.name }];
    }
    if (replyTarget) {
      sendOptions.reply = { messageReference: replyTarget };
    }

    const sent = await targetChannel.send(sendOptions);

    const settings = await getSettings();
    if (settings.sayLogChannelId) {
      const logChannel = (await interaction.guild!.channels.fetch(settings.sayLogChannelId).catch(() => null)) as TextChannel | null;
      await logChannel
        ?.send({
          embeds: [
            new EmbedBuilder()
              .setColor(appFeatureMap[command.options.feature].color)
              .setTitle('Bot message sent')
              .addFields(
                { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'In', value: `<#${targetChannel.id}>`, inline: true },
                { name: 'Message', value: `[Jump](${sent.url})`, inline: true },
                ...(text ? [{ name: 'Content', value: text.length > 1024 ? `${text.slice(0, 1021)}…` : text }] : []),
                ...(replyTarget ? [{ name: 'Reply to', value: `[Jump](${replyTarget.url})`, inline: true }] : []),
                ...(attachment ? [{ name: 'Attachment', value: attachment.name }] : [])
              )
              .setTimestamp(),
          ],
        })
        .catch(() => null);
    }

    await interaction.editReply({ content: `Done. [Jump to message](${sent.url})` });
  },
});
