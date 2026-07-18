import {
  ActionRowBuilder,
  ApplicationCommandType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type TextChannel,
} from 'discord.js';

import { Command, Permission } from '~/core/models';
import { memberHasAnyPermission } from '~/core/middleware/permissionCore';
import { AppFeature } from '~/settings';
import { ModmailCategory, ModmailStatus, findModmailById, findModmailByThreadId, findOpenModmailByUserId, getSettings } from '~/database';
import { ModmailShowEmbed } from '~/core/components/Modmail';
import { dispatchCloseAction, finalizeModmailClose, openModmailFlow, sendModmailAttachment } from '~/core/providers/modmail';
import { L } from '~/core/locales';

export const MODMAIL_MSG_MODAL_PREFIX = 'modmail_msg:';

const checkModRole = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const settings = await getSettings();
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return false;
  return memberHasAnyPermission(member, settings, [Permission.Moderation]);
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Modmail,
  type: ApplicationCommandType.ChatInput,
  global: true,
  middleware: [],
  requiredPermissions: [],
  allowDM: true,
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
        await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_GUILD_UNAVAILABLE(), flags: MessageFlags.Ephemeral });
        return;
      }

      // Verify the user is a guild member
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: L[guild.preferredLocale].GENERAL.COMMAND_NOT_A_MEMBER(), flags: MessageFlags.Ephemeral });
        return;
      }

      const channel = (await guild.channels.fetch(settings.modmailChannelId).catch(() => null)) as TextChannel | null;
      if (!channel) {
        await interaction.reply({ content: 'Modmail channel not found. Contact an administrator.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { modmail, guideEmbed } = await openModmailFlow(channel, interaction.user, category, reason);

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
                  .setMaxLength(4000)
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

        const sent = await sendModmailAttachment(client, modmail, interaction.user, 'user', file);
        if (!sent) {
          await interaction.editReply({ content: 'Could not find your modmail thread.' });
          return;
        }
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

      const sent = await sendModmailAttachment(client, modmail, interaction.user, 'mod', file);
      if (!sent) {
        await interaction.editReply({ content: 'Could not find the modmail thread.' });
        return;
      }
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
        await finalizeModmailClose(client, modmail, 'user', interaction.user);

        await interaction.editReply({ content: '✅ Your modmail has been closed.' });
        await dispatchCloseAction(client, modmail);
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
      await finalizeModmailClose(client, modmail, 'mod', interaction.user);

      await interaction.editReply({ content: '✅ Modmail closed.' });
      await dispatchCloseAction(client, modmail);
      return;
    }

    // ── show ──────────────────────────────────────────────────────────────────
    if (sub === 'show') {
      if (isDm) {
        await interaction.reply({ content: L[interaction.locale].GENERAL.COMMAND_INVALID_IN_DMS(), flags: MessageFlags.Ephemeral });
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

      const targetUser = modmail.userId ? await client.users.fetch(modmail.userId).catch(() => null) : null;
      await interaction.reply({ embeds: [new ModmailShowEmbed({ modmail, user: targetUser }).render()], flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
