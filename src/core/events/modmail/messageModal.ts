import { Colors, EmbedBuilder, Events, MessageFlags } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { ModmailStatus, findModmailById, touchModmailActivity } from '~/database';
import { MODMAIL_MSG_MODAL_PREFIX } from '~/core/commands/modmail/modmail';

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.Modmail,
  middleware: [],
  async executeCommand(_event, client, interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith(MODMAIL_MSG_MODAL_PREFIX)) return;

    const parts = interaction.customId.slice(MODMAIL_MSG_MODAL_PREFIX.length).split(':');
    const modmailId = parseInt(parts[0], 10);
    const side = parts[1] as 'user' | 'mod';
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

    if (side === 'user') {
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setAuthor({ name: `${interaction.user.username} — User`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(content)
        .setTimestamp();
      await thread.send({ embeds: [embed] });
    } else {
      const threadEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setAuthor({ name: `${interaction.user.username} — Moderator`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(content)
        .setFooter({ text: 'Moderator reply' })
        .setTimestamp();
      await thread.send({ embeds: [threadEmbed] });

      const dmEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(`💬 Moderator Reply — Modmail #${modmailId}`)
        .setDescription(content)
        .setFooter({ text: 'Reply via /modmail message · /modmail attach · /modmail close' })
        .setTimestamp();
      const targetUser = await client.users.fetch(modmail.userId).catch(() => null);
      if (targetUser) {
        const dmChannel = await targetUser.createDM().catch(() => null);
        await dmChannel?.send({ embeds: [dmEmbed] }).catch(() => null);
      }
    }

    await touchModmailActivity(modmailId);
    await interaction.editReply({ content: '✅ Message sent.' });
  },
});
