import { EmbedBuilder, Message, PartialMessage } from 'discord.js';

import { AppFeature } from '~/settings';
import { Colors } from '~/settings/theme';
import { AuditEventType, getSettings, recordAuditEvent, upsertUser } from '~/database';
import { Client } from '~/core/models';
import { Logger, diffWords, jaccardWordDistance, levenshtein } from '~/utilities';

const MAX_DISPLAY = 1000;
const METRIC_CAP = 500;

const logger = Logger.getInstance(AppFeature.Surveillance);

export const reportMessageEdit = async (
  _client: Client,
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage
): Promise<void> => {
  if (!newMessage.inGuild()) return;
  if (newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  // Partials.Message is enabled: an uncached old message reports content === null, which would make
  // every embed-unfurl update look like a user edit from "(not in cache)" to the original text.
  if (oldMessage.partial) return;

  const settings = await getSettings();
  if (!settings.featureSurveillanceEnabled) return;

  const rawBefore = oldMessage.content;
  const rawAfter = newMessage.content ?? '';

  let beforeDisplay: string;
  let afterDisplay: string;
  let metricsValue: string;

  if (rawBefore) {
    const { before, after } = diffWords(rawBefore, rawAfter);
    beforeDisplay = before.slice(0, MAX_DISPLAY) || '*(empty)*';
    afterDisplay = after.slice(0, MAX_DISPLAY) || '*(empty)*';
    const lev = levenshtein(rawBefore.slice(0, METRIC_CAP), rawAfter.slice(0, METRIC_CAP));
    const jaccard = jaccardWordDistance(rawBefore, rawAfter);
    metricsValue = `Levenshtein: \`${lev}\` · Jaccard word dist: \`${jaccard.toFixed(2)}\``;
  } else {
    beforeDisplay = '*(not in cache)*';
    afterDisplay = rawAfter.slice(0, MAX_DISPLAY) || '*(empty)*';
    metricsValue = '*(metrics unavailable — old message not in cache)*';
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle('✏️ Message Edited')
    .setDescription(`<@${newMessage.author.id}> in <#${newMessage.channelId}> · [Jump](${newMessage.url})`)
    .addFields({ name: 'Before', value: beforeDisplay }, { name: 'After', value: afterDisplay }, { name: 'Metrics', value: metricsValue })
    .setFooter({ text: `Message ID: ${newMessage.id}` })
    .setTimestamp();

  await logger.log({
    level: 'info',
    message: `Message edited by ${newMessage.author.id} in ${newMessage.channelId}`,
    data: { messageId: newMessage.id, channelId: newMessage.channelId },
    target: 'surveillance',
    internalEmbed: embed,
  });

  // audit_log.target_user_id is FK-constrained to users; the author may never have been seen before.
  await upsertUser({ id: newMessage.author.id, username: newMessage.author.username });

  await recordAuditEvent({
    eventType: AuditEventType.MessageEdited,
    targetUserId: newMessage.author.id,
    payload: {
      messageId: newMessage.id,
      channelId: newMessage.channelId,
      before: oldMessage.content ? oldMessage.content.slice(0, 512) : null,
      after: rawAfter.slice(0, 512),
    },
  });
};
