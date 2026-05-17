import { ApplicationCommandType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, ProcessExitCode } from '~/settings';
import { getSettings } from '~/database';

const CUSTOM_EMOJI_RE = /^<a?:(\w+):(\d+)>$/;
const MAX_REACTIONS = 20;

function parseEmojis(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => {
      const match = t.match(CUSTOM_EMOJI_RE);
      return match ? `${match[1]}:${match[2]}` : t;
    });
}

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.React,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Community, Permission.Member, Permission.Moderation, Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('react')
    .setDescription('Add reactions to a message in this channel.')
    .addStringOption((o) => o.setName('message_id').setDescription('ID of the message to react to').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('emojis')
        .setDescription('Emojis to add (space or comma separated). Falls back to configured defaults.')
        .setRequired(false)
        .setMaxLength(512)
    ),

  async executeCommand(_command, _client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const messageId = interaction.options.getString('message_id', true).trim();
    const emojiRaw = interaction.options.getString('emojis', false);

    let emojis: string[];
    if (emojiRaw) {
      emojis = parseEmojis(emojiRaw);
    } else {
      const settings = await getSettings();
      emojis = parseEmojis(settings.reactDefaultEmojis);
    }

    if (emojis.length === 0) {
      await interaction.reply({ content: 'No emojis to add. Set defaults with `/config string`.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (emojis.length > MAX_REACTIONS) {
      await interaction.reply({
        content: `Too many emojis (${emojis.length}). Discord limits messages to ${MAX_REACTIONS} unique reactions.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.editReply({ content: 'Message not found in this channel.' });
      return;
    }

    const failed: string[] = [];
    for (const emoji of emojis) {
      await message.react(emoji).catch(() => {
        failed.push(emoji);
      });
    }

    const added = emojis.length - failed.length;
    const lines = [`✅ Added ${added}/${emojis.length} reaction(s).`];
    if (failed.length > 0) {
      lines.push(`Failed: ${failed.join(' ')}`);
    }
    await interaction.editReply({ content: lines.join('\n') });
  },
});
