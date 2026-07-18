import { pgEnum } from 'drizzle-orm/pg-core';

import { ml } from './shared';

export enum RuleCategory {
  General = 'general',
  Behaviour = 'behaviour',
  Messages = 'messages',
  Voice = 'voice',
  Advertisements = 'advertisements',
  Channels = 'channels',
  ProhibitedContent = 'prohibited-content',
  UserProfiles = 'user-profiles',
  Reporting = 'reporting',
  Punishments = 'punishments',
}

export enum ReportStatus {
  Open = 'open',
  Resolved = 'resolved',
  Dismissed = 'dismissed',
}
export const reportStatusEnum = pgEnum('report_status', Object.values(ReportStatus) as [string, ...string[]]);

export enum AppealOutcome {
  Granted = 'granted',
  Denied = 'denied',
}
export const appealOutcomeEnum = pgEnum('appeal_outcome', Object.values(AppealOutcome) as [string, ...string[]]);

export enum CourtStatus {
  Open = 'open',
  Finalizing = 'finalizing',
  Resolved = 'resolved',
  Dismissed = 'dismissed',
  Escalated = 'escalated',
}
export const courtStatusEnum = pgEnum('court_status', Object.values(CourtStatus) as [string, ...string[]]);

export enum CourtVoteOption {
  Ban = 'ban',
  Warn = 'warn',
  Dismiss = 'dismiss',
}
export const courtVoteOptionEnum = pgEnum('court_vote_option', Object.values(CourtVoteOption) as [string, ...string[]]);

export enum ModmailCategory {
  Partnerships = 'partnerships',
  Other = 'other',
  Report = 'report',
  InformationRequest = 'information_request',
  VoltMembership = 'volt_membership',
  ModComplaint = 'mod_complaint',
  VerificationFollowUp = 'verification_follow_up',
}
export const modmailCategoryEnum = pgEnum('modmail_category', Object.values(ModmailCategory) as [string, ...string[]]);

export enum ModmailStatus {
  Open = 'open',
  Closed = 'closed',
  StalePending = 'stale_pending',
}
export const modmailStatusEnum = pgEnum('modmail_status', Object.values(ModmailStatus) as [string, ...string[]]);

export enum SuggestionStatus {
  Open = 'open',
  InConsideration = 'in_consideration',
  Accepted = 'accepted',
  Declined = 'declined',
}
export const suggestionStatusEnum = pgEnum('suggestion_status', Object.values(SuggestionStatus) as [string, ...string[]]);

export enum SuggestionVoteDirection {
  Up = 'up',
  Down = 'down',
}
export const suggestionVoteDirectionEnum = pgEnum('suggestion_vote_direction', Object.values(SuggestionVoteDirection) as [string, ...string[]]);

export enum StatChannelType {
  AllMembers = 'all_members',
  ActiveMembers = 'active_members',
  TotalRoles = 'total_roles',
  TextChannels = 'text_channels',
  MessagesToday = 'messages_today',
}

export enum AuditEventType {
  // Member lifecycle
  MemberJoined = 'member_joined',
  MemberLeft = 'member_left',
  MemberUsernameChanged = 'member_username_changed',
  MemberRolesChanged = 'member_roles_changed',
  // Messages
  MessageDeleted = 'message_deleted',
  MessageEdited = 'message_edited',
  // Voice
  VoiceStateChanged = 'voice_state_changed',
  // Verification
  VerificationStarted = 'verification_started',
  VerificationAnswered = 'verification_answered',
  VerificationCompleted = 'verification_completed',
  VerificationRejected = 'verification_rejected',
  // Moderation
  WarnIssued = 'warn_issued',
  WarnRevoked = 'warn_revoked',
  MuteIssued = 'mute_issued',
  MuteLifted = 'mute_lifted',
  BanIssued = 'ban_issued',
  BanLifted = 'ban_lifted',
  BanAppealFiled = 'ban_appeal_filed',
  BanAppealResolved = 'ban_appeal_resolved',
  ReportFiled = 'report_filed',
  ReportResolved = 'report_resolved',
  CourtOpened = 'court_opened',
  CourtClosed = 'court_closed',
  CourtEscalated = 'court_escalated',
  AutomodTriggered = 'automod_triggered',
  LinkFilterTriggered = 'link_filter_triggered',
  // Starboard
  StarboardEntryCreated = 'starboard_entry_created',
  ExternalPostAttempted = 'external_post_attempted',
  // Privacy
  DataDeletionRequested = 'data_deletion_requested',
  DataDeletionDenied = 'data_deletion_denied',
  DataDeletionExecuted = 'data_deletion_executed',
  VerificationRestarted = 'verification_restarted',
  ModmailOpened = 'modmail_opened',
  ModmailClosed = 'modmail_closed',
  ModmailStaleClosed = 'modmail_stale_closed',
  // Channel lockdown
  ChannelLocked = 'channel_locked',
  ChannelUnlocked = 'channel_unlocked',
  // Anti-spam
  AntiSpamTriggered = 'anti_spam_triggered',
  // Anti-hoist
  AntiHoistTriggered = 'anti_hoist_triggered',
  // Bulk message deletion
  BulkMessagesDeleted = 'bulk_messages_deleted',
}
export const auditEventTypeEnum = pgEnum('audit_event_type', Object.values(AuditEventType) as [string, ...string[]]);

export enum ExternalPlatform {
  Bsky = 'bsky',
  Instagram = 'instagram',
  Haiilo = 'haiilo',
}
export const externalPlatformEnum = pgEnum('external_platform', Object.values(ExternalPlatform) as [string, ...string[]]);

export enum ExternalPostStatus {
  Queued = 'queued',
  Posted = 'posted',
  Failed = 'failed',
}
export const externalPostStatusEnum = pgEnum('external_post_status', Object.values(ExternalPostStatus) as [string, ...string[]]);

export enum Continents {
  Asia = 'Asia',
  Europe = 'Europe',
  NorthAmerica = 'North America',
  SouthAmerica = 'South America',
  Antarctica = 'Antarctica',
  Africa = 'Africa',
  Oceania = 'Oceania',
}

export enum LanguageGroup {
  European = 'european',
  World = 'world',
}

export enum RoleMappingType {
  Country = 'country',
  Language = 'language',
  Pronouns = 'pronouns',
  Permission = 'permission',
  Utility = 'utility',
}

export enum StickyLevel {
  Info = 'info',
  Warning = 'warning',
}
export const stickyLevelEnum = pgEnum('sticky_level', Object.values(StickyLevel) as [string, ...string[]]);

export enum ModerationStatus {
  Active = 'active',
  Expired = 'expired',
  Lifted = 'lifted',
}
export const moderationStatusEnum = pgEnum('moderation_status', Object.values(ModerationStatus) as [string, ...string[]]);

// Action automod took on a message the harm detector flagged. Captured for training data.
// Defined in the `ml` schema so the training tables form a self-contained, grantable namespace.
export enum HarmSampleAction {
  Flagged = 'flagged', // detector returned a hit but below the auto-action threshold — no enforcement
  DeletedWarned = 'deleted_warned', // high confidence — message deleted and user auto-warned
}
export const harmSampleActionEnum = ml.enum('harm_sample_action', Object.values(HarmSampleAction) as [string, ...string[]]);

// Ground-truth label retro-filled onto a harm sample once a human decision settles its outcome.
export enum HarmSampleLabel {
  Harmful = 'harmful',
  NotHarmful = 'not_harmful',
}
export const harmSampleLabelEnum = ml.enum('harm_sample_label', Object.values(HarmSampleLabel) as [string, ...string[]]);

// Where a harm sample's human label came from.
export enum HarmSampleLabelSource {
  WarningRevoked = 'warning_revoked', // a moderator lifted the auto-warning -> false positive
  ReportResolved = 'report_resolved', // a human report on the same message was actioned -> true positive
  ReportDismissed = 'report_dismissed', // a human report on the same message was dismissed -> false positive
  Manual = 'manual', // labelled by hand
}
export const harmSampleLabelSourceEnum = ml.enum('harm_sample_label_source', Object.values(HarmSampleLabelSource) as [string, ...string[]]);
