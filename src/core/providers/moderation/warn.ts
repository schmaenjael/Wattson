import { EmbedBuilder, type Guild, type User } from 'discord.js';

import { BotException, type Client } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { discordTimestamp, Logger, softFail } from '~/utilities';
import { applyWarnAutoMute } from '~/core/providers/automod';
import {
  AuditEventType,
  countActiveWarnings,
  countActiveWarningsSince,
  getSettings,
  insertWarning,
  recordAuditEvent,
  upsertUser,
  type Warning,
} from '~/database';

const COLOR = appFeatureMap[AppFeature.Warn].color;

export interface IssueWarningInput {
  target: User;
  moderator: User;
  reason: string;
  expiresAt: Date | null;
}

export interface IssueWarningResult {
  warning: Warning;
  /** Escalation hints (threshold reached, auto-mute applied) to append to the moderator-facing reply. */
  escalationNote: string;
}

/** Records a warning, DMs the target, writes the mod log + audit entry, and runs warn auto-mute escalation. */
export const issueWarning = async (client: Client, guild: Guild, input: IssueWarningInput): Promise<IssueWarningResult> => {
  const { target, moderator, reason, expiresAt } = input;
  const settings = await getSettings();

  await Promise.all([upsertUser({ id: target.id, username: target.username }), upsertUser({ id: moderator.id, username: moderator.username })]);

  let warning: Warning;
  try {
    warning = await insertWarning({ targetUserId: target.id, moderatorId: moderator.id, reason, expiresAt });
  } catch (error) {
    throw new BotException(client, `Failed to record warning against ${target.tag}`, error);
  }

  await recordAuditEvent({
    eventType: AuditEventType.WarnIssued,
    actorUserId: moderator.id,
    targetUserId: target.id,
    payload: { warningId: warning.id, reason },
  });

  const dm = await target.createDM().catch(softFail(AppFeature.Warn, 'WARN_DM_OPEN'));
  if (dm) {
    await dm
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle('You received a warning')
            .addFields(
              { name: 'Reason', value: reason },
              { name: 'Warning ID', value: `#${warning.id}`, inline: true },
              { name: 'Issued at', value: `${discordTimestamp(warning.createdAt, 'F')}`, inline: true },
              { name: 'Expires', value: warning.expiresAt ? `${discordTimestamp(warning.expiresAt, 'F')}` : 'Never', inline: true }
            )
            .setTimestamp(),
        ],
      })
      .catch(softFail(AppFeature.Warn, 'WARN_DM_SEND'));
  }

  const logger = Logger.getInstance(AppFeature.Warn);
  await logger.log({
    level: 'info',
    message: `Warning #${warning.id} issued against ${target.id}`,
    data: { warningId: warning.id, targetId: target.id, moderatorId: moderator.id },
    target: 'moderation',
    internalEmbed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(`Warning #${warning.id}`)
      .addFields(
        { name: 'Target', value: `<@${target.id}>`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
        { name: 'Expires', value: warning.expiresAt ? `${discordTimestamp(warning.expiresAt, 'R')}` : 'Never', inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp(warning.createdAt),
    publicEmbed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('⚠️ Member Warned')
      .addFields({ name: 'User', value: `<@${target.id}>` }, { name: 'Reason', value: reason })
      .setTimestamp(warning.createdAt),
  });

  const windowStart = new Date(Date.now() - settings.warnAutoEscalateWindowDays * 24 * 60 * 60 * 1000);
  const [activeCount, windowCount] = await Promise.all([countActiveWarnings(target.id), countActiveWarningsSince(target.id, windowStart)]);

  let escalationNote = '';
  if (windowCount >= settings.warnAutoEscalateCount) {
    escalationNote = `\n\n⚠️ **Auto-escalation threshold reached** (${windowCount} active warnings in the last ${settings.warnAutoEscalateWindowDays} days). Consider a ban or court case.`;
  }

  const autoMuteNote = await applyWarnAutoMute(client, guild, target, activeCount, settings);
  if (autoMuteNote) {
    escalationNote += autoMuteNote;
  }

  return { warning, escalationNote };
};
