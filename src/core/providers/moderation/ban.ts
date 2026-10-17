import { EmbedBuilder, type Guild, type User } from 'discord.js';

import { BotException, type Client } from '~/core/models';
import { AppFeature, appFeatureMap } from '~/settings';
import { discordTimestamp, Logger } from '~/utilities';
import { AuditEventType, insertBan, recordAuditEvent, upsertUser, type Ban } from '~/database';

const COLOR = appFeatureMap[AppFeature.Ban].color;

export interface ApplyBanInput {
  target: User;
  moderator: User;
  reason: string;
  expiresAt: Date | null;
  appealable: boolean;
  deleteMessageSeconds: number;
}

/** Bans via the Discord API first (no row on failure), then records the ban and writes the mod log + audit entry. */
export const applyBan = async (client: Client, guild: Guild, input: ApplyBanInput): Promise<Ban> => {
  const { target, moderator, reason, expiresAt, appealable, deleteMessageSeconds } = input;

  await Promise.all([upsertUser({ id: target.id, username: target.username }), upsertUser({ id: moderator.id, username: moderator.username })]);

  try {
    await guild.bans.create(target.id, { reason: `[#${moderator.username}] ${reason}`, deleteMessageSeconds });
  } catch (error) {
    throw new BotException(client, `Failed to ban ${target.tag} via Discord API`, error);
  }

  const ban = await insertBan({ targetUserId: target.id, moderatorId: moderator.id, reason, expiresAt, appealable });

  await recordAuditEvent({
    eventType: AuditEventType.BanIssued,
    actorUserId: moderator.id,
    targetUserId: target.id,
    payload: { banId: ban.id, reason, expiresAt: expiresAt?.toISOString() ?? null, appealable },
  });

  const logger = Logger.getInstance(AppFeature.Ban);
  await logger.log({
    level: 'info',
    message: `Ban #${ban.id} issued against ${target.id}`,
    data: { banId: ban.id, targetId: target.id, moderatorId: moderator.id },
    target: 'moderation',
    internalEmbed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(`Ban #${ban.id}`)
      .addFields(
        { name: 'Target', value: `<@${target.id}>`, inline: true },
        { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Expires', value: expiresAt ? `${discordTimestamp(expiresAt, 'F')}` : 'permanent', inline: true },
        { name: 'Appealable', value: appealable ? 'yes' : 'no', inline: true }
      )
      .setTimestamp(ban.createdAt),
    publicEmbed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('🔨 Member Banned')
      .addFields({ name: 'User', value: `<@${target.id}>` }, { name: 'Reason', value: reason })
      .setTimestamp(ban.createdAt),
  });

  return ban;
};
