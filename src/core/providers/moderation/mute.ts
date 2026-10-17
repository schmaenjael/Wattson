import { EmbedBuilder, type Guild, type User } from 'discord.js';

import { BotException, type Client } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { discordTimestamp, Logger, softFail } from '~/utilities';
import { AuditEventType, getSettings, insertMute, recordAuditEvent, upsertUser, type Mute } from '~/database';

const COLOR = appFeatureMap[AppFeature.Mute].color;

export interface ApplyMuteInput {
  target: User;
  moderator: User;
  reason: string;
  expiresAt: Date | null;
}

export type ApplyMuteResult = { ok: true; mute: Mute } | { ok: false; reason: 'not_configured' | 'not_in_guild' | 'already_muted' };

/** Assigns the muted role, records the mute, and writes the mod log + audit entry. */
export const applyMute = async (client: Client, guild: Guild, input: ApplyMuteInput): Promise<ApplyMuteResult> => {
  const { target, moderator, reason, expiresAt } = input;
  const settings = await getSettings();

  if (!settings.roleMutedId) {
    return { ok: false, reason: 'not_configured' };
  }

  await Promise.all([upsertUser({ id: target.id, username: target.username }), upsertUser({ id: moderator.id, username: moderator.username })]);

  const member = await guild.members.fetch(target.id).catch(softFail(AppFeature.Mute, 'MUTE_MEMBER_FETCH', { targetId: target.id }));
  if (!member) {
    return { ok: false, reason: 'not_in_guild' };
  }
  if (member.roles.cache.has(settings.roleMutedId)) {
    return { ok: false, reason: 'already_muted' };
  }

  try {
    await member.roles.add(settings.roleMutedId, `[mute #mod:${moderator.username}] ${reason}`);
  } catch (error) {
    throw new BotException(client, `Failed to assign muted role to ${target.tag}`, error);
  }

  const mute = await insertMute({ targetUserId: target.id, moderatorId: moderator.id, reason, expiresAt });

  await recordAuditEvent({
    eventType: AuditEventType.MuteIssued,
    actorUserId: moderator.id,
    targetUserId: target.id,
    payload: { muteId: mute.id, reason, expiresAt: expiresAt?.toISOString() ?? null },
  });

  const logger = Logger.getInstance(AppFeature.Mute);
  await logger.log({
    level: 'info',
    message: `Mute #${mute.id} issued against ${target.id}`,
    data: { muteId: mute.id, targetId: target.id, moderatorId: moderator.id },
    target: 'moderation',
    internalEmbed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(`Mute #${mute.id}`)
      .addFields(
        { name: 'Target', value: `<@${target.id}>`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Expires', value: expiresAt ? `${discordTimestamp(expiresAt, 'F')}` : 'indefinite', inline: true }
      )
      .setTimestamp(mute.createdAt),
    publicEmbed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('🔇 Member Muted')
      .addFields(
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Duration', value: expiresAt ? `${discordTimestamp(expiresAt, 'R')}` : 'indefinite' },
        { name: 'Reason', value: reason }
      )
      .setTimestamp(mute.createdAt),
  });

  return { ok: true, mute };
};
