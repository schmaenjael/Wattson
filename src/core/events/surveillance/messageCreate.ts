import { Colors, EmbedBuilder, Events, Message, TextChannel } from 'discord.js';

import { AuditEventType, getSettings, recordAuditEvent, upsertUser } from '~/database';
import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { getHarmDetector, type HarmCategory, type HarmDetectionResult } from '~/core/providers/harm';
import { getBlocklistChecker } from '~/core/providers/blocklist';
import { getProfanityChecker } from '~/core/providers/profanity';
import {
  getStickyForChannel,
  incrementStickyCounter,
  resetStickyCounter,
  updateCachedLastMessageId,
  type StickyMessage,
} from '~/core/providers/sticky';
import { enqueueMessage } from '~/core/scheduler/messageQueue';
import type { Client } from '~/core/models';

const MAX_EXCERPT = 512;

const CATEGORY_LABELS: Record<HarmCategory, string> = {
  racism: 'Racism',
  discrimination: 'Discrimination',
  sexism: 'Sexism',
  harassment: 'Harassment',
};

const CONFIDENCE_EMOJI: Record<string, string> = { low: '🟡', medium: '🟠', high: '🔴' };

const postHarmAlert = async (
  result: HarmDetectionResult,
  authorId: string,
  channelId: string,
  messageId: string,
  content: string,
  guild: NonNullable<TextChannel['guild']>,
  alertChannelId: string
): Promise<void> => {
  const alertChannel = (await guild.channels.fetch(alertChannelId).catch(() => null)) as TextChannel | null;
  if (!alertChannel) return;

  const categoryLines = result.detectedCategories.map((cat) => {
    const { confidence } = result.categories[cat];
    return `${CONFIDENCE_EMOJI[confidence] ?? '🟡'} **${CATEGORY_LABELS[cat]}** (${confidence} confidence)`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('⚠️ Harm Detected')
    .setDescription(`Message by <@${authorId}> in <#${channelId}>`)
    .addFields(
      { name: 'Categories', value: categoryLines.join('\n').slice(0, 1024) },
      { name: 'Excerpt', value: `\`\`\`\n${content.slice(0, 400)}\n\`\`\`` }
    )
    .setFooter({ text: `Message ID: ${messageId}` })
    .setTimestamp();

  await alertChannel.send({ embeds: [embed] }).catch(() => null);
};

const runLlmCheck = async (content: string, settings: Awaited<ReturnType<typeof getSettings>>): Promise<HarmDetectionResult | null> => {
  if (!settings.featureHarmDetectionEnabled) return null;
  const detector = getHarmDetector();
  if (!detector) return null;
  try {
    return await detector.detect(content);
  } catch {
    return null;
  }
};

const logToSurveillance = async (guild: NonNullable<TextChannel['guild']>, channelId: string | null | undefined, text: string): Promise<void> => {
  if (!channelId) return;
  const ch = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  await ch?.send({ content: text.slice(0, 2000) }).catch(() => null);
};

const STICKY_COLOR = { info: '#82D0F4', warning: '#FDC220' } as const;

const handleStickyRepost = async (sticky: StickyMessage, channel: TextChannel, logger: ReturnType<typeof Logger.getInstance>): Promise<void> => {
  if (sticky.lastMessageId) {
    await channel.messages.delete(sticky.lastMessageId).catch(() => null);
  }

  const embed = new EmbedBuilder()
    .setColor(STICKY_COLOR[sticky.level as keyof typeof STICKY_COLOR] ?? STICKY_COLOR.info)
    .setDescription(sticky.message)
    .setFooter({ text: 'React with ❓ for more information' });

  let posted;
  try {
    posted = await channel.send({ embeds: [embed] });
    await posted.react('❓');
  } catch (err) {
    logger.error(Object(err), 'Failed to repost sticky message.');
    return;
  }

  await updateCachedLastMessageId(sticky.channelId, posted.id);
};

const processMessage = async (client: Client, message: Message<true>): Promise<void> => {
  const settings = await getSettings();
  const logger = Logger.getInstance(AppFeature.Surveillance);

  // ── Step 0: Sticky counter ─────────────────────────────────────────────────
  const sticky = await getStickyForChannel(message.channelId);
  if (sticky) {
    const count = incrementStickyCounter(message.channelId);
    if (count >= sticky.interval) {
      resetStickyCounter(message.channelId);
      void handleStickyRepost(sticky, message.channel as TextChannel, logger);
    }
  }

  // ── Step 1: Link filter (O(1) Set lookup) ──────────────────────────────────
  if (settings.featureLinkFilterEnabled) {
    const checker = await getBlocklistChecker();
    if (checker) {
      const blocked = checker.findBlockedDomain(message.content);
      if (blocked) {
        await message.delete().catch(() => null);
        await upsertUser({ id: message.author.id, username: message.author.username });
        await recordAuditEvent({
          eventType: AuditEventType.LinkFilterTriggered,
          targetUserId: message.author.id,
          payload: { domain: blocked, messageId: message.id, channelId: message.channelId },
        });
        await logToSurveillance(
          message.guild,
          settings.surveillanceLogChannelId,
          `🚫 **link filter** on <@${message.author.id}> in <#${message.channelId}>\n> blocked domain: \`${blocked}\``
        );
        return;
      }
    }
  }

  // ── Step 2: Profanity filter (file-based regex, unified cache) ─────────────
  if (settings.featureBadWordsEnabled) {
    const checker = await getProfanityChecker();
    if (checker) {
      const match = checker.check(message.content);

      if (match) {
        // Severity 1 → always skip, no log, no LLM
        if (match.severity === 1) return;

        await upsertUser({ id: message.author.id, username: message.author.username });

        const isImmediate = match.severity >= settings.badWordDeleteThreshold;
        const excerpt = message.content.slice(0, MAX_EXCERPT);

        await recordAuditEvent({
          eventType: AuditEventType.AutomodTriggered,
          targetUserId: message.author.id,
          payload: {
            source: 'profanity',
            word: match.word,
            severity: match.severity,
            threshold: settings.badWordDeleteThreshold,
            immediate: isImmediate,
            messageId: message.id,
            channelId: message.channelId,
          },
        });

        if (isImmediate) {
          // Severity ≥ threshold → delete immediately, no LLM
          await message.delete().catch(() => null);
          logger.info({ word: match.word, severity: match.severity, userId: message.author.id }, 'Profanity: immediate delete.');
          await logToSurveillance(
            message.guild,
            settings.surveillanceLogChannelId,
            `🚫 **profanity** sev${match.severity} \`${match.word}\` — deleted · <@${message.author.id}> in <#${message.channelId}>\n\`\`\`\n${excerpt.slice(0, 400)}\n\`\`\``
          );
          return;
        }

        // Severity 2–(threshold-1) → ask LLM for context
        logger.debug({ word: match.word, severity: match.severity }, 'Profanity: LLM context check.');
        const result = await runLlmCheck(message.content, settings);

        if (result?.anyDetected) {
          await message.delete().catch(() => null);
          logger.info({ word: match.word, categories: result.detectedCategories }, 'Profanity: LLM confirmed harm, deleted.');
          await logToSurveillance(
            message.guild,
            settings.surveillanceLogChannelId,
            `🚫 **profanity+llm** sev${match.severity} \`${match.word}\` — LLM confirmed · <@${message.author.id}> in <#${message.channelId}>\n\`\`\`\n${excerpt.slice(0, 400)}\n\`\`\``
          );
          if (settings.harmAlertChannelId) {
            await postHarmAlert(
              result,
              message.author.id,
              message.channelId,
              message.id,
              message.content,
              message.guild,
              settings.harmAlertChannelId
            );
          }
        } else {
          logger.debug({ word: match.word }, 'Profanity: LLM cleared — flagged only.');
          await logToSurveillance(
            message.guild,
            settings.surveillanceLogChannelId,
            `📋 **profanity flagged** sev${match.severity} \`${match.word}\` — LLM cleared · <@${message.author.id}> in <#${message.channelId}>`
          );
        }

        return;
      }
    }
  }

  // ── Step 3: General LLM harm detection (no profanity match) ───────────────
  if (!settings.featureHarmDetectionEnabled) return;

  const detector = getHarmDetector();
  if (!detector) return;

  let result: HarmDetectionResult;
  try {
    result = await detector.detect(message.content);
  } catch (err) {
    logger.error(Object(err), 'Harm detection threw unexpectedly.');
    return;
  }

  if (!result.anyDetected) return;

  if (!settings.harmAlertChannelId) {
    logger.warn('Harm detected but harmAlertChannelId not configured — skipping alert.');
    return;
  }

  await postHarmAlert(result, message.author.id, message.channelId, message.id, message.content, message.guild, settings.harmAlertChannelId);
  await recordAuditEvent({
    eventType: AuditEventType.AutomodTriggered,
    targetUserId: message.author.id,
    payload: { source: 'harm_detection', detectedCategories: result.detectedCategories, messageId: message.id, channelId: message.channelId },
  });
};

export default new Event({
  type: Events.MessageCreate,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(event, client, message) {
    if (!message.inGuild()) return;
    if (message.author.bot || message.system) return;
    if (!message.content) return;

    const queued = enqueueMessage(() => processMessage(client, message));
    if (!queued) {
      Logger.getInstance(AppFeature.Surveillance).warn({ messageId: message.id }, 'Message queue full — dropped.');
    }
  },
});
