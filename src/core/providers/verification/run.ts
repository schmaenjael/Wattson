import { EmbedBuilder, GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { AppFeature, appFeatureMap } from '~/settings';
import {
  AuditEventType,
  getCountryLabelMap,
  getLanguageLabelMap,
  getLatestJoinRecord,
  getRecentJoinsByCode,
  getSettings,
  recordAuditEvent,
  saveUserMembershipData,
  upsertUser,
} from '~/database';
import { Client } from '~/core/models';
import { Logger } from '~/utilities';
import { L } from '~/core/locales';

import { buildVerificationFlow, buildVolterFlow } from './config';
import { FlowAnswers, FlowCancelled } from './flow';
import { ANSWER_DISPLAY_NAMES, assignVolterRoles, buildApprovalAnswerFields, grantAccess, postWelcomeEmbed } from './actions';

export const activeVerifications = new Set<string>();
export const activeVolterVerifications = new Set<string>();

export const runVerification = async (client: Client, member: GuildMember): Promise<void> => {
  if (activeVerifications.has(member.id)) return;
  activeVerifications.add(member.id);

  const logger = Logger.getInstance(AppFeature.Welcome);
  const settings = await getSettings();
  const locale = member.guild.preferredLocale;
  const color = appFeatureMap[AppFeature.Welcome].color;

  await recordAuditEvent({ eventType: AuditEventType.VerificationStarted, targetUserId: member.id, payload: {} });

  let dm;
  try {
    dm = await member.createDM();
  } catch (error) {
    activeVerifications.delete(member.id);
    logger.warn(Object(error), `Cannot DM ${member.user.tag}; skipping verification.`);
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

  await dm.send({ embeds: [intro, disclaimer] }).catch(() => null);

  const flow = await buildVerificationFlow(locale, color);

  let answers: FlowAnswers;
  try {
    answers = await flow.run(member.user, dm, { color });
  } catch (err) {
    activeVerifications.delete(member.id);
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
        .catch(() => null);
      return;
    }
    throw err;
  }

  activeVerifications.delete(member.id);

  await recordAuditEvent({ eventType: AuditEventType.VerificationAnswered, targetUserId: member.id, payload: answers });

  if (answers['is_member'] === 'yes' && typeof answers['haiilo'] === 'string' && answers['haiilo'].length > 0) {
    await upsertUser({ id: member.id, username: member.user.username });
    const chapterCountry =
      typeof answers['chapter_country'] === 'string' && answers['chapter_country'].length > 0 ? answers['chapter_country'] : null;
    await saveUserMembershipData(member.id, answers['haiilo'], chapterCountry).catch((err) =>
      logger.warn(Object(err), 'Failed to persist membership data')
    );
  }

  await dm
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(L[locale].SYSTEM.VERIFICATION.FINAL.EMBED_TITLE())
          .setDescription(L[locale].SYSTEM.VERIFICATION.FINAL.EMBED_DESCRIPTION()),
      ],
    })
    .catch(() => null);

  const autoApprove = async (reason?: string) => {
    if (reason) logger.warn(reason);
    await grantAccess(member, answers);
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
    settings.featureInviteTrackingEnabled ? getLatestJoinRecord(member.id).catch(() => undefined) : Promise.resolve(undefined),
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

  const isMemberApplicant = answers['is_member'] === 'yes' && typeof answers['chapter_country'] === 'string' && answers['chapter_country'].length > 0;

  const initialSettings = await getSettings();
  const approvalButtons: ButtonBuilder[] = [
    new ButtonBuilder().setCustomId(`verify:approve:${member.id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`verify:reject:${member.id}`).setLabel('Reject & Kick').setStyle(ButtonStyle.Danger),
  ];

  if (isMemberApplicant && initialSettings.roleMemberId) {
    approvalButtons.splice(
      1,
      0,
      new ButtonBuilder().setCustomId(`verify:volter:${member.id}`).setLabel('Assign Volter + Chapter Role').setStyle(ButtonStyle.Primary)
    );
  }

  // Insert "Ask Question" before Reject
  approvalButtons.splice(
    approvalButtons.length - 1,
    0,
    new ButtonBuilder().setCustomId(`verify:ask_question:${member.id}`).setLabel('Ask Question').setEmoji('📬').setStyle(ButtonStyle.Secondary)
  );

  await approvalChannel.send({ embeds: [approvalEmbed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...approvalButtons)] });
};

export const runVolterVerification = async (client: Client, member: GuildMember): Promise<void> => {
  if (activeVolterVerifications.has(member.id)) return;
  activeVolterVerifications.add(member.id);

  const logger = Logger.getInstance(AppFeature.Welcome);
  const settings = await getSettings();
  const locale = member.guild.preferredLocale;
  const color = appFeatureMap[AppFeature.Welcome].color;

  let dm;
  try {
    dm = await member.createDM();
  } catch (error) {
    activeVolterVerifications.delete(member.id);
    logger.warn(Object(error), `Cannot DM ${member.user.tag}; skipping volter verification.`);
    return;
  }

  const flow = await buildVolterFlow(locale);

  let answers: FlowAnswers;
  try {
    answers = await flow.run(member.user, dm, { color });
  } catch (err) {
    activeVolterVerifications.delete(member.id);
    if (err instanceof FlowCancelled) {
      logger.info(`Volter verification cancelled for ${member.user.tag} at step "${err.step.key}" (${err.reason}).`);
      return;
    }
    throw err;
  }

  activeVolterVerifications.delete(member.id);

  const haiiloUrl = typeof answers['haiilo'] === 'string' ? answers['haiilo'].trim() : '';
  const chapterCountry = typeof answers['chapter_country'] === 'string' ? answers['chapter_country'] : '';

  await upsertUser({ id: member.id, username: member.user.username });
  await saveUserMembershipData(member.id, haiiloUrl, chapterCountry || null).catch((err) =>
    logger.warn(Object(err), 'Volter verification: failed to persist membership data.')
  );
  await recordAuditEvent({
    eventType: AuditEventType.VerificationAnswered,
    targetUserId: member.id,
    payload: { source: 'volter', haiilo: haiiloUrl, chapterCountry },
  });

  const V = L[locale].SYSTEM.VERIFICATION.VOLTER;
  await dm.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(V.SUBMITTED_TITLE()).setDescription(V.SUBMITTED())] }).catch(() => null);

  if (!settings.approvalChannelId) {
    logger.warn('Volter verification: approvalChannelId not configured — assigning roles immediately.');
    await assignVolterRoles(member, answers, settings);
    return;
  }

  const approvalChannel = (await client.channels.fetch(settings.approvalChannelId).catch(() => null)) as TextChannel | null;
  if (!approvalChannel) {
    logger.warn(`Volter verification: approval channel ${settings.approvalChannelId} not found — assigning roles immediately.`);
    await assignVolterRoles(member, answers, settings);
    return;
  }

  const countryLabelMap = await getCountryLabelMap();
  const chapterLabel = countryLabelMap.get(chapterCountry);
  const chapterDisplay = chapterLabel ? `${chapterLabel} (${chapterCountry})` : chapterCountry;

  const approvalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`Volter Request: ${member.user.tag}`)
    .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
    .addFields(
      { name: 'User', value: `<@${member.id}> (${member.id})`, inline: true },
      { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: ANSWER_DISPLAY_NAMES['haiilo'], value: haiiloUrl, inline: false },
      { name: ANSWER_DISPLAY_NAMES['chapter_country'], value: chapterDisplay, inline: false }
    )
    .setFooter({ text: `🟣 Volter membership request | ${member.user.tag}` })
    .setTimestamp();

  const volterButton = new ButtonBuilder()
    .setCustomId(`verify:volter:${member.id}`)
    .setLabel('Assign Volter + Chapter Role')
    .setStyle(ButtonStyle.Primary);

  await approvalChannel.send({ embeds: [approvalEmbed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(volterButton)] });
};
