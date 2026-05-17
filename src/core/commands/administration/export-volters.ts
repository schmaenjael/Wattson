import {
  ActionRowBuilder,
  ApplicationCommandType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Collection,
  ComponentType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { AuditEventType, getSettings, getVoltersForChapter, recordAuditEvent } from '~/database';
import { Logger } from '~/utilities';

const APPROVAL_TIMEOUT_MS = 15 * 60 * 1000;

const csvEscape = (s: string): string => {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.VolterExport,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('export-volters')
    .setDescription('Export verified Volt members for a chapter as CSV.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o.setName('chapter').setDescription('ISO country code of the chapter (e.g. DE, FR, NL)').setRequired(true).setMaxLength(4)
    ),

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const logger = Logger.getInstance(AppFeature.VolterExport);
    const color = appFeatureMap[AppFeature.VolterExport].color;

    // SECURITY: Fresh member fetch — never trust cached permissions for sensitive operations.
    const requesterMember = await interaction.guild!.members.fetch(interaction.user.id);
    if (!requesterMember.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'This command requires the Discord **Administrator** permission.', flags: MessageFlags.Ephemeral });
      return;
    }

    const chapter = interaction.options.getString('chapter', true).toUpperCase();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await recordAuditEvent({ eventType: AuditEventType.VolterExportRequested, actorUserId: interaction.user.id, payload: { chapter } });

    const settings = await getSettings();
    const postChannel = settings.notificationChannelId
      ? ((await client.channels.fetch(settings.notificationChannelId).catch(() => null)) as TextChannel | null)
      : null;
    const targetChannel = postChannel ?? (interaction.channel as TextChannel);

    const approveId = `volter_export_approve:${interaction.id}`;
    const denyId = `volter_export_deny:${interaction.id}`;

    const approvalEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle('📊 Volter Export Request')
      .setDescription('A **second Administrator** must approve. The CSV will be sent to the requester via DM only.')
      .addFields({ name: 'Chapter', value: chapter, inline: true }, { name: 'Requested by', value: `<@${interaction.user.id}>`, inline: true })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(approveId).setLabel('Approve & Export').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(denyId).setLabel('Deny').setStyle(ButtonStyle.Danger)
    );

    const message = await targetChannel.send({ embeds: [approvalEmbed], components: [row] });
    await interaction.editReply({ content: `Export request posted. A second Administrator must approve it in <#${targetChannel.id}>.` });

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: APPROVAL_TIMEOUT_MS });

    collector.on('collect', async (btn: ButtonInteraction) => {
      // SECURITY: Fresh member fetch on every interaction — never trust cached permissions.
      const approverMember = await interaction.guild!.members.fetch(btn.user.id).catch(() => null);
      if (!approverMember || !approverMember.permissions.has(PermissionFlagsBits.Administrator)) {
        await btn.reply({ content: 'Only Discord **Administrators** can approve this export.', flags: MessageFlags.Ephemeral });
        return;
      }

      // SECURITY: Requester cannot self-approve.
      if (btn.user.id === interaction.user.id) {
        await btn.reply({ content: 'You cannot approve your own export request.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (btn.customId === approveId) {
        collector.stop('approved');

        await recordAuditEvent({
          eventType: AuditEventType.VolterExportApproved,
          actorUserId: btn.user.id,
          targetUserId: interaction.user.id,
          payload: { chapter },
        });

        const rows = await getVoltersForChapter(chapter);
        const csvLines = [
          'id,username,haiilo_link,chapter_country',
          ...rows.map((r) => `${r.id},${csvEscape(r.username)},${csvEscape(r.haiiloLink ?? '')},${csvEscape(r.chapterCountry ?? '')}`),
        ];
        const attachment = new AttachmentBuilder(Buffer.from(csvLines.join('\n'), 'utf-8'), { name: `volters-${chapter.toLowerCase()}.csv` });

        let deliveryNote: string;
        try {
          const dm = await client.users.createDM(interaction.user.id);
          await dm.send({
            content: `✅ Volter export for chapter **${chapter}** — ${rows.length} row(s). Approved by <@${btn.user.id}>.`,
            files: [attachment],
          });
          deliveryNote = `CSV sent to <@${interaction.user.id}> via DM.`;
        } catch (err) {
          logger.warn(Object(err), `Failed to DM export CSV to ${interaction.user.tag}`);
          deliveryNote = `⚠️ DM to <@${interaction.user.id}> failed — CSV was NOT delivered.`;
        }

        approvalEmbed.setTitle(`✅ Approved by ${btn.user.tag}`).setDescription(deliveryNote);
        await btn.update({ embeds: [approvalEmbed], components: [] });
      } else if (btn.customId === denyId) {
        collector.stop('denied');

        await recordAuditEvent({
          eventType: AuditEventType.VolterExportDenied,
          actorUserId: btn.user.id,
          targetUserId: interaction.user.id,
          payload: { chapter },
        });

        approvalEmbed.setTitle(`❌ Denied by ${btn.user.tag}`).setDescription(null);
        await btn.update({ embeds: [approvalEmbed], components: [] });
      }
    });

    collector.on('end', async (_collected: Collection<string, ButtonInteraction>, reason: string) => {
      if (reason === 'approved' || reason === 'denied') return;
      try {
        await message.edit({ embeds: [approvalEmbed.setTitle(`⌛ Timed out: export for ${chapter}`)], components: [] });
      } catch {
        /* best-effort */
      }
      logger.warn(`Volter export approval timed out for chapter ${chapter} requested by ${interaction.user.tag}`);
    });
  },
});
