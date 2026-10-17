import { getConfig, type StarboardEmojiTier } from '~/config';

export type { StarboardEmojiTier };

export type RoleIds = {
  roleUnregisteredId: string | null;
  roleCommunityId: string | null;
  roleMemberId: string | null;
  roleEventManagerId: string | null;
  roleModerationId: string | null;
  roleAdministrationId: string | null;
  roleMutedId: string | null;
  roleModmailHandlerId: string | null;
};

/**
 * Legacy guild-settings shape. Previously an `InferSelectModel` of the (now removed) `settings`
 * table; kept as a hand-written contract so the ~40 consumers of {@link getSettings} are untouched.
 * Values are now sourced from the in-memory, Zod-validated config rather than the database.
 */
export type Settings = {
  // Channel IDs
  notificationChannelId: string | null;
  modLogChannelId: string | null;
  publicLogChannelId: string | null;
  surveillanceLogChannelId: string | null;
  reportsLogChannelId: string | null;
  reportsTodoChannelId: string | null;
  welcomeChannelId: string | null;
  approvalChannelId: string | null;
  courtParentChannelId: string | null;
  starboardChannelId: string | null;
  modmailChannelId: string | null;
  appealChannelId: string | null;
  eventAnnouncementChannelId: string | null;
  suggestionChannelId: string | null;
  suggestionApprovalChannelId: string | null;

  // Feature toggles
  featureWelcomeEnabled: boolean;
  featureStarboardEnabled: boolean;
  featureCourtEnabled: boolean;
  featureSystemNotificationsEnabled: boolean;
  featureSurveillanceEnabled: boolean;
  featureVerificationRequiresApproval: boolean;
  featureWarnAutoMuteEnabled: boolean;
  featureHarmDetectionEnabled: boolean;
  featureBadWordsEnabled: boolean;
  featureLinkFilterEnabled: boolean;
  featureAntiSpamEnabled: boolean;
  featureAntiHoistEnabled: boolean;
  featureInviteTrackingEnabled: boolean;
  featureAutoSlowmodeEnabled: boolean;
  featureAskEnabled: boolean;
  featureRagEnabled: boolean;
  featureModmailEnabled: boolean;
  featureAppealEnabled: boolean;
  featureSuggestionsEnabled: boolean;
  featureEventsEnabled: boolean;
  featureStickyEnabled: boolean;
  featureReactEnabled: boolean;
  featureForumRolesEnabled: boolean;
  featureAnalyticsEnabled: boolean;
  featureStatChannelsEnabled: boolean;
  featureReportsEnabled: boolean;

  // Thresholds
  starboardThreshold: number;
  starboardExternalThreshold: number;
  warnAutoEscalateCount: number;
  warnAutoEscalateWindowDays: number;
  warnAutoMuteBaseMinutes: number;
  badWordDeleteThreshold: number;
  antiSpamMaxMessages: number;
  antiSpamWindowMs: number;
  antiSpamMuteMinutes: number;
  inviteRaidThreshold: number;
  inviteRaidWindowMs: number;
  autoSlowmodeThreshold: number;
  autoSlowmodeWindowMs: number;
  appealVoteThreshold: number;
  suggestionVoteThreshold: number;
  suggestionVoteDurationHours: number;

  // Complex
  starboardEmojiTiers: StarboardEmojiTier[];
  reactDefaultEmojis: string[];
} & RoleIds;

/**
 * Returns the guild settings, flattened from the in-memory config into the legacy column shape.
 * Async to preserve the historical contract; no I/O is performed.
 */
export const getSettings = async (): Promise<Settings> => {
  const { config } = getConfig();
  const { channels, features, thresholds, roles } = config;

  return {
    notificationChannelId: channels.notification ?? null,
    modLogChannelId: channels.modLog ?? null,
    publicLogChannelId: channels.publicLog ?? null,
    surveillanceLogChannelId: channels.surveillanceLog ?? null,
    reportsLogChannelId: channels.reportsLog ?? null,
    reportsTodoChannelId: channels.reportsTodo ?? null,
    welcomeChannelId: channels.welcome ?? null,
    approvalChannelId: channels.approval ?? null,
    courtParentChannelId: channels.courtParent ?? null,
    starboardChannelId: channels.starboard ?? null,
    modmailChannelId: channels.modmail ?? null,
    appealChannelId: channels.appeal ?? null,
    eventAnnouncementChannelId: channels.eventAnnouncement ?? null,
    suggestionChannelId: channels.suggestion ?? null,
    suggestionApprovalChannelId: channels.suggestionApproval ?? null,

    featureWelcomeEnabled: features.welcome,
    featureStarboardEnabled: features.starboard,
    featureCourtEnabled: features.court,
    featureSystemNotificationsEnabled: features.systemNotifications,
    featureSurveillanceEnabled: features.surveillance,
    featureVerificationRequiresApproval: features.verificationRequiresApproval,
    featureWarnAutoMuteEnabled: features.warnAutoMute,
    featureHarmDetectionEnabled: features.harmDetection,
    featureBadWordsEnabled: features.badWords,
    featureLinkFilterEnabled: features.linkFilter,
    featureAntiSpamEnabled: features.antiSpam,
    featureAntiHoistEnabled: features.antiHoist,
    featureInviteTrackingEnabled: features.inviteTracking,
    featureAutoSlowmodeEnabled: features.autoSlowmode,
    featureAskEnabled: features.ask,
    featureRagEnabled: features.rag,
    featureModmailEnabled: features.modmail,
    featureAppealEnabled: features.appeal,
    featureSuggestionsEnabled: features.suggestions,
    featureEventsEnabled: features.events,
    featureStickyEnabled: features.sticky,
    featureReactEnabled: features.react,
    featureForumRolesEnabled: features.forumRoles,
    featureAnalyticsEnabled: features.analytics,
    featureStatChannelsEnabled: features.statChannels,
    featureReportsEnabled: features.reports,

    starboardThreshold: thresholds.starboard,
    starboardExternalThreshold: thresholds.starboardExternal,
    warnAutoEscalateCount: thresholds.warnAutoEscalateCount,
    warnAutoEscalateWindowDays: thresholds.warnAutoEscalateWindowDays,
    warnAutoMuteBaseMinutes: thresholds.warnAutoMuteBaseMinutes,
    badWordDeleteThreshold: thresholds.badWordDelete,
    antiSpamMaxMessages: thresholds.antiSpamMaxMessages,
    antiSpamWindowMs: thresholds.antiSpamWindowMs,
    antiSpamMuteMinutes: thresholds.antiSpamMuteMinutes,
    inviteRaidThreshold: thresholds.inviteRaidThreshold,
    inviteRaidWindowMs: thresholds.inviteRaidWindowMs,
    autoSlowmodeThreshold: thresholds.autoSlowmodeThreshold,
    autoSlowmodeWindowMs: thresholds.autoSlowmodeWindowMs,
    appealVoteThreshold: thresholds.appealVote,
    suggestionVoteThreshold: thresholds.suggestionVote,
    suggestionVoteDurationHours: thresholds.suggestionVoteDurationHours,

    starboardEmojiTiers: config.starboard.emojiTiers,
    reactDefaultEmojis: config.react.defaultEmojis,

    roleUnregisteredId: roles.utility.unregistered ?? null,
    roleCommunityId: roles.utility.community ?? null,
    roleMemberId: roles.utility.member ?? null,
    roleMutedId: roles.utility.muted ?? null,
    roleModmailHandlerId: roles.utility.modmail_handler ?? null,
    roleEventManagerId: roles.permission.eventmanager ?? null,
    roleModerationId: roles.permission.moderation ?? null,
    roleAdministrationId: roles.permission.administration ?? null,
  };
};
