import { AttachmentBuilder, EmbedBuilder, Snowflake } from 'discord.js';

import { BaseEmbed } from '~/core/components/BaseEmbed';
import { assets } from '~/settings';

/**
 * Placeholder approval embed used by the verification flow. Phase 3.2 will fully
 * wire this up with the Flow DSL once questions/answers have a typed shape.
 */
export interface VerificationAnswer {
  key: string;
  answer: string;
}

interface ApprovalEmbedParams {
  username: string;
  userId: Snowflake;
  discordJoinDate: number;
  accountCreationDate: number;
  answers: VerificationAnswer[];
}

export class ApprovalEmbed extends BaseEmbed<ApprovalEmbedParams> {
  public attachments: AttachmentBuilder[] = [assets.volt['256x256'].file];

  protected build(): EmbedBuilder {
    const { username, userId, discordJoinDate, accountCreationDate, answers } = this.required;

    const embed = new EmbedBuilder()
      .setTitle(`Verification request — ${username}`)
      .addFields(
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'Account created', value: `<t:${Math.floor(accountCreationDate / 1000)}:R>`, inline: true },
        { name: 'Joined server', value: `<t:${Math.floor(discordJoinDate / 1000)}:R>`, inline: true }
      );

    for (const { key, answer } of answers) {
      embed.addFields({ name: key, value: answer || '—' });
    }

    return embed;
  }
}
