import { EmbedBuilder, Events } from 'discord.js';

import { AppFeature } from '~/settings';
import { Colors } from '~/settings/theme';
import { AuditEventType, getSettings, recordAuditEvent } from '~/database';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';
import { runAutomod } from '~/core/providers/automod/run';

const MAX_DISPLAY = 1000;
const METRIC_CAP = 500;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_row, i) => Array.from({ length: n + 1 }, (_col, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function jaccardWordDistance(a: string, b: string): number {
  const aSet = new Set(a.toLowerCase().match(/\S+/g) ?? []);
  const bSet = new Set(b.toLowerCase().match(/\S+/g) ?? []);
  const intersectionSize = [...aSet].filter((w) => bSet.has(w)).length;
  const unionSize = new Set([...aSet, ...bSet]).size;
  return unionSize === 0 ? 0 : 1 - intersectionSize / unionSize;
}

function buildLcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

// Diffs two strings word-by-word. Changed words are wrapped in **bold** in their respective outputs.
function diffWords(a: string, b: string): { before: string; after: string } {
  const aWords = a.match(/\S+/g) ?? [];
  const bWords = b.match(/\S+/g) ?? [];
  const dp = buildLcsTable(aWords, bWords);

  const aParts: string[] = [];
  const bParts: string[] = [];
  let i = aWords.length;
  let j = bWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aWords[i - 1] === bWords[j - 1]) {
      aParts.unshift(aWords[i - 1]);
      bParts.unshift(bWords[j - 1]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      bParts.unshift(`**${bWords[j - 1]}**`);
      j--;
    } else {
      aParts.unshift(`**${aWords[i - 1]}**`);
      i--;
    }
  }

  return { before: aParts.join(' '), after: bParts.join(' ') };
}

export default new Event({
  type: Events.MessageUpdate,
  feature: AppFeature.Surveillance,
  middleware: [],
  async executeCommand(event, client, oldMessage, newMessage) {
    if (!newMessage.inGuild()) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const settings = await getSettings();

    if (settings.featureSurveillanceEnabled) {
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

      const logger = Logger.getInstance(AppFeature.Surveillance);
      await logger.log({
        level: 'info',
        message: `Message edited by ${newMessage.author.id} in ${newMessage.channelId}`,
        data: { messageId: newMessage.id, channelId: newMessage.channelId },
        target: 'surveillance',
        internalEmbed: embed,
      });

      await recordAuditEvent({
        eventType: AuditEventType.MessageEdited,
        targetUserId: newMessage.author?.id,
        payload: {
          messageId: newMessage.id,
          channelId: newMessage.channelId,
          before: oldMessage.content ? oldMessage.content.slice(0, 512) : null,
          after: (newMessage.content ?? '').slice(0, 512),
        },
      });
    }

    if (newMessage.content) {
      await runAutomod(newMessage, settings);
    }
  },
});
