import { EmbedBuilder, GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { AppFeature, appFeatureMap, Colors } from '~/settings';
import { getCountryLabelMap, getLanguageLabelMap } from '~/config';
import { AuditEventType, getLatestJoinRecord, getRecentJoinsByCode, getSettings, recordAuditEvent } from '~/database';
import { Client } from '~/core/models';
import { logSoftFailure, Logger, softFail } from '~/utilities';
import { L } from '~/core/locales';

import { buildVerificationFlow } from './config';
import { FlowAnswers, FlowCancelled } from './flow';
import { buildApprovalAnswerFields, grantAccess, postWelcomeEmbed } from './actions';

export const activeVerifications = new Set<string>();

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

/**
 * Guards the single-flight set. The inner flow used to release it inline, so any throw before the
 * last release left the member permanently unable to verify for the process lifetime.
 */
export const runVerification = async (client: Client, member: GuildMember): Promise<void> => {
  if (activeVerifications.has(member.id)) return;
  activeVerifications.add(member.id);
  try {
    await runVerificationFlow(client, member);
  } finally {
    activeVerifications.delete(member.id);
  }
};

const runVerificationFlow = async (client: Client, member: GuildMember): Promise<void> => {
  const startedAt = Date.now();

  const logger = Logger.getInstance(AppFeature.Welcome);
  const settings = await getSettings();
  const locale = member.guild.preferredLocale;
  const color = appFeatureMap[AppFeature.Welcome].color;

  await recordAuditEvent({ eventType: AuditEventType.VerificationStarted, targetUserId: member.id, payload: {} });

  let dm;
  try {
    dm = await member.createDM();
  } catch (error) {
    logSoftFailure(AppFeature.VolterVerification, 'VERIFICATION_DM_OPEN', { memberId: member.id }, error);
    return;
  }

  const D = L[locale].SYSTEM.VERIFICATION.DISCLAIMER;

  const intro = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: member.guild.name, iconURL: member.guild.iconURL({ size: 256 }) ?? undefined })
    .setTitle(L[locale].SYSTEM.VERIFICATION.INITIAL.EMBED_TITLE())
    .setDescription(L[locale].SYSTEM.VERIFICATION.INITIAL.EMBED_DESCRIPTION())
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields({ name: '📝 What to expect', value: 'A few short questions about yourself and your background.', inline: false })
    .setFooter({ text: 'Wattson · Volt Europa Discord' })
    .setTimestamp();

  const disclaimer = new EmbedBuilder()
    .setColor(color)
    .setTitle(D.EMBED_TITLE())
    .addFields(
      { name: D.FIELD_ANSWERS_TITLE(), value: D.FIELD_ANSWERS_VALUE(), inline: false },
      { name: D.FIELD_MESSAGES_TITLE(), value: D.FIELD_MESSAGES_VALUE(), inline: false },
      { name: D.FIELD_MODERATION_TITLE(), value: D.FIELD_MODERATION_VALUE(), inline: false },
      { name: D.FIELD_TIMELINE_TITLE(), value: D.FIELD_TIMELINE_VALUE(), inline: false }
    );

  await dm.send({ embeds: [intro, disclaimer] }).catch(softFail(AppFeature.VolterVerification, 'VERIFICATION_DM_SEND'));

  const flow = await buildVerificationFlow(locale, color);

  let answers: FlowAnswers;
  try {
    answers = await flow.run(member.user, dm, { color });
  } catch (err) {
    if (err instanceof FlowCancelled) {
      logger.info(`Verification cancelled for ${member.user.tag} at step "${err.step.key}" (${err.reason}).`);
      await recordAuditEvent({
        eventType: AuditEventType.VerificationRejected,
        targetUserId: member.id,
        payload: { step: err.step.key, reason: err.reason },
      });
      await dm
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(color)
              .setTitle(L[locale].SYSTEM.VERIFICATION.CANCELLED.EMBED_TITLE())
              .setDescription(L[locale].SYSTEM.VERIFICATION.CANCELLED.EMBED_DESCRIPTION()),
          ],
        })
        .catch(softFail(AppFeature.VolterVerification, 'VERIFICATION_DM_SEND'));
      return;
    }
    throw err;
  }

  const answeredEvent = await recordAuditEvent({ eventType: AuditEventType.VerificationAnswered, targetUserId: member.id, payload: answers });

  await dm
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(L[locale].SYSTEM.VERIFICATION.FINAL.EMBED_TITLE())
          .setDescription(L[locale].SYSTEM.VERIFICATION.FINAL.EMBED_DESCRIPTION()),
        new EmbedBuilder().setColor(Colors.Purple).setDescription(L[locale].SYSTEM.VERIFICATION.FINAL.VOLTER_HINT()),
      ],
    })
    .catch(softFail(AppFeature.VolterVerification, 'VERIFICATION_DM_SEND'));

  const autoApprove = async (reason?: string) => {
    if (reason) logger.warn(reason);
    const granted = await grantAccess(member, answers);
    if (!granted) {
      logger.error({ userId: member.id }, 'Verification auto-approved but the access role could not be applied.');
    }
    await postWelcomeEmbed(client, member);
    await recordAuditEvent({ eventType: AuditEventType.VerificationCompleted, targetUserId: member.id });
  };

  if (!settings.featureVerificationRequiresApproval) return autoApprove();
  if (!settings.approvalChannelId) return autoApprove('Verification requires approval but approvalChannelId is unset — granting immediately.');

  const approvalChannel = (await client.channels.fetch(settings.approvalChannelId)) as TextChannel | null;
  if (!approvalChannel) return autoApprove(`Approval channel ${settings.approvalChannelId} not found — granting immediately.`);

  const [countryLabelMap, languageLabelMap, joinRecord] = await Promise.all([
    getCountryLabelMap(),
    getLanguageLabelMap(),
    settings.featureInviteTrackingEnabled
      ? getLatestJoinRecord(member.id).catch(
          softFail(AppFeature.VolterVerification, 'VERIFICATION_GET_LATEST_JOIN_RECORD', { memberId: member.id }, undefined)
        )
      : Promise.resolve(undefined),
  ]);

  const approvalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Verification: ${member.user.tag}`)
    .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
    .addFields(
      { name: 'User', value: `<@${member.id}> (${member.id})`, inline: true },
      { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Joined server', value: `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>`, inline: true },
      ...buildApprovalAnswerFields(answers, countryLabelMap, languageLabelMap)
    )
    .setTimestamp();

  if (joinRecord) {
    const code = joinRecord.inviteCode;
    let inviteFieldValue: string;
    if (code === 'VANITY') {
      inviteFieldValue = 'Vanity URL';
    } else if (code === 'UNKNOWN') {
      inviteFieldValue = 'Unknown (untracked)';
    } else {
      const recentUses = await getRecentJoinsByCode(code, settings.inviteRaidWindowMs);
      const isSuspicious = recentUses > settings.inviteRaidThreshold;
      const inviterPart = joinRecord.inviterId ? `by <@${joinRecord.inviterId}>` : 'inviter unknown';
      const avatarPart = joinRecord.hadAvatar ? '' : ' · no avatar at join';
      inviteFieldValue = `\`${code}\` — ${inviterPart}${avatarPart}`;
      if (isSuspicious) {
        inviteFieldValue += `\n⚠️ **${recentUses} joins** from this code in the last ${Math.round(settings.inviteRaidWindowMs / 1000)}s`;
      }
    }
    approvalEmbed.addFields({ name: '🔗 Invite', value: inviteFieldValue, inline: false });
  }

  approvalEmbed.addFields({ name: '⏱️ Flow duration', value: formatDuration(Date.now() - startedAt), inline: true });

  const approvalButtons: ButtonBuilder[] = [
    new ButtonBuilder().setCustomId(`verify:approve:${member.id}:${answeredEvent.id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`verify:ask_question:${member.id}`).setLabel('Ask Question').setEmoji('📬').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`verify:reject:${member.id}`).setLabel('Reject & Kick').setStyle(ButtonStyle.Danger),
  ];

  await approvalChannel.send({ embeds: [approvalEmbed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...approvalButtons)] });
};
