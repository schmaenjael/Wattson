import { Colors, EmbedBuilder, type Message, type TextChannel } from 'discord.js';

import { AuditEventType, getSettings, insertWarning, recordAuditEvent, upsertUser } from '~/database';
import { AppFeature } from '~/settings';
import { Logger } from '~/utilities';
import { getHarmDetector, type HarmCategory, type HarmDetectionResult } from '~/core/providers/harm';
import { getBlocklistChecker } from '~/core/providers/blocklist';
import { getProfanityChecker } from '~/core/providers/profanity';

const MAX_EXCERPT = 512;

const CATEGORY_LABELS: Record<HarmCategory, string> = {
  race: 'Race',
  sexualOrientation: 'Sexual Orientation',
  gender: 'Gender',
  physicalAppearance: 'Physical Appearance',
  religion: 'Religion',
  class: 'Class',
  disability: 'Disability',
};

const CONFIDENCE_EMOJI: Record<string, string> = { low: '🟡', medium: '🟠', high: '🔴' };

const _harmAlertState = new Map<string, { alertMessageId: string; count: number }>();

const logToSurveillance = async (guild: NonNullable<TextChannel['guild']>, channelId: string | null | undefined, text: string): Promise<void> => {
  if (!channelId) return;
  const ch = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  await ch?.send({ content: text.slice(0, 2000) }).catch(() => null);
};

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

  const jumpUrl = `https://discord.com/channels/${guild.id}/${channelId}/${messageId}`;

  const existing = _harmAlertState.get(messageId);
  if (existing) {
    const existingMsg = await alertChannel.messages.fetch(existing.alertMessageId).catch(() => null);
    if (existingMsg) {
      const newCount = existing.count + 1;
      _harmAlertState.set(messageId, { alertMessageId: existing.alertMessageId, count: newCount });
      const updatedEmbed = EmbedBuilder.from(existingMsg.embeds[0]).setFooter({ text: `Message ID: ${messageId} · Reported ${newCount}× total` });
      await existingMsg.edit({ embeds: [updatedEmbed] }).catch(() => null);
      return;
    }
    _harmAlertState.delete(messageId);
  }

  const categoryLines = result.detectedCategories.map((cat) => {
    const { confidence } = result.categories[cat];
    return `${CONFIDENCE_EMOJI[confidence] ?? '🟡'} **${CATEGORY_LABELS[cat]}** (${confidence} confidence)`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('⚠️ Harm Detected')
    .setURL(jumpUrl)
    .setDescription(`Message by <@${authorId}> in <#${channelId}>`)
    .addFields(
      { name: 'Categories', value: categoryLines.join('\n').slice(0, 1024) },
      { name: 'Jump to message', value: `[Click here](${jumpUrl})` },
      { name: 'Excerpt', value: `\`\`\`\n${content.slice(0, 400)}\n\`\`\`` }
    )
    .setFooter({ text: `Message ID: ${messageId}` })
    .setTimestamp();

  const alertMsg = await alertChannel.send({ embeds: [embed] }).catch(() => null);
  if (alertMsg) {
    _harmAlertState.set(messageId, { alertMessageId: alertMsg.id, count: 1 });
  }
};

const issueAutoWarn = async (
  message: Message<true>,
  result: HarmDetectionResult,
  settings: Awaited<ReturnType<typeof getSettings>>
): Promise<void> => {
  const botId = message.client.user!.id;
  const botUsername = message.client.user!.username;
  const categoryList = result.detectedCategories.map((c) => CATEGORY_LABELS[c]).join(', ');
  const reason = `Automod: hate speech detected (${categoryList}) — high confidence`;

  await Promise.all([upsertUser({ id: message.author.id, username: message.author.username }), upsertUser({ id: botId, username: botUsername })]);

  const warning = await insertWarning({ targetUserId: message.author.id, moderatorId: botId, reason });

  await recordAuditEvent({
    eventType: AuditEventType.WarnIssued,
    actorUserId: botId,
    targetUserId: message.author.id,
    payload: { warningId: warning.id, reason, source: 'automod_harm' },
  });

  const dm = await message.author.createDM().catch(() => null);
  if (dm) {
    await dm
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle('You received a warning')
            .addFields(
              { name: 'Reason', value: reason },
              { name: 'Warning ID', value: `#${warning.id}`, inline: true },
              { name: 'Issued at', value: `<t:${Math.floor(warning.createdAt.getTime() / 1000)}:F>`, inline: true },
              { name: 'Expires', value: warning.expiresAt ? `<t:${Math.floor(warning.expiresAt.getTime() / 1000)}:F>` : 'Never', inline: true }
            )
            .setTimestamp(),
        ],
      })
      .catch(() => null);
  }

  if (settings.warningsLogChannelId) {
    const logChannel = (await message.guild.channels.fetch(settings.warningsLogChannelId).catch(() => null)) as TextChannel | null;
    await logChannel
      ?.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle(`Auto-Warning #${warning.id}`)
            .addFields(
              { name: 'Target', value: `<@${message.author.id}>`, inline: true },
              { name: 'Moderator', value: 'Automod', inline: true },
              { name: 'Expires', value: warning.expiresAt ? `<t:${Math.floor(warning.expiresAt.getTime() / 1000)}:R>` : 'Never', inline: true },
              { name: 'Reason', value: reason }
            )
            .setTimestamp(warning.createdAt),
        ],
      })
      .catch(() => null);
  }
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

export const runAutomod = async (message: Message<true>, settings: Awaited<ReturnType<typeof getSettings>>): Promise<void> => {
  const logger = Logger.getInstance(AppFeature.Surveillance);

  // ── Step 3: Link filter (O(1) Set lookup) ──────────────────────────────────
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

  // ── Step 4: Profanity filter (file-based regex, unified cache) ─────────────
  if (settings.featureBadWordsEnabled) {
    const checker = await getProfanityChecker();
    if (checker) {
      const match = checker.check(message.content);

      if (match) {
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

        // Severity < threshold → always ask LLM for context
        logger.debug({ word: match.word, severity: match.severity }, 'Profanity: LLM context check.');
        const result = await runLlmCheck(message.content, settings);

        if (result?.anyDetected) {
          const isHighConfidence = result.detectedCategories.some((cat) => result.categories[cat].confidence === 'high');
          await message.delete().catch(() => null);
          logger.info({ word: match.word, categories: result.detectedCategories, isHighConfidence }, 'Profanity: LLM confirmed harm, deleted.');
          if (isHighConfidence) {
            await issueAutoWarn(message, result, settings);
          }
          await logToSurveillance(
            message.guild,
            settings.surveillanceLogChannelId,
            `🚫 **profanity+llm** sev${match.severity} \`${match.word}\` — LLM confirmed${isHighConfidence ? ' · warned' : ''} · <@${message.author.id}> in <#${message.channelId}>\n\`\`\`\n${excerpt.slice(0, 400)}\n\`\`\``
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

  // ── Step 5: General LLM harm detection (no profanity match) ───────────────
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

  const isHighConfidence = result.detectedCategories.some((cat) => result.categories[cat].confidence === 'high');

  if (isHighConfidence) {
    await message.delete().catch(() => null);
    await issueAutoWarn(message, result, settings);
    logger.info({ categories: result.detectedCategories }, 'Harm detection: high confidence — deleted + warned.');
    await logToSurveillance(
      message.guild,
      settings.surveillanceLogChannelId,
      `🚫 **harm detection** — deleted + warned · <@${message.author.id}> in <#${message.channelId}>\nCategories: ${result.detectedCategories.map((c) => `${CATEGORY_LABELS[c]} (high)`).join(', ')}`
    );
  } else {
    logger.info({ categories: result.detectedCategories }, 'Harm detection: low/medium confidence — alert only.');
  }

  if (!settings.harmAlertChannelId) {
    logger.warn('Harm detected but harmAlertChannelId not configured — skipping alert.');
    return;
  }

  await postHarmAlert(result, message.author.id, message.channelId, message.id, message.content, message.guild, settings.harmAlertChannelId);
  await recordAuditEvent({
    eventType: AuditEventType.AutomodTriggered,
    targetUserId: message.author.id,
    payload: {
      source: 'harm_detection',
      detectedCategories: result.detectedCategories,
      messageId: message.id,
      channelId: message.channelId,
      action: isHighConfidence ? 'delete_warn' : 'alert',
    },
  });
};
