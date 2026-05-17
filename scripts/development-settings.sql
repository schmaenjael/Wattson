-- Development settings seed. Run once after migrations to populate the singleton row.
-- Safe to re-run: ON CONFLICT updates all columns in place.

INSERT INTO settings (
  id,
  -- Channels
  notification_channel_id,
  public_log_channel_id,
  surveillance_log_channel_id,
  reports_log_channel_id,
  warnings_log_channel_id,
  bans_log_channel_id,
  welcome_channel_id,
  approval_channel_id,
  court_parent_channel_id,
  starboard_channel_id,
  -- Roles
  role_unregistered_id,
  role_community_id,
  role_member_id,
  role_moderation_id,
  role_administration_id,
  role_muted_id,
  role_obscr_id,
  role_volter_id,
  -- Feature toggles
  feature_welcome_enabled,
  feature_starboard_enabled,
  feature_court_enabled,
  feature_system_notifications_enabled,
  feature_surveillance_enabled,
  feature_verification_requires_approval,
  -- Thresholds
  starboard_threshold,
  starboard_external_threshold,
  warn_auto_escalate_count,
  warn_auto_escalate_window_days,
  -- Starboard appearance
  starboard_emoji_tiers,
  -- Harm detection
  harm_alert_channel_id,
  feature_harm_detection_enabled,
  -- Profanity filter
  feature_bad_words_enabled,
  bad_word_delete_threshold,
  -- Link filter
  feature_link_filter_enabled,
  -- Modmail
  modmail_channel_id,
  role_modmail_handler_id,
  -- Anti-spam
  feature_anti_spam_enabled,
  feature_anti_hoist_enabled,
  anti_spam_max_messages,
  anti_spam_window_ms,
  -- React command
  react_default_emojis,
  -- Say command log
  say_log_channel_id,
  -- Invite tracking
  feature_invite_tracking_enabled,
  invite_raid_threshold,
  invite_raid_window_ms,
  -- Auto-slowmode
  feature_auto_slowmode_enabled,
  auto_slowmode_threshold,
  auto_slowmode_window_ms,
  -- Ban appeals
  appeal_channel_id,
  appeal_vote_threshold
) VALUES (
  1,
  -- Channels
  '1504071973444124774',
  '1500536563988430950',
  '1504071973444124774',
  '1504071973444124774',
  '1504071973444124774',
  '1504071973444124774',
  '734420172479397929',
  '1504071973444124774',
  '1504852121097342986',
  '1504072740079009823',
  -- Roles
  '665184791594795009',
  '1505166312542961674',
  '1505166094279905393',
  '1505166143722356807',
  '734413243128348683',
  '1505165626933772469',
  NULL,
  '1505166094279905393',
  -- Feature toggles
  true,
  true,
  true,
  true,
  true,
  true,
  -- Thresholds
  3,
  10,
  3,
  30,
  -- Starboard appearance
  '1:⭐,3:🌟,5:💫,10:🌠',
  -- Harm detection
  '1504071973444124774',
  true,
  -- Profanity filter
  true,
  4,
  -- Link filter
  true,
  -- Modmail
  '1504852121097342986',
  '1505166143722356807',
  -- Anti-spam
  true,
  true,
  5,
  10000,
  -- React command
  '👍,👎',
  -- Say command log
  '1504071973444124774',
  -- Invite tracking
  false,
  3,
  60000,
  -- Auto-slowmode
  false,
  10,
  10000,
  -- Ban appeals
  NULL,
  2
)
ON CONFLICT (id) DO UPDATE SET
  notification_channel_id            = EXCLUDED.notification_channel_id,
  public_log_channel_id              = EXCLUDED.public_log_channel_id,
  surveillance_log_channel_id        = EXCLUDED.surveillance_log_channel_id,
  reports_log_channel_id             = EXCLUDED.reports_log_channel_id,
  warnings_log_channel_id            = EXCLUDED.warnings_log_channel_id,
  bans_log_channel_id                = EXCLUDED.bans_log_channel_id,
  welcome_channel_id                 = EXCLUDED.welcome_channel_id,
  approval_channel_id                = EXCLUDED.approval_channel_id,
  court_parent_channel_id            = EXCLUDED.court_parent_channel_id,
  starboard_channel_id               = EXCLUDED.starboard_channel_id,
  role_unregistered_id               = EXCLUDED.role_unregistered_id,
  role_community_id                  = EXCLUDED.role_community_id,
  role_member_id                     = EXCLUDED.role_member_id,
  role_moderation_id                 = EXCLUDED.role_moderation_id,
  role_administration_id             = EXCLUDED.role_administration_id,
  role_muted_id                      = EXCLUDED.role_muted_id,
  role_obscr_id                      = EXCLUDED.role_obscr_id,
  role_volter_id                     = EXCLUDED.role_volter_id,
  feature_welcome_enabled            = EXCLUDED.feature_welcome_enabled,
  feature_starboard_enabled          = EXCLUDED.feature_starboard_enabled,
  feature_court_enabled              = EXCLUDED.feature_court_enabled,
  feature_system_notifications_enabled = EXCLUDED.feature_system_notifications_enabled,
  feature_surveillance_enabled       = EXCLUDED.feature_surveillance_enabled,
  feature_verification_requires_approval = EXCLUDED.feature_verification_requires_approval,
  starboard_threshold                = EXCLUDED.starboard_threshold,
  starboard_external_threshold       = EXCLUDED.starboard_external_threshold,
  warn_auto_escalate_count           = EXCLUDED.warn_auto_escalate_count,
  warn_auto_escalate_window_days     = EXCLUDED.warn_auto_escalate_window_days,
  starboard_emoji_tiers              = EXCLUDED.starboard_emoji_tiers,
  harm_alert_channel_id              = EXCLUDED.harm_alert_channel_id,
  feature_harm_detection_enabled     = EXCLUDED.feature_harm_detection_enabled,
  feature_bad_words_enabled          = EXCLUDED.feature_bad_words_enabled,
  bad_word_delete_threshold          = EXCLUDED.bad_word_delete_threshold,
  feature_link_filter_enabled        = EXCLUDED.feature_link_filter_enabled,
  modmail_channel_id                 = EXCLUDED.modmail_channel_id,
  role_modmail_handler_id            = EXCLUDED.role_modmail_handler_id,
  feature_anti_spam_enabled          = EXCLUDED.feature_anti_spam_enabled,
  feature_anti_hoist_enabled         = EXCLUDED.feature_anti_hoist_enabled,
  anti_spam_max_messages             = EXCLUDED.anti_spam_max_messages,
  anti_spam_window_ms                = EXCLUDED.anti_spam_window_ms,
  react_default_emojis               = EXCLUDED.react_default_emojis,
  say_log_channel_id                 = EXCLUDED.say_log_channel_id,
  feature_invite_tracking_enabled    = EXCLUDED.feature_invite_tracking_enabled,
  invite_raid_threshold              = EXCLUDED.invite_raid_threshold,
  invite_raid_window_ms              = EXCLUDED.invite_raid_window_ms,
  feature_auto_slowmode_enabled      = EXCLUDED.feature_auto_slowmode_enabled,
  auto_slowmode_threshold            = EXCLUDED.auto_slowmode_threshold,
  auto_slowmode_window_ms            = EXCLUDED.auto_slowmode_window_ms,
  appeal_channel_id                  = EXCLUDED.appeal_channel_id,
  appeal_vote_threshold              = EXCLUDED.appeal_vote_threshold;
