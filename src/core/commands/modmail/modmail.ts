import {
  ActionRowBuilder,
  ApplicationCommandType,
  ChannelType,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  type PublicThreadChannel,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type TextChannel,
} from 'discord.js';

import { Command } from '~/core/models';
import { AppFeature } from '~/settings';
import {
  AuditEventType,
  ModmailCategory,
  ModmailStatus,
  closeModmail,
  findModmailById,
  findModmailByThreadId,
  findOpenModmailByUserId,
  getSettings,
  openModmail,
  recordAuditEvent,
  touchModmailActivity,
  upsertUser,
} from '~/database';
import {
  CATEGORY_LABELS,
  buildKeepOpenDisabledRow,
  buildModmailClosedByModEmbed,
  buildModmailClosedByUserEmbed,
  buildModmailClosedDmEmbed,
  buildModmailOpenThreadEmbed,
  buildModmailShowEmbed,
  buildUserDmGuideEmbed,
} from '~/core/components/Modmail';

export const MODMAIL_MSG_MODAL_PREFIX = 'modmail_msg:';

const checkModRole = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const settings = await getSettings();
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (settings.roleModerationId && member.roles.cache.has(settings.roleModerationId)) return true;
  return false;
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Modmail,
  type: ApplicationCommandType.ChatInput,
  global: true,
  middleware: [],
  requiredPermissions: [],
  data: new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Open, manage, and close modmail threads with the moderation team.')
    .setContexts([InteractionContextType.BotDM, InteractionContextType.Guild])
    .addSubcommand((s) =>
      s
        .setName('open')
        .setDescription('Open a new modmail thread.')
        .addStringOption((o) =>
          o
            .setName('category')
            .setDescription('Category of your inquiry')
            .setRequired(true)
            .addChoices(
              { name: '🤝 Partnerships', value: ModmailCategory.Partnerships },
              { name: '📋 Other', value: ModmailCategory.Other },
              { name: '🚨 Report', value: ModmailCategory.Report },
              { name: 'ℹ️ Information Request', value: ModmailCategory.InformationRequest },
              { name: '⚡ Volt Membership', value: ModmailCategory.VoltMembership },
              { name: '⚠️ Mod Complaint', value: ModmailCategory.ModComplaint }
            )
        )
        .addStringOption((o) =>
          o.setName('reason').setDescription('Brief summary of your inquiry (max 512 chars)').setRequired(true).setMaxLength(512)
        )
    )
    .addSubcommand((s) =>
      s.setName('message').setDescription('Send a message in your modmail thread (or reply as moderator from within the thread).')
    )
    .addSubcommand((s) =>
      s
        .setName('attach')
        .setDescription('Attach an image or file to your modmail thread.')
        .addAttachmentOption((o) => o.setName('file').setDescription('File or image to attach').setRequired(true))
    )
    .addSubcommand((s) => s.setName('close').setDescription('Close your modmail thread.'))
    .addSubcommand((s) =>
      s
        .setName('show')
        .setDescription('Show information about a specific modmail. (Moderators only)')
        .addIntegerOption((o) => o.setName('id').setDescription('Modmail ID').setRequired(true).setMinValue(1))
    ),

  async executeCommand(_command, client, interaction) {
    const sub = interaction.options.getSubcommand(true);
    const isDm = !interaction.guildId;

    // ── open ──────────────────────────────────────────────────────────────────
    if (sub === 'open') {
      const category = interaction.options.getString('category', true) as ModmailCategory;
      const reason = interaction.options.getString('reason', true);

      const existing = await findOpenModmailByUserId(interaction.user.id);
      if (existing) {
        await interaction.reply({
          content: `You already have an open modmail (thread <#${existing.threadId}>). Close it with \`/modmail close\` before opening a new one.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const settings = await getSettings();
      if (!settings.modmailChannelId) {
        await interaction.reply({ content: 'Modmail is not configured on this server. Contact an administrator.', flags: MessageFlags.Ephemeral });
        return;
      }

      const guild = client.guilds.cache.get(process.env.GUILD_ID);
      if (!guild) {
        await interaction.reply({ content: 'Could not reach the server. Please try again.', flags: MessageFlags.Ephemeral });
        return;
      }

      // Verify the user is a guild member
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: 'You must be a member of the server to open a modmail.', flags: MessageFlags.Ephemeral });
        return;
      }

      const channel = (await guild.channels.fetch(settings.modmailChannelId).catch(() => null)) as TextChannel | null;
      if (!channel) {
        await interaction.reply({ content: 'Modmail channel not found. Contact an administrator.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await upsertUser({ id: interaction.user.id, username: interaction.user.username });

      const thread = (await channel.threads.create({
        name: `📬 Modmail — ${interaction.user.username}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PublicThread,
        reason: `Modmail opened by ${interaction.user.username} (${interaction.user.id})`,
      })) as PublicThreadChannel;

      const modmail = await openModmail({ userId: interaction.user.id, threadId: thread.id, category, reason, status: ModmailStatus.Open });

      await thread.setName(`📬 Modmail #${modmail.id} — ${interaction.user.username}`).catch(() => null);

      const pingContent = settings.roleModmailHandlerId ? `<@&${settings.roleModmailHandlerId}>` : undefined;
      await thread.send({ content: pingContent, embeds: [buildModmailOpenThreadEmbed(modmail, interaction.user)] });

      await recordAuditEvent({
        eventType: AuditEventType.ModmailOpened,
        actorUserId: interaction.user.id,
        targetUserId: interaction.user.id,
        payload: { modmailId: modmail.id, category, threadId: thread.id },
      });

      const guideEmbed = buildUserDmGuideEmbed(modmail);
      if (isDm) {
        await interaction.editReply({ embeds: [guideEmbed] });
      } else {
        await interaction.editReply({ content: `✅ Modmail #${modmail.id} opened. Check your DMs for next steps.` });
        const dmChannel = await interaction.user.createDM().catch(() => null);
        await dmChannel?.send({ embeds: [guideEmbed] }).catch(() => null);
      }
      return;
    }

    // ── message ───────────────────────────────────────────────────────────────
    if (sub === 'message') {
      if (isDm) {
        const modmail = await findOpenModmailByUserId(interaction.user.id);
        if (!modmail) {
          await interaction.reply({ content: 'You have no open modmail. Use `/modmail open` to start one.', flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(`${MODMAIL_MSG_MODAL_PREFIX}${modmail.id}:user`)
            .setTitle('Send Message to Moderators')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('content')
                  .setLabel('Message')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
                  .setMaxLength(2000)
                  .setPlaceholder('Write your message here...')
              )
            )
        );
        return;
      }

      const modmail = await findModmailByThreadId(interaction.channelId);
      if (!modmail || modmail.status === ModmailStatus.Closed) {
        await interaction.reply({ content: 'Use this command from within an active modmail thread.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!(await checkModRole(interaction))) {
        await interaction.reply({ content: 'Only moderators can reply from the modmail thread.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`${MODMAIL_MSG_MODAL_PREFIX}${modmail.id}:mod`)
          .setTitle('Reply to User')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('content')
                .setLabel('Reply')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(2000)
                .setPlaceholder('Write your reply here...')
            )
          )
      );
      return;
    }

    // ── attach ────────────────────────────────────────────────────────────────
    if (sub === 'attach') {
      const file = interaction.options.getAttachment('file', true);

      if (isDm) {
        const modmail = await findOpenModmailByUserId(interaction.user.id);
        if (!modmail) {
          await interaction.reply({ content: 'You have no open modmail.', flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);
        if (!thread?.isThread()) {
          await interaction.editReply({ content: 'Could not find your modmail thread.' });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setAuthor({ name: `${interaction.user.username} — User`, iconURL: interaction.user.displayAvatarURL() })
          .setDescription('📎 Sent an attachment')
          .setTimestamp();
        await thread.send({ embeds: [embed], files: [{ attachment: file.url, name: file.name }] });
        await touchModmailActivity(modmail.id);
        await interaction.editReply({ content: '✅ Attachment sent.' });
        return;
      }

      const modmail = await findModmailByThreadId(interaction.channelId);
      if (!modmail || modmail.status === ModmailStatus.Closed) {
        await interaction.reply({ content: 'Use this command from within an active modmail thread.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!(await checkModRole(interaction))) {
        await interaction.reply({ content: 'Only moderators can attach files from the modmail thread.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guild = client.guilds.cache.get(process.env.GUILD_ID);
      const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);
      if (!thread?.isThread()) {
        await interaction.editReply({ content: 'Could not find the modmail thread.' });
        return;
      }

      const threadEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setAuthor({ name: `${interaction.user.username} — Moderator`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription('📎 Sent an attachment')
        .setFooter({ text: 'Moderator reply' })
        .setTimestamp();
      await thread.send({ embeds: [threadEmbed], files: [{ attachment: file.url, name: file.name }] });

      const targetUser = await client.users.fetch(modmail.userId).catch(() => null);
      if (targetUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle(`💬 Moderator Attachment — Modmail #${modmail.id}`)
          .setDescription('📎 A moderator sent an attachment.')
          .setFooter({ text: 'Reply via /modmail message · /modmail attach · /modmail close' })
          .setTimestamp();
        const dmChannel = await targetUser.createDM().catch(() => null);
        await dmChannel?.send({ embeds: [dmEmbed], files: [{ attachment: file.url, name: file.name }] }).catch(() => null);
      }

      await touchModmailActivity(modmail.id);
      await interaction.editReply({ content: '✅ Attachment sent.' });
      return;
    }

    // ── close ─────────────────────────────────────────────────────────────────
    if (sub === 'close') {
      if (isDm) {
        const modmail = await findOpenModmailByUserId(interaction.user.id);
        if (!modmail) {
          await interaction.reply({ content: 'You have no open modmail.', flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await closeModmail(modmail.id);
        await recordAuditEvent({
          eventType: AuditEventType.ModmailClosed,
          actorUserId: interaction.user.id,
          targetUserId: modmail.userId,
          payload: { modmailId: modmail.id, closedBy: 'user' },
        });

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);
        if (thread?.isThread()) {
          await thread.send({ embeds: [buildModmailClosedByUserEmbed(interaction.user)] });
          try {
            await thread.setArchived(true);
          } catch {
            /* archive is best-effort */
          }
        }

        // Disable stale button if one was sent
        if (modmail.staleMessageId && thread?.isThread()) {
          const msg = await thread.messages.fetch(modmail.staleMessageId).catch(() => null);
          await msg?.edit({ components: [buildKeepOpenDisabledRow(modmail.id)] }).catch(() => null);
        }

        await interaction.editReply({ content: '✅ Your modmail has been closed.' });
        return;
      }

      const modmail = await findModmailByThreadId(interaction.channelId);
      if (!modmail || modmail.status === ModmailStatus.Closed) {
        await interaction.reply({
          content: 'Use this command from within an active modmail thread, or this modmail is already closed.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!(await checkModRole(interaction))) {
        await interaction.reply({ content: 'Only moderators can close modmails from the thread.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await closeModmail(modmail.id);
      await recordAuditEvent({
        eventType: AuditEventType.ModmailClosed,
        actorUserId: interaction.user.id,
        targetUserId: modmail.userId,
        payload: { modmailId: modmail.id, closedBy: 'mod' },
      });

      if (interaction.channel?.isThread()) {
        await interaction.channel.send({ embeds: [buildModmailClosedByModEmbed(interaction.user)] });
        if (modmail.staleMessageId) {
          const msg = await interaction.channel.messages.fetch(modmail.staleMessageId).catch(() => null);
          await msg?.edit({ components: [buildKeepOpenDisabledRow(modmail.id)] }).catch(() => null);
        }
        try {
          await interaction.channel.setArchived(true);
        } catch {
          /* archive is best-effort */
        }
      }

      const targetUser = await client.users.fetch(modmail.userId).catch(() => null);
      if (targetUser) {
        const dmChannel = await targetUser.createDM().catch(() => null);
        await dmChannel?.send({ embeds: [buildModmailClosedDmEmbed()] }).catch(() => null);
      }

      await interaction.editReply({ content: '✅ Modmail closed.' });
      return;
    }

    // ── show ──────────────────────────────────────────────────────────────────
    if (sub === 'show') {
      if (isDm) {
        await interaction.reply({ content: 'This command can only be used in the server.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (!(await checkModRole(interaction))) {
        await interaction.reply({ content: 'Only moderators can view modmail details.', flags: MessageFlags.Ephemeral });
        return;
      }

      const id = interaction.options.getInteger('id', true);
      const modmail = await findModmailById(id);
      if (!modmail) {
        await interaction.reply({ content: `No modmail found with ID #${id}.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const targetUser = await client.users.fetch(modmail.userId).catch(() => null);
      await interaction.reply({ embeds: [buildModmailShowEmbed(modmail, targetUser)], flags: MessageFlags.Ephemeral });
      return;
    }
  },
});

// Re-export for use in modal/button handlers
export { CATEGORY_LABELS };
