import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, type User } from 'discord.js';

import { BaseEmbed } from '~/core/components/BaseEmbed';
import type { Modmail } from '~/database';
import { ModmailCategory, ModmailStatus } from '~/database';
import { baseLocale } from '~/core/locales';
import { discordTimestamp } from '~/utilities';

export const CATEGORY_COLORS: Record<ModmailCategory, `#${string}`> = {
  [ModmailCategory.Partnerships]: '#5865F2',
  [ModmailCategory.Other]: '#99AAB5',
  [ModmailCategory.Report]: '#ED4245',
  [ModmailCategory.InformationRequest]: '#57F287',
  [ModmailCategory.VoltMembership]: '#9B59B6',
  [ModmailCategory.ModComplaint]: '#FEE75C',
  [ModmailCategory.VerificationFollowUp]: '#502379',
};

export const CATEGORY_LABELS: Record<ModmailCategory, string> = {
  [ModmailCategory.Partnerships]: '🤝 Partnerships',
  [ModmailCategory.Other]: '📋 Other',
  [ModmailCategory.Report]: '🚨 Report',
  [ModmailCategory.InformationRequest]: 'ℹ️ Information Request',
  [ModmailCategory.VoltMembership]: '⚡ Volt Membership',
  [ModmailCategory.ModComplaint]: '⚠️ Mod Complaint',
  [ModmailCategory.VerificationFollowUp]: '🔍 Verification Follow-up',
};

const STATUS_LABELS: Record<ModmailStatus, string> = {
  [ModmailStatus.Open]: '🟢 Open',
  [ModmailStatus.Closed]: '🔴 Closed',
  [ModmailStatus.StalePending]: '🟡 Stale — pending closure',
};

export class ModmailOpenThreadEmbed extends BaseEmbed<{ modmail: Modmail; user: User }> {
  constructor(params: { modmail: Modmail; user: User }) {
    super({ ...params, color: CATEGORY_COLORS[params.modmail.category as ModmailCategory], locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { modmail, user } = this.required;

    return new EmbedBuilder()
      .setTitle(`📬 New Modmail — #${modmail.id}`)
      .setDescription(`**${CATEGORY_LABELS[modmail.category as ModmailCategory]}**`)
      .addFields(
        { name: 'User', value: `<@${user.id}> — ${user.username}`, inline: true },
        { name: 'User ID', value: user.id, inline: true },
        { name: '​', value: '​', inline: true },
        { name: 'Reason', value: modmail.reason },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Opened', value: `${discordTimestamp(modmail.createdAt, 'F')}`, inline: true }
      )
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: 'Reply via /modmail message · /modmail attach · /modmail close' });
  }
}

export class UserDmGuideEmbed extends BaseEmbed<{ modmail: Modmail }> {
  constructor(params: { modmail: Modmail }) {
    super({ ...params, color: CATEGORY_COLORS[params.modmail.category as ModmailCategory], locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { modmail } = this.required;

    return new EmbedBuilder()
      .setTitle(`📬 Modmail #${modmail.id} Opened`)
      .setDescription(
        'Your modmail has been received. The moderation team will review and respond shortly.\n\n' +
          '**How to communicate:**\n' +
          '`/modmail message` — Send a text message to the moderators\n' +
          '`/modmail attach` — Attach an image or file (use this command separately for each file)\n' +
          '`/modmail close` — Close this modmail\n\n' +
          '⚠️ All communication must happen via these commands in DMs. Do not attempt to contact moderators directly about this modmail.'
      )
      .addFields(
        { name: 'Category', value: CATEGORY_LABELS[modmail.category as ModmailCategory], inline: true },
        { name: 'Modmail ID', value: `#${modmail.id}`, inline: true },
        { name: 'Reason', value: modmail.reason }
      )
      .setFooter({ text: 'Replies will arrive here in your DMs.' });
  }
}

export class VerificationFollowUpUserDmEmbed extends BaseEmbed<{ modmail: Modmail }> {
  constructor(params: { modmail: Modmail }) {
    super({ ...params, color: CATEGORY_COLORS[ModmailCategory.VerificationFollowUp], locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { modmail } = this.required;

    return new EmbedBuilder()
      .setTitle(`📬 Modmail #${modmail.id} — Verification Question`)
      .setDescription(
        'The moderation team has opened a conversation about your server verification application.\n\n' +
          '**How to respond:**\n' +
          '`/modmail message` — Send a message to the moderators\n' +
          '`/modmail attach` — Attach an image or file\n' +
          '`/modmail close` — Close this conversation\n\n' +
          '⚠️ All communication must happen via these commands. Do not contact moderators directly about your application.'
      )
      .setFooter({ text: 'After this conversation closes, the team will make a final decision on your application.' });
  }
}

type ModmailClosedEmbedParams = { variant: 'user' | 'mod'; actor: User } | { variant: 'dm' };

/** Collapses the 3 former ModmailClosedBy{User,Mod}/Dm embeds — same shape, differ by title/description/actor. */
export class ModmailClosedEmbed extends BaseEmbed<ModmailClosedEmbedParams> {
  constructor(params: ModmailClosedEmbedParams) {
    super({ ...params, color: Colors.Red, locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const params = this.required;

    if (params.variant === 'user') {
      return new EmbedBuilder().setTitle('🔒 Modmail Closed').setDescription(`Closed by the user <@${params.actor.id}>.`);
    }
    if (params.variant === 'mod') {
      return new EmbedBuilder()
        .setTitle('🔒 Modmail Closed by Moderator')
        .setDescription(`Closed by <@${params.actor.id}> — ${params.actor.username}.`);
    }

    return new EmbedBuilder()
      .setTitle('🔒 Your Modmail Was Closed')
      .setDescription('A moderator has closed your modmail. If you need further assistance, open a new one with `/modmail open`.');
  }
}

export class ModmailShowEmbed extends BaseEmbed<{ modmail: Modmail; user: User | null }> {
  constructor(params: { modmail: Modmail; user: User | null }) {
    super({ ...params, color: CATEGORY_COLORS[params.modmail.category as ModmailCategory], locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { modmail, user } = this.required;

    const embed = new EmbedBuilder()
      .setTitle(`Modmail #${modmail.id}`)
      .addFields(
        { name: 'Status', value: STATUS_LABELS[modmail.status as ModmailStatus], inline: true },
        { name: 'Category', value: CATEGORY_LABELS[modmail.category as ModmailCategory], inline: true },
        { name: '​', value: '​', inline: true },
        { name: 'User', value: user ? `<@${user.id}> — ${user.username}` : `ID: ${modmail.userId ?? '[deleted]'}`, inline: true },
        { name: 'User ID', value: modmail.userId ?? '[deleted]', inline: true },
        { name: '​', value: '​', inline: true },
        { name: 'Thread', value: `<#${modmail.threadId}>`, inline: true },
        { name: 'Opened', value: `${discordTimestamp(modmail.createdAt, 'F')}`, inline: true },
        { name: '​', value: '​', inline: true },
        { name: 'Reason', value: modmail.reason }
      );

    if (modmail.closedAt) {
      embed.addFields({ name: 'Closed', value: `${discordTimestamp(modmail.closedAt, 'F')}`, inline: true });
    }
    if (modmail.lastActivityAt) {
      embed.addFields({ name: 'Last Activity', value: `${discordTimestamp(modmail.lastActivityAt, 'R')}`, inline: true });
    }

    return embed;
  }
}

export class ModmailSummaryEmbed extends BaseEmbed<{ summary: string; modmailId: number }> {
  constructor(params: { summary: string; modmailId: number }) {
    super({ ...params, color: Colors.Blurple, locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { summary, modmailId } = this.required;

    return new EmbedBuilder()
      .setTitle(`📋 Modmail #${modmailId} — Conversation Summary`)
      .setDescription(summary)
      .setFooter({ text: 'AI-generated summary — may not be fully accurate.' });
  }
}

export class ModmailChannelEmbed extends BaseEmbed<{ modmail: Modmail; user: User | null }> {
  constructor(params: { modmail: Modmail; user: User | null }) {
    const isClosed = params.modmail.status === ModmailStatus.Closed;
    super({ ...params, color: isClosed ? Colors.Red : CATEGORY_COLORS[params.modmail.category as ModmailCategory], locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { modmail, user } = this.required;

    const embed = new EmbedBuilder()
      .setTitle(`📬 Modmail #${modmail.id}`)
      .setDescription(`**${CATEGORY_LABELS[modmail.category as ModmailCategory]}**`)
      .addFields(
        { name: 'User', value: user ? `<@${user.id}> — ${user.username}` : `<@${modmail.userId}>`, inline: true },
        { name: 'Status', value: STATUS_LABELS[modmail.status as ModmailStatus], inline: true },
        { name: '​', value: '​', inline: true },
        { name: 'Reason', value: modmail.reason },
        { name: 'Opened', value: `${discordTimestamp(modmail.createdAt, 'R')}`, inline: true }
      );

    if (user) {
      embed.setThumbnail(user.displayAvatarURL());
    }

    if (modmail.closedAt) {
      embed.addFields({ name: 'Closed', value: `${discordTimestamp(modmail.closedAt, 'R')}`, inline: true });
    }

    return embed;
  }
}

export class ModmailThreadTutorialEmbed extends BaseEmbed<{ modmail: Modmail }> {
  constructor(params: { modmail: Modmail }) {
    super({ ...params, color: Colors.Yellow, locale: baseLocale });
  }

  protected build(): EmbedBuilder {
    const { modmail } = this.required;

    return new EmbedBuilder()
      .setTitle('📖 How to use Modmail')
      .setDescription(
        'This thread is your direct line to the moderation team.\n\n' +
          '**User commands (DMs or guild):**\n' +
          '`/modmail message` — Send a text message\n' +
          '`/modmail attach` — Attach a file or image\n' +
          '`/modmail close` — Close this modmail\n\n' +
          '**Moderator commands (use from within this thread):**\n' +
          '`/modmail message` — Reply to the user\n' +
          '`/modmail attach` — Send an attachment to the user\n' +
          '`/modmail close` — Close this modmail'
      )
      .setFooter({ text: `Modmail #${modmail.id} · ${CATEGORY_LABELS[modmail.category as ModmailCategory]}` });
  }
}

export const buildKeepOpenRow = (modmailId: number): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`modmail_keep_open:${modmailId}`).setLabel('Keep Open').setEmoji('✋').setStyle(ButtonStyle.Primary)
  );

export const buildKeepOpenDisabledRow = (modmailId: number): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`modmail_keep_open_done:${modmailId}`).setLabel('Kept Open ✅').setStyle(ButtonStyle.Success).setDisabled(true)
  );
