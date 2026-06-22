import { Colors, EmbedBuilder, GuildMember, PartialGuildMember } from 'discord.js';

import { AuditEventType, getSettings, insertWarning, recordAuditEvent, upsertUser } from '~/database';
import { AppFeature } from '~/settings';
import { Client } from '~/core/models';
import { Logger } from '~/utilities';

const POLICY_TEXT =
  'Your display name must be easily readable and pronounceable, and ' +
  'must begin with a standard Latin alphabet letter (A–Z or a–z). ' +
  'Names that are invisible, consist entirely of symbols, or start ' +
  'with non-Latin characters are not permitted.';

const logger = Logger.getInstance(AppFeature.AntiHoist);

/** Resets nicknames that violate the display-name policy (leading non-alphanumeric), warns and DMs the member. */
export const enforceNickname = async (client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> => {
  const settings = await getSettings();
  if (!settings.featureAntiHoistEnabled) return;

  const oldNick = oldMember.nickname;
  const newNick = newMember.nickname;

  if (newNick === oldNick || !newNick) return;
  if (!/^[^a-zA-Z0-9]/.test(newNick)) return;

  const stripped = newNick.replace(/^[^a-zA-Z0-9]+/, '');
  const fixed = stripped.length >= 2 ? stripped : newMember.user.username;

  await newMember.setNickname(fixed, '[anti-hoist] nickname violates display name policy').catch((err) => {
    logger.warn(Object(err), 'Failed to reset hoisted nickname.');
  });

  await upsertUser({ id: newMember.id, username: newMember.user.username });
  await upsertUser({ id: client.user!.id, username: client.user!.username });

  const warning = await insertWarning({ targetUserId: newMember.id, moderatorId: client.user!.id, reason: POLICY_TEXT });

  await recordAuditEvent({
    eventType: AuditEventType.AntiHoistTriggered,
    targetUserId: newMember.id,
    payload: { from: newNick, to: fixed, warningId: warning.id },
  });

  const dmChannel = await newMember.user.createDM().catch(() => null);
  await dmChannel
    ?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Yellow)
          .setTitle('Display Name Policy')
          .setDescription(POLICY_TEXT)
          .addFields({ name: 'Your nickname was reset to', value: `\`${fixed}\`` })
          .setFooter({ text: 'Automated warning issued · contact a moderator if you believe this is an error' })
          .setTimestamp(),
      ],
    })
    .catch(() => null);

  await logger.log({
    level: 'info',
    message: `Anti-hoist: nickname reset for ${newMember.id}`,
    data: { userId: newMember.id, from: newNick, to: fixed, warningId: warning.id },
    target: 'surveillance',
    internalEmbed: new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('🔤 Anti-Hoist — Nickname Reset')
      .addFields(
        { name: 'User', value: `<@${newMember.id}>`, inline: true },
        { name: 'Before', value: `\`${newNick}\``, inline: true },
        { name: 'After', value: `\`${fixed}\``, inline: true },
        { name: 'Warning', value: `#${warning.id}`, inline: true }
      )
      .setTimestamp(),
  });

  logger.info({ userId: newMember.id, from: newNick, to: fixed, warningId: warning.id }, 'Anti-hoist: nickname reset.');
};
