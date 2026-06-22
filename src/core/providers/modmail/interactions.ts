import { ButtonInteraction, Colors, EmbedBuilder, MessageFlags, ModalSubmitInteraction } from 'discord.js';

import { Client } from '~/core/models';
import { Permission } from '~/core/models/Permission';
import { memberHasAnyPermission } from '~/core/middleware/permissionCore';
import { ModmailStatus, findModmailById, getSettings, resetModmailFromStale, touchModmailActivity } from '~/database';
import { buildKeepOpenDisabledRow } from '~/core/components/Modmail';
import { chunkText } from '~/utilities/utils';

export const handleKeepOpenButton = async (client: Client, interaction: ButtonInteraction): Promise<void> => {
  const modmailId = parseInt(interaction.customId.split(':')[1], 10);
  if (isNaN(modmailId)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const modmail = await findModmailById(modmailId);
  if (!modmail || modmail.status !== ModmailStatus.StalePending) {
    await interaction.editReply({ content: 'This modmail is no longer in stale state.' });
    return;
  }

  if (!interaction.guildId) {
    if (interaction.user.id !== modmail.userId) {
      await interaction.editReply({ content: 'This is not your modmail.' });
      return;
    }
  } else {
    const settings = await getSettings();
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !memberHasAnyPermission(member, settings, [Permission.Moderation])) {
      await interaction.editReply({ content: 'Only moderators can keep modmails open from the thread.' });
      return;
    }
  }

  await resetModmailFromStale(modmailId);

  const disabledRow = buildKeepOpenDisabledRow(modmailId);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);

  if (modmail.staleMessageId) {
    const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);
    if (thread?.isThread()) {
      const msg = await thread.messages.fetch(modmail.staleMessageId).catch(() => null);
      await msg?.edit({ components: [disabledRow] }).catch(() => null);
    }
  }

  const targetUser = modmail.userId ? await client.users.fetch(modmail.userId).catch(() => null) : null;
  if (modmail.staleDmMessageId && targetUser) {
    const dmChannel = await targetUser.createDM().catch(() => null);
    const msg = await dmChannel?.messages.fetch(modmail.staleDmMessageId).catch(() => null);
    await msg?.edit({ components: [disabledRow] }).catch(() => null);
  }

  const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);
  if (thread?.isThread()) {
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Modmail Kept Open')
          .setDescription(`<@${interaction.user.id}> chose to keep modmail #${modmailId} open.`)
          .setTimestamp(),
      ],
    });
  }

  if (targetUser) {
    const dmChannel = await targetUser.createDM().catch(() => null);
    await dmChannel
      ?.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle(`✅ Modmail #${modmailId} Kept Open`)
            .setDescription('Your modmail has been kept open. Use `/modmail message` to continue or `/modmail close` to close it.')
            .setTimestamp(),
        ],
      })
      .catch(() => null);
  }

  await interaction.editReply({ content: '✅ Modmail kept open.' });
};

export const handleMessageModal = async (client: Client, interaction: ModalSubmitInteraction): Promise<void> => {
  const parts = interaction.customId.split(':');
  const modmailId = parseInt(parts[1], 10);
  const side = parts[2] as 'user' | 'mod';
  if (isNaN(modmailId) || (side !== 'user' && side !== 'mod')) return;

  const modmail = await findModmailById(modmailId);
  if (!modmail || modmail.status === ModmailStatus.Closed) {
    await interaction.reply({ content: 'This modmail is no longer active.', flags: MessageFlags.Ephemeral });
    return;
  }

  const content = interaction.fields.getTextInputValue('content');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);
  if (!thread?.isThread()) {
    await interaction.editReply({ content: 'Could not find the modmail thread.' });
    return;
  }

  const chunks = chunkText(content, 4096);

  if (side === 'user') {
    const embeds = chunks.map((chunk, i) =>
      new EmbedBuilder()
        .setColor(Colors.Blue)
        .setAuthor(i === 0 ? { name: `${interaction.user.username} — User`, iconURL: interaction.user.displayAvatarURL() } : null)
        .setDescription(chunk)
        .setTimestamp(i === chunks.length - 1 ? new Date() : null)
    );
    await thread.send({ embeds });
  } else {
    const threadEmbeds = chunks.map((chunk, i) =>
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setAuthor(i === 0 ? { name: `${interaction.user.username} — Moderator`, iconURL: interaction.user.displayAvatarURL() } : null)
        .setDescription(chunk)
        .setFooter(i === chunks.length - 1 ? { text: 'Moderator reply' } : null)
        .setTimestamp(i === chunks.length - 1 ? new Date() : null)
    );
    await thread.send({ embeds: threadEmbeds });

    const dmEmbeds = chunks.map((chunk, i) =>
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(i === 0 ? `💬 Moderator Reply — Modmail #${modmailId}` : null)
        .setDescription(chunk)
        .setFooter(i === chunks.length - 1 ? { text: 'Reply via /modmail message · /modmail attach · /modmail close' } : null)
        .setTimestamp(i === chunks.length - 1 ? new Date() : null)
    );
    const targetUser = modmail.userId ? await client.users.fetch(modmail.userId).catch(() => null) : null;
    if (targetUser) {
      const dmChannel = await targetUser.createDM().catch(() => null);
      await dmChannel?.send({ embeds: dmEmbeds }).catch(() => null);
    }
  }

  await touchModmailActivity(modmailId);
  await interaction.editReply({ content: '✅ Message sent.' });
};
