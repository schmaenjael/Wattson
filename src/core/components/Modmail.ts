import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, type User } from 'discord.js';

import type { Modmail } from '~/database';
import { ModmailCategory, ModmailStatus } from '~/database';

export const CATEGORY_COLORS: Record<ModmailCategory, `#${string}`> = {
  [ModmailCategory.Partnerships]: '#5865F2',
  [ModmailCategory.Other]: '#99AAB5',
  [ModmailCategory.Report]: '#ED4245',
  [ModmailCategory.InformationRequest]: '#57F287',
  [ModmailCategory.VoltMembership]: '#9B59B6',
  [ModmailCategory.ModComplaint]: '#FEE75C',
};

export const CATEGORY_LABELS: Record<ModmailCategory, string> = {
  [ModmailCategory.Partnerships]: '🤝 Partnerships',
  [ModmailCategory.Other]: '📋 Other',
  [ModmailCategory.Report]: '🚨 Report',
  [ModmailCategory.InformationRequest]: 'ℹ️ Information Request',
  [ModmailCategory.VoltMembership]: '⚡ Volt Membership',
  [ModmailCategory.ModComplaint]: '⚠️ Mod Complaint',
};

const STATUS_LABELS: Record<ModmailStatus, string> = {
  [ModmailStatus.Open]: '🟢 Open',
  [ModmailStatus.Closed]: '🔴 Closed',
  [ModmailStatus.StalePending]: '🟡 Stale — pending closure',
};

export const buildModmailOpenThreadEmbed = (modmail: Modmail, user: User): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(CATEGORY_COLORS[modmail.category as ModmailCategory])
    .setTitle(`📬 New Modmail — #${modmail.id}`)
    .setDescription(`**${CATEGORY_LABELS[modmail.category as ModmailCategory]}**`)
    .addFields(
      { name: 'User', value: `<@${user.id}> — ${user.username}`, inline: true },
      { name: 'User ID', value: user.id, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Reason', value: modmail.reason },
      { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Opened', value: `<t:${Math.floor(modmail.createdAt.getTime() / 1000)}:F>`, inline: true }
    )
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: 'Reply via /modmail message · /modmail attach · /modmail close' })
    .setTimestamp();

export const buildUserDmGuideEmbed = (modmail: Modmail): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(CATEGORY_COLORS[modmail.category as ModmailCategory])
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
    .setFooter({ text: 'Replies will arrive here in your DMs.' })
    .setTimestamp();

export const buildModmailClosedByUserEmbed = (user: User): EmbedBuilder =>
  new EmbedBuilder().setColor(Colors.Red).setTitle('🔒 Modmail Closed').setDescription(`Closed by the user <@${user.id}>.`).setTimestamp();

export const buildModmailClosedByModEmbed = (mod: User): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('🔒 Modmail Closed by Moderator')
    .setDescription(`Closed by <@${mod.id}> — ${mod.username}.`)
    .setTimestamp();

export const buildModmailClosedDmEmbed = (): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('🔒 Your Modmail Was Closed')
    .setDescription('A moderator has closed your modmail. If you need further assistance, open a new one with `/modmail open`.')
    .setTimestamp();

export const buildModmailShowEmbed = (modmail: Modmail, user: User | null): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor(CATEGORY_COLORS[modmail.category as ModmailCategory])
    .setTitle(`Modmail #${modmail.id}`)
    .addFields(
      { name: 'Status', value: STATUS_LABELS[modmail.status as ModmailStatus], inline: true },
      { name: 'Category', value: CATEGORY_LABELS[modmail.category as ModmailCategory], inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'User', value: user ? `<@${user.id}> — ${user.username}` : `ID: ${modmail.userId}`, inline: true },
      { name: 'User ID', value: modmail.userId, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Thread', value: `<#${modmail.threadId}>`, inline: true },
      { name: 'Opened', value: `<t:${Math.floor(modmail.createdAt.getTime() / 1000)}:F>`, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Reason', value: modmail.reason }
    );

  if (modmail.closedAt) {
    embed.addFields({ name: 'Closed', value: `<t:${Math.floor(modmail.closedAt.getTime() / 1000)}:F>`, inline: true });
  }
  if (modmail.lastActivityAt) {
    embed.addFields({ name: 'Last Activity', value: `<t:${Math.floor(modmail.lastActivityAt.getTime() / 1000)}:R>`, inline: true });
  }

  return embed.setTimestamp();
};

export const buildKeepOpenRow = (modmailId: number): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`modmail_keep_open:${modmailId}`).setLabel('Keep Open').setEmoji('✋').setStyle(ButtonStyle.Primary)
  );

export const buildKeepOpenDisabledRow = (modmailId: number): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`modmail_keep_open_done:${modmailId}`).setLabel('Kept Open ✅').setStyle(ButtonStyle.Success).setDisabled(true)
  );
