import { ApplicationCommandType, ChannelType, EmbedBuilder, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature } from '~/settings';
import { deleteStickyByChannelId, getStickyByChannelId, listStickyMessages, upsertStickyMessage } from '~/database';
import { invalidateStickyCache, updateCachedLastMessageId } from '~/core/providers/sticky';
import { Logger } from '~/utilities';

const STICKY_COLOR = { info: '#82D0F4', warning: '#FDC220' } as const;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Sticky,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage sticky messages for channels.')
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Create or update a sticky message for a channel.')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Channel to attach the sticky to').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((o) => o.setName('message').setDescription('Sticky message content').setRequired(true).setMaxLength(1000))
        .addStringOption((o) =>
          o.setName('explanation').setDescription('Extended info shown in DM when a user reacts ❓').setRequired(true).setMaxLength(2000)
        )
        .addIntegerOption((o) =>
          o.setName('interval').setDescription('Messages between reposts (default: 5)').setMinValue(1).setMaxValue(500).setRequired(false)
        )
        .addStringOption((o) =>
          o
            .setName('level')
            .setDescription('Embed style (default: info)')
            .setRequired(false)
            .addChoices({ name: 'Info', value: 'info' }, { name: 'Warning', value: 'warning' })
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove the sticky message from a channel.')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Channel to remove the sticky from').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription('List all active sticky messages.')),

  async executeCommand(command, client, interaction) {
    const sub = interaction.options.getSubcommand(true);
    const logger = Logger.getInstance(AppFeature.Sticky);

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const message = interaction.options.getString('message', true);
      const explanation = interaction.options.getString('explanation', true);
      const interval = interaction.options.getInteger('interval') ?? 5;
      const level = (interaction.options.getString('level') ?? 'info') as 'info' | 'warning';

      const sticky = await upsertStickyMessage({ channelId: channel.id, message, level, interval, extendedExplanation: explanation });
      invalidateStickyCache();

      // Remove previous sticky post if exists
      if (sticky.lastMessageId) {
        await channel.messages.delete(sticky.lastMessageId).catch(() => null);
      }

      // Post initial sticky right away
      const embed = new EmbedBuilder()
        .setColor(STICKY_COLOR[level])
        .setDescription(message)
        .setFooter({ text: 'React with ❓ for more information' });

      let posted;
      try {
        posted = await channel.send({ embeds: [embed] });
        await posted.react('❓');
      } catch (err) {
        logger.error(Object(err), 'Failed to post initial sticky.');
        await interaction.reply({ content: `Sticky saved but failed to post in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await updateCachedLastMessageId(channel.id, posted.id);

      await interaction.reply({
        content: `Sticky set for <#${channel.id}> — reposts every **${interval}** messages.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const existing = await getStickyByChannelId(channel.id);
      if (!existing) {
        await interaction.reply({ content: `No sticky message found for <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (existing.lastMessageId) {
        await channel.messages.delete(existing.lastMessageId).catch(() => null);
      }

      await deleteStickyByChannelId(channel.id);
      invalidateStickyCache();

      await interaction.reply({ content: `Sticky removed from <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'list') {
      const all = await listStickyMessages();
      if (all.length === 0) {
        await interaction.reply({ content: 'No sticky messages configured.', flags: MessageFlags.Ephemeral });
        return;
      }

      const lines = all.map((s) => `<#${s.channelId}> — every **${s.interval}** msgs — \`${s.level}\``);
      await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
