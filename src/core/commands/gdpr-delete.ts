import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, Colors } from '~/settings';
import { AuditEventType, getSettings, recordAuditEvent } from '~/database';

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.GdprDeletion,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('gdpr-delete')
    .setDescription('Submit a GDPR/DSGVO data deletion request for a user (requires second moderator approval).')
    .addUserOption((o) => o.setName('user').setDescription('User whose data to permanently erase').setRequired(true)),

  async executeCommand(command, client, interaction) {
    const target = interaction.options.getUser('user', true);

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot request deletion of your own data via this command.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: 'Cannot request data deletion for a bot.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const settings = await getSettings();

    const pendingEmbed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('GDPR/DSGVO Data Deletion Request')
      .setDescription(
        '**All** personal data for this user will be permanently erased and the user will be permanently banned. This action is irreversible.'
      )
      .addFields(
        { name: 'Target', value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
        { name: 'Requested by', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Status', value: '⏳ Awaiting second moderator approval' }
      )
      .setTimestamp();

    const approveId = `gdpr:approve:${target.id}:${interaction.user.id}`;
    const denyId = `gdpr:deny:${target.id}:${interaction.user.id}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(approveId).setLabel('Approve & Execute').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(denyId).setLabel('Deny').setStyle(ButtonStyle.Secondary)
    );

    let requestMessageId: string | undefined;

    if (settings.modLogChannelId) {
      const logChannel = (await interaction.guild!.channels.fetch(settings.modLogChannelId)) as TextChannel | null;
      if (logChannel) {
        const msg = await logChannel.send({ embeds: [pendingEmbed], components: [row] });
        requestMessageId = msg.id;
        await interaction.editReply({ content: `Data deletion request posted to <#${settings.modLogChannelId}>. A second moderator must approve.` });
      }
    }

    if (!requestMessageId) {
      await interaction.editReply({ content: 'No moderation log channel configured — request posted in this channel.' });
      const msg = await (interaction.channel as TextChannel).send({ embeds: [pendingEmbed], components: [row] });
      requestMessageId = msg.id;
    }

    await recordAuditEvent({
      eventType: AuditEventType.DataDeletionRequested,
      actorUserId: interaction.user.id,
      targetUserId: target.id,
      payload: { requestMessageId },
    });
  },
});
