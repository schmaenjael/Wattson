import { Colors, EmbedBuilder, Events, MessageFlags } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature } from '~/settings';
import { ModmailStatus, findModmailById, resetModmailFromStale } from '~/database';
import { buildKeepOpenDisabledRow } from '~/core/components/Modmail';

const PREFIX = 'modmail_keep_open:';

export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.Modmail,
  middleware: [],
  async executeCommand(_event, client, interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith(PREFIX)) return;

    const modmailId = parseInt(interaction.customId.slice(PREFIX.length), 10);
    if (isNaN(modmailId)) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const modmail = await findModmailById(modmailId);
    if (!modmail || modmail.status !== ModmailStatus.StalePending) {
      await interaction.editReply({ content: 'This modmail is no longer in stale state.' });
      return;
    }

    await resetModmailFromStale(modmailId);

    const disabledRow = buildKeepOpenDisabledRow(modmailId);
    const guild = client.guilds.cache.get(process.env.GUILD_ID);

    // Disable button on thread stale message
    if (modmail.staleMessageId) {
      const thread = await guild?.channels.fetch(modmail.threadId).catch(() => null);
      if (thread?.isThread()) {
        const msg = await thread.messages.fetch(modmail.staleMessageId).catch(() => null);
        await msg?.edit({ components: [disabledRow] }).catch(() => null);
      }
    }

    // Disable button on DM stale message
    const targetUser = await client.users.fetch(modmail.userId).catch(() => null);
    if (modmail.staleDmMessageId && targetUser) {
      const dmChannel = await targetUser.createDM().catch(() => null);
      const msg = await dmChannel?.messages.fetch(modmail.staleDmMessageId).catch(() => null);
      await msg?.edit({ components: [disabledRow] }).catch(() => null);
    }

    // Notify thread
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

    // Notify user
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
  },
});
