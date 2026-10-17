import { EmbedBuilder, MessageReaction, PartialMessageReaction, PartialUser, TextChannel, User } from 'discord.js';

import { Client } from '~/core/models';
import { getStickyByLastMessageId } from '~/database';
import { STICKY_COLOR } from './constants';
import { getConfig } from '~/config';
import { AppFeature } from '~/settings';
import { softFail } from '~/utilities';

/** DMs the channel's extended sticky explanation when a user reacts with ❓ on the sticky message. */
export const sendStickyInfo = async (
  _client: Client,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> => {
  if (!getConfig().config.features.sticky) return;
  if (user.bot) return;
  if (reaction.emoji.name !== '❓') return;

  if (reaction.partial) await reaction.fetch().catch(softFail(AppFeature.Sticky, 'STICKY_REACTION_FETCH'));
  if (reaction.message.partial) await reaction.message.fetch().catch(softFail(AppFeature.Sticky, 'STICKY_MESSAGE_FETCH'));

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

  await user.send({ embeds: [embed] }).catch(softFail(AppFeature.Sticky, 'STICKY_USER_SEND'));
};
