import { Events, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } from 'discord.js';

import { Event } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { Logger } from '~/utilities';

import { baseLocale, L } from '~/core/locales';

export default new Event({
  type: Events.GuildMemberAdd,
  feature: AppFeature.Welcome,
  middleware: [],
  async executeCommand(event, client, member) {
    const logger = Logger.getInstance(event.options.feature);

    const createdAt = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
    const joinedAt = `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>`;

    const welcomeEmbed = new EmbedBuilder()
      .setColor(appFeatureMap[event.options.feature].color)
      .setTitle(`**${L[baseLocale].UTIL.EVENT_WELCOME.EMBED_TITLE()}**`)
      .setThumbnail(member.user.displayAvatarURL({ size: 2048 }))
      .addFields(
        { name: '👤 User', value: `<@${member.id}>`, inline: true },
        { name: '👤 Username', value: `\`\`${member.user.tag}\`\``, inline: true },
        { name: '📆 Account Created', value: createdAt, inline: true },
        { name: '🔗 Join Date', value: joinedAt, inline: true }
      )
      .setFooter({ text: `ID: ${member.user.id}` })
      .setTimestamp();

    try {
      const dmChannel = await member.createDM();
      await dmChannel.send(`Welcome to **${member.guild.name}**! To get verified, please reply with "I agree".`);

      const filter = (response: any) => {
        return response.author.id === member.id;
      };

      const collected = await dmChannel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });

      const reply = collected.first()?.content.trim().toLowerCase();

      if (reply === 'i agree') {
        await dmChannel.send('Thank you! You are now verified. ✅');
        console.log(`User ${member.user.tag} verified successfully.`);

        const verifiedRole = member.guild.roles.cache.find((role) => role.name === 'Verified');
        if (verifiedRole) {
          await member.roles.add(verifiedRole);
        } else {
          console.warn('Verified role not found in the server.');
        }
      } else {
        await dmChannel.send('Incorrect response. Please contact a moderator.');
        console.log(`User ${member.user.tag} gave an incorrect verification response.`);
      }
    } catch (error: any) {
      if (error instanceof Map) {
        console.log(`User ${member.user.tag} did not respond to verification in time.`);
      } else {
        console.error(`Failed to verify ${member.user.tag}:`, error);
      }
    }

    try {
      const welcomeChannel = member.guild.channels.cache.find((ch) => ch.name === 'anarchiediscord-loooool');
      if (welcomeChannel && welcomeChannel.isTextBased()) {
        await welcomeChannel.send({ embeds: [welcomeEmbed] });
      } else {
        logger.error('No welcome channel found or channel is not text-based!');
      }
    } catch (error) {
      logger.error(Object(error), `Error while sending welcome message for ${member.user.username}`);
    }
  },
});
