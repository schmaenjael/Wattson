import { EmbedBuilder, Events, TextChannel } from 'discord.js';

import { AppFeature } from '~/settings';
import { getStickyByLastMessageId } from '~/database';
import { Event } from '~/core/models';

const STICKY_COLOR = { info: '#82D0F4', warning: '#FDC220' } as const;

export default new Event({
  type: Events.MessageReactionAdd,
  feature: AppFeature.Sticky,
  middleware: [],
  async executeCommand(event, client, reaction, user) {
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
  },
});
