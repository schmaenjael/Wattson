import { ApplicationCommandType, ChannelType, Colors, EmbedBuilder, MessageFlags, SlashCommandBuilder, type GuildTextBasedChannel } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';
import { AuditEventType, findLockedChannel, listLockedChannels, lockChannel, recordAuditEvent, unlockChannel, upsertUser } from '~/database';

// Discord API hard limit: max slowmode is 21600s (6h).
const SLOWMODE_MAX = 21600;

const isSlowmodeChannel = (ch: GuildTextBasedChannel): boolean => ch.type === ChannelType.GuildText;

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.Lockdown,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Apply or remove a slowmode lockdown on channel(s).')
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('Set a slowmode on channel(s).')
        .addIntegerOption((o) =>
          o.setName('slowmode').setDescription('Slowmode delay in seconds (1–21600)').setRequired(true).setMinValue(1).setMaxValue(SLOWMODE_MAX)
        )
        .addStringOption((o) => o.setName('reason').setDescription('Reason for the lockdown (max 512 chars)').setRequired(true).setMaxLength(512))
        .addStringOption((o) =>
          o
            .setName('scope')
            .setDescription('Which channels to apply slowmode to')
            .setRequired(false)
            .addChoices({ name: 'Current channel', value: 'channel' }, { name: 'Entire server', value: 'server' })
        )
    )
    .addSubcommand((s) =>
      s
        .setName('end')
        .setDescription('Restore previous slowmode on locked channel(s).')
        .addStringOption((o) =>
          o
            .setName('scope')
            .setDescription('Which channels to restore')
            .setRequired(false)
            .addChoices({ name: 'Current channel', value: 'channel' }, { name: 'Entire server', value: 'server' })
        )
    ),

  async executeCommand(_command, client, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in the server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const logger = Logger.getInstance(AppFeature.Lockdown);
    const sub = interaction.options.getSubcommand(true) as 'start' | 'end';
    const scope = (interaction.options.getString('scope') ?? 'channel') as 'channel' | 'server';

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ── start ─────────────────────────────────────────────────────────────────
    if (sub === 'start') {
      const slowmode = interaction.options.getInteger('slowmode', true);
      const reason = interaction.options.getString('reason', true);

      await upsertUser({ id: interaction.user.id, username: interaction.user.username });

      let targets: GuildTextBasedChannel[];

      if (scope === 'channel') {
        if (!interaction.channel || !isSlowmodeChannel(interaction.channel as GuildTextBasedChannel)) {
          await interaction.editReply({ content: 'This channel type does not support slowmode.' });
          return;
        }
        targets = [interaction.channel as GuildTextBasedChannel];
      } else {
        await interaction.guild.channels.fetch();
        targets = [...interaction.guild.channels.cache.values()].filter(
          (ch): ch is GuildTextBasedChannel => !!ch && isSlowmodeChannel(ch as GuildTextBasedChannel)
        );
      }

      const lockedIds: string[] = [];

      for (const channel of targets) {
        try {
          const existing = await findLockedChannel(channel.id);
          if (existing) continue;

          const previousSlowmode = channel.rateLimitPerUser ?? 0;

          await channel.setRateLimitPerUser(slowmode);

          await lockChannel({ channelId: channel.id, moderatorId: interaction.user.id, reason, previousSlowmode });

          await (
            channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(Colors.Red)
                  .setTitle('🐌 Slowmode Enabled')
                  .setDescription(`Slowmode set to **${slowmode}s** by a moderator.\n**Reason:** ${reason}`)
                  .setTimestamp(),
              ],
            }) as Promise<unknown>
          ).catch(() => null);

          lockedIds.push(channel.id);
        } catch (err) {
          logger.warn({ channelId: channel.id, err: Object(err) }, 'Failed to set slowmode on channel — skipping.');
        }
      }

      await recordAuditEvent({
        eventType: AuditEventType.ChannelLocked,
        actorUserId: interaction.user.id,
        payload: { channelIds: lockedIds, slowmode, reason, scope },
      });

      await logger.log({
        level: 'info',
        message: `Slowmode lockdown started by ${interaction.user.id}`,
        data: { channelIds: lockedIds, slowmode, reason, scope },
        target: 'surveillance',
        internalEmbed: new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle('🐌 Slowmode Lockdown Started')
          .addFields(
            { name: 'Moderator', value: `<@${interaction.user.id}> — ${interaction.user.username}`, inline: true },
            { name: 'Scope', value: scope, inline: true },
            { name: 'Slowmode', value: `${slowmode}s`, inline: true },
            { name: 'Channels', value: lockedIds.length > 0 ? lockedIds.map((id) => `<#${id}>`).join(' ') : 'None', inline: false },
            { name: 'Reason', value: reason }
          )
          .setTimestamp(),
      });

      if (lockedIds.length === 0) {
        await interaction.editReply({ content: 'No channels were updated (all targets already under lockdown).' });
        return;
      }

      await interaction.editReply({ content: `🐌 Slowmode set to ${slowmode}s on ${lockedIds.length} channel(s).` });
      return;
    }

    // ── end ───────────────────────────────────────────────────────────────────
    if (sub === 'end') {
      let records;

      if (scope === 'channel') {
        if (!interaction.channelId) {
          await interaction.editReply({ content: 'Could not determine the current channel.' });
          return;
        }
        const record = await findLockedChannel(interaction.channelId);
        if (!record) {
          await interaction.editReply({ content: 'This channel is not currently under lockdown.' });
          return;
        }
        records = [record];
      } else {
        records = await listLockedChannels();
        if (records.length === 0) {
          await interaction.editReply({ content: 'No channels are currently under lockdown.' });
          return;
        }
      }

      const unlockedIds: string[] = [];

      for (const record of records) {
        try {
          const channel = await client.channels.fetch(record.channelId).catch(() => null);
          if (channel?.isSendable() && isSlowmodeChannel(channel as GuildTextBasedChannel)) {
            await (channel as GuildTextBasedChannel).setRateLimitPerUser(record.previousSlowmode);

            await (
              channel.send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(Colors.Green)
                    .setTitle('✅ Slowmode Restored')
                    .setDescription(`Slowmode restored to **${record.previousSlowmode}s**.`)
                    .setTimestamp(),
                ],
              }) as Promise<unknown>
            ).catch(() => null);
          }

          await unlockChannel(record.channelId);
          unlockedIds.push(record.channelId);
        } catch (err) {
          logger.warn({ channelId: record.channelId, err: Object(err) }, 'Failed to restore slowmode on channel — skipping.');
        }
      }

      await recordAuditEvent({
        eventType: AuditEventType.ChannelUnlocked,
        actorUserId: interaction.user.id,
        payload: { channelIds: unlockedIds, scope },
      });

      await logger.log({
        level: 'info',
        message: `Slowmode lockdown ended by ${interaction.user.id}`,
        data: { channelIds: unlockedIds, scope },
        target: 'surveillance',
        internalEmbed: new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Slowmode Lockdown Ended')
          .addFields(
            { name: 'Moderator', value: `<@${interaction.user.id}> — ${interaction.user.username}`, inline: true },
            { name: 'Scope', value: scope, inline: true },
            { name: 'Channels restored', value: unlockedIds.length > 0 ? unlockedIds.map((id) => `<#${id}>`).join(' ') : 'None', inline: false }
          )
          .setTimestamp(),
      });

      await interaction.editReply({ content: `✅ Slowmode restored on ${unlockedIds.length} channel(s).` });
      return;
    }
  },
});
