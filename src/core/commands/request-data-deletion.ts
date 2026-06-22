import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

import { Command } from '~/core/models';
import { AppFeature, Colors, ProcessExitCode } from '~/settings';
import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { L } from '~/core/locales';

const CONFIRM_ID = 'gdpr_user_confirm';
const CANCEL_ID = 'gdpr_user_cancel';
const CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.GdprDeletion,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('request-data-deletion')
    .setDescription('Request permanent deletion of your personal data (GDPR/DSGVO). Results in a permanent ban.')
    .setContexts(InteractionContextType.Guild),

  async executeCommand(_command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const locale = interaction.locale;
    const T = L[locale].MODERATION.GDPR_REQUEST;

    const infoEmbed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle(T.CONFIRM_TITLE())
      .setDescription(T.CONFIRM_DESCRIPTION())
      .addFields(
        { name: T.WILL_DELETE_TITLE(), value: T.WILL_DELETE_VALUE() },
        { name: T.CANNOT_DELETE_TITLE(), value: T.CANNOT_DELETE_VALUE() },
        { name: '​', value: T.BAN_WARNING() }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(CONFIRM_ID).setLabel(T.CONFIRM_BUTTON()).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(CANCEL_ID).setLabel(T.CANCEL_BUTTON()).setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [infoEmbed], components: [row], flags: MessageFlags.Ephemeral });
    const reply = await interaction.fetchReply();

    let confirmation: ButtonInteraction;
    try {
      confirmation = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: CONFIRM_TIMEOUT_MS,
      });
    } catch {
      await interaction.editReply({ embeds: [], components: [], content: T.CANCELLED() });
      return;
    }

    if (confirmation.customId === CANCEL_ID) {
      await confirmation.update({ embeds: [], components: [], content: T.CANCELLED() });
      return;
    }

    await confirmation.update({ embeds: [], components: [], content: T.SUBMITTED() });

    const settings = await getSettings();

    const pendingEmbed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('GDPR/DSGVO Data Deletion — User Request')
      .setDescription(
        '**All** personal data for this user will be permanently erased and the user will be permanently banned. This action is irreversible.'
      )
      .addFields(
        { name: 'Target (self-request)', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)` },
        { name: 'Status', value: '⏳ Awaiting moderator approval' }
      )
      .setTimestamp();

    const approveId = `gdpr:approve:${interaction.user.id}:${interaction.user.id}`;
    const denyId = `gdpr:deny:${interaction.user.id}:${interaction.user.id}`;

    const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(approveId).setLabel('Approve & Execute').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(denyId).setLabel('Deny').setStyle(ButtonStyle.Secondary)
    );

    let requestMessageId: string | undefined;
    if (settings.modLogChannelId) {
      const logChannel = (await interaction.guild!.channels.fetch(settings.modLogChannelId)) as TextChannel | null;
      if (logChannel) {
        const msg = await logChannel.send({ embeds: [pendingEmbed], components: [approvalRow] });
        requestMessageId = msg.id;
      }
    }
    if (!requestMessageId) {
      const msg = await (interaction.channel as TextChannel).send({ embeds: [pendingEmbed], components: [approvalRow] });
      requestMessageId = msg.id;
    }

    await recordAuditEvent({
      eventType: AuditEventType.DataDeletionRequested,
      actorUserId: interaction.user.id,
      targetUserId: interaction.user.id,
      payload: { selfRequested: true, requestMessageId },
    });
  },
});
