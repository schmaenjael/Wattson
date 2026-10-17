import { EmbedBuilder, Message, MessageReaction, PartialMessageReaction, TextChannel } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
import type { StarboardEmojiTier } from '~/database';
import {
  AuditEventType,
  ExternalPlatform,
  ExternalPostStatus,
  findStarboardEntry,
  getSettings,
  hasExternalPostsForMessage,
  insertExternalPost,
  markExternalPostStatus,
  recordAuditEvent,
  upsertStarboardEntry,
  upsertUser,
  type StarboardEntry,
} from '~/database';
import { Client } from '~/core/models';
import { logSoftFailure, Logger, softFail } from '~/utilities';
import { getAllPosters } from '~/core/providers/external';

const STAR_REACTION = '⭐';

const resolveStarEmoji = (count: number, tiers: StarboardEmojiTier[]): string => {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  let emoji = STAR_REACTION;
  for (const tier of sorted) {
    if (count >= tier.threshold) {
      emoji = tier.emoji;
    }
  }
  return emoji;
};

export const handleReactionAdd = async (client: Client, reaction: MessageReaction | PartialMessageReaction): Promise<void> => {
  if (reaction.emoji.name !== STAR_REACTION) return;

  const full: MessageReaction | null = reaction.partial
    ? await reaction.fetch().catch(softFail(AppFeature.System, 'STARBOARD_REACTION_FETCH'))
    : (reaction as MessageReaction);
  if (!full) return;

  const message = full.message.partial ? await full.message.fetch().catch(softFail(AppFeature.System, 'STARBOARD_MESSAGE_FETCH')) : full.message;
  if (!message || !message.inGuild()) return;
  if (message.author?.bot) return;

  const settings = await getSettings();
  if (!settings.featureStarboardEnabled || !settings.starboardChannelId) return;

  const starReaction = message.reactions.cache.get(STAR_REACTION);
  const count = starReaction?.count ?? 0;

  if (count < settings.starboardThreshold) return;

  // audit_log.target_user_id is FK-constrained to users; a purely popular poster may never have been seen before.
  await upsertUser({ id: message.author!.id, username: message.author!.username });

  const logger = Logger.getInstance(AppFeature.Surveillance);
  const existing = await findStarboardEntry(message.id);

  const starboardChannel = (await client.channels
    .fetch(settings.starboardChannelId)
    .catch(softFail(AppFeature.System, 'STARBOARD_CHANNEL_FETCH', { starboardChannelId: settings.starboardChannelId }))) as TextChannel | null;
  if (!starboardChannel) {
    logger.warn(`Starboard channel ${settings.starboardChannelId} not accessible.`);
    return;
  }

  const emoji = resolveStarEmoji(count, settings.starboardEmojiTiers);
  const content = `${emoji} **${count}** ${message.url}`;
  const embed = renderStarboardEmbed(message);

  if (existing) {
    try {
      const starboardMessage = await starboardChannel.messages.fetch(existing.starboardMessageId);
      await starboardMessage.edit({ content, embeds: [embed] });
      await upsertStarboardEntry({
        sourceMessageId: message.id,
        starboardMessageId: existing.starboardMessageId,
        authorId: message.author!.id,
        channelId: message.channelId,
        starCount: count,
      });
    } catch (err) {
      logSoftFailure(AppFeature.System, 'STARBOARD_ENTRY_UPDATE', { messageId: message.id, channelId: message.channelId, starCount: count }, err);
    }

    if (count >= settings.starboardExternalThreshold && !(await hasExternalPostsForMessage(message.id))) {
      const entry = await upsertStarboardEntry({
        sourceMessageId: message.id,
        starboardMessageId: existing.starboardMessageId,
        authorId: message.author!.id,
        channelId: message.channelId,
        starCount: count,
      });
      await dispatchExternalPosters(entry, message);
    }
    return;
  }

  const starboardMessage = await starboardChannel.send({ content, embeds: [embed] });
  const entry = await upsertStarboardEntry({
    sourceMessageId: message.id,
    starboardMessageId: starboardMessage.id,
    authorId: message.author!.id,
    channelId: message.channelId,
    starCount: count,
  });

  await recordAuditEvent({
    eventType: AuditEventType.StarboardEntryCreated,
    targetUserId: message.author!.id,
    payload: { sourceMessageId: message.id, count },
  });

  if (count >= settings.starboardExternalThreshold) {
    await dispatchExternalPosters(entry, message);
  }
};

const renderStarboardEmbed = (message: Message): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor(appFeatureMap[AppFeature.System].color)
    .setAuthor({ name: message.author!.username, iconURL: message.author!.displayAvatarURL() })
    .setDescription(message.content || null)
    .setTimestamp(message.createdAt);

  const firstImage = [...message.attachments.values()].find((a) => a.contentType?.startsWith('image/'));
  if (firstImage) {
    embed.setImage(firstImage.url);
  }

  return embed;
};

const dispatchExternalPosters = async (entry: StarboardEntry, message: Message): Promise<void> => {
  const posters = getAllPosters();

  for (const poster of posters) {
    const row = await insertExternalPost({
      sourceMessageId: entry.sourceMessageId,
      platform: poster.platform as ExternalPlatform,
      remoteId: null,
      error: null,
      postedAt: null,
    });

    try {
      const { remoteId } = await poster.post({
        entry,
        content: message.content ?? '',
        authorName: message.author!.username,
        sourceUrl: message.url,
        mediaUrls: [...message.attachments.values()].map((a) => a.url),
      });
      await markExternalPostStatus(row.id, ExternalPostStatus.Posted, { remoteId, postedAt: new Date() });
    } catch (err) {
      logSoftFailure(AppFeature.System, 'STARBOARD_EXTERNAL_POST', { platform: poster.platform, externalPostId: row.id }, err, 'error');
      await markExternalPostStatus(row.id, ExternalPostStatus.Failed, { error: String((err as Error).message ?? err) });
    }
  }

  await recordAuditEvent({
    eventType: AuditEventType.ExternalPostAttempted,
    targetUserId: entry.authorId,
    payload: { sourceMessageId: entry.sourceMessageId, platforms: posters.map((p) => p.platform) },
  });
};
