import { EmbedBuilder, MessageReaction, PartialMessageReaction, PartialUser, TextChannel, User } from 'discord.js';

import { Client } from '~/core/models';
import { getStickyByLastMessageId } from '~/database';

const STICKY_COLOR = { info: '#82D0F4', warning: '#FDC220' } as const;

/** DMs the channel's extended sticky explanation when a user reacts with ❓ on the sticky message. */
export const sendStickyInfo = async (
  _client: Client,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> => {
  if (user.bot) return;
  if (reaction.emoji.name !== '❓') return;

  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

  const sticky = await getStickyByLastMessageId(reaction.message.id);
  if (!sticky) return;

  const channel = reaction.message.channel as TextChannel;
  const topic = 'topic' in channel && channel.topic ? channel.topic : null;

  const parts: string[] = [];
  if (topic) {
    parts.push(
      topic
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')
    );
  }
  parts.push(sticky.extendedExplanation);

  const embed = new EmbedBuilder()
    .setColor(STICKY_COLOR[sticky.level as keyof typeof STICKY_COLOR] ?? STICKY_COLOR.info)
    .setTitle('Channel Information')
    .setDescription(parts.join('\n\n'))
    .setFooter({ text: `#${channel.name}` });

  await user.send({ embeds: [embed] }).catch(() => null);
};
