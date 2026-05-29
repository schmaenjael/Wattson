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

const issueAutoWarn = async (message: Message<true>, result: HarmDetectionResult): Promise<void> => {
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

  const autoWarnLogger = Logger.getInstance(AppFeature.Surveillance);
  await autoWarnLogger.log({
    level: 'info',
    message: `Auto-warning #${warning.id} issued against ${message.author.id}`,
    data: { warningId: warning.id, targetId: message.author.id },
    target: 'moderation',
    internalEmbed: new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle(`Auto-Warning #${warning.id}`)
      .addFields(
        { name: 'Target', value: `<@${message.author.id}>`, inline: true },
        { name: 'Moderator', value: 'Automod', inline: true },
        { name: 'Expires', value: warning.expiresAt ? `<t:${Math.floor(warning.expiresAt.getTime() / 1000)}:R>` : 'Never', inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp(warning.createdAt),
    publicEmbed: new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle('🤖 Automod Action')
      .addFields({ name: 'User', value: `<@${message.author.id}>` }, { name: 'Reason', value: reason })
      .setTimestamp(warning.createdAt),
  });
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
        await logger.log({
          level: 'info',
          message: `Link filter blocked domain ${blocked} from ${message.author.id}`,
          data: { domain: blocked, userId: message.author.id, channelId: message.channelId },
          target: 'surveillance',
          internalEmbed: new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('🚫 Link Filter')
            .setDescription(`<@${message.author.id}> in <#${message.channelId}>`)
            .addFields({ name: 'Blocked domain', value: `\`${blocked}\`` })
            .setTimestamp(),
        });
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
          await logger.log({
            level: 'info',
            message: `Profanity sev${match.severity} deleted: ${message.author.id}`,
            data: { word: match.word, severity: match.severity, userId: message.author.id, channelId: message.channelId },
            target: 'surveillance',
            internalEmbed: new EmbedBuilder()
              .setColor(Colors.Red)
              .setTitle('🚫 Profanity — Deleted')
              .setDescription(`<@${message.author.id}> in <#${message.channelId}>`)
              .addFields(
                { name: 'Word', value: `\`${match.word}\``, inline: true },
                { name: 'Severity', value: `${match.severity}`, inline: true },
                { name: 'Excerpt', value: `\`\`\`\n${excerpt.slice(0, 400)}\n\`\`\`` }
              )
              .setTimestamp(),
          });
          return;
        }

        // Severity < threshold → ask LLM for context; only act on high confidence
        const result = await runLlmCheck(message.content, settings);

        if (result?.anyDetected) {
          const isHighConfidence = result.detectedCategories.some((cat) => result.categories[cat].confidence === 'high');
          if (isHighConfidence) {
            await message.delete().catch(() => null);
            await issueAutoWarn(message, result);
            logger.info(
              { word: match.word, categories: result.detectedCategories },
              'Profanity: LLM confirmed high confidence harm, deleted + warned.'
            );
            await logger.log({
              level: 'info',
              message: `Profanity+LLM sev${match.severity} deleted+warned: ${message.author.id}`,
              data: { word: match.word, categories: result.detectedCategories, userId: message.author.id, channelId: message.channelId },
              target: 'surveillance',
              internalEmbed: new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('🚫 Profanity + LLM — Deleted + Warned')
                .setDescription(`<@${message.author.id}> in <#${message.channelId}>`)
                .addFields(
                  { name: 'Word', value: `\`${match.word}\``, inline: true },
                  { name: 'Severity', value: `${match.severity}`, inline: true },
                  { name: 'Categories', value: result.detectedCategories.map((c) => CATEGORY_LABELS[c]).join(', ') },
                  { name: 'Excerpt', value: `\`\`\`\n${excerpt.slice(0, 400)}\n\`\`\`` }
                )
                .setTimestamp(),
            });
            if (settings.surveillanceLogChannelId) {
              await postHarmAlert(
                result,
                message.author.id,
                message.channelId,
                message.id,
                message.content,
                message.guild,
                settings.surveillanceLogChannelId
              );
            }
          }
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
  if (!isHighConfidence) return;

  await message.delete().catch(() => null);
  await issueAutoWarn(message, result);
  logger.info({ categories: result.detectedCategories }, 'Harm detection: high confidence — deleted + warned.');
  await logger.log({
    level: 'info',
    message: `Harm detection deleted+warned: ${message.author.id}`,
    data: { categories: result.detectedCategories, userId: message.author.id, channelId: message.channelId },
    target: 'surveillance',
    internalEmbed: new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('⚠️ Harm Detected — Deleted + Warned')
      .setDescription(`<@${message.author.id}> in <#${message.channelId}>`)
      .addFields({ name: 'Categories', value: result.detectedCategories.map((c) => `${CATEGORY_LABELS[c]} (high)`).join(', ') })
      .setTimestamp(),
  });

  if (settings.surveillanceLogChannelId) {
    await postHarmAlert(result, message.author.id, message.channelId, message.id, message.content, message.guild, settings.surveillanceLogChannelId);
  }
  await recordAuditEvent({
    eventType: AuditEventType.AutomodTriggered,
    targetUserId: message.author.id,
    payload: {
      source: 'harm_detection',
      detectedCategories: result.detectedCategories,
      messageId: message.id,
      channelId: message.channelId,
      action: 'delete_warn',
    },
  });
};
