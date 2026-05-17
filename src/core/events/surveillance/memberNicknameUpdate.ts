import { Colors, EmbedBuilder, Events, TextChannel } from 'discord.js';

import { AuditEventType, getSettings, insertWarning, recordAuditEvent, upsertUser } from '~/database';
import { AppFeature } from '~/settings';
import { Event } from '~/core/models';
import { Logger } from '~/utilities';

const POLICY_TEXT =
  'Your display name must be easily readable and pronounceable, and ' +
  'must begin with a standard Latin alphabet letter (A–Z or a–z). ' +
  'Names that are invisible, consist entirely of symbols, or start ' +
  'with non-Latin characters are not permitted.';

const logToSurveillance = async (guild: NonNullable<TextChannel['guild']>, channelId: string | null | undefined, text: string): Promise<void> => {
  if (!channelId) return;
  const ch = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  await ch?.send({ content: text.slice(0, 2000) }).catch(() => null);
};

export default new Event({
  type: Events.GuildMemberUpdate,
  feature: AppFeature.AntiHoist,
  middleware: [],
  async executeCommand(event, client, oldMember, newMember) {
    const settings = await getSettings();
    if (!settings.featureAntiHoistEnabled) return;

    const oldNick = oldMember.nickname;
    const newNick = newMember.nickname;

    if (newNick === oldNick || !newNick) return;
    if (!/^[^a-zA-Z0-9]/.test(newNick)) return;

    const stripped = newNick.replace(/^[^a-zA-Z0-9]+/, '');
    const fixed = stripped.length >= 2 ? stripped : newMember.user.username;

    const logger = Logger.getInstance(AppFeature.AntiHoist);

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

    await logToSurveillance(
      newMember.guild,
      settings.surveillanceLogChannelId,
      `🔤 **anti-hoist** <@${newMember.id}> nickname \`${newNick}\` → \`${fixed}\` · warn #${warning.id} issued`
    );

    logger.info({ userId: newMember.id, from: newNick, to: fixed, warningId: warning.id }, 'Anti-hoist: nickname reset.');
  },
});
