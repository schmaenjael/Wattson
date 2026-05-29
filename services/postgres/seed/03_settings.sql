-- Settings seed from production export (2026-05-20).
-- Safe to re-run: ON CONFLICT DO UPDATE overwrites with the same values.

INSERT INTO settings (
  id,
  -- Channel IDs
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
  harm_alert_channel_id,
  modmail_channel_id,
  say_log_channel_id,
  appeal_channel_id,
  event_announcement_channel_id,
  -- Feature toggles
  feature_welcome_enabled,
  feature_starboard_enabled,
  feature_court_enabled,
  feature_system_notifications_enabled,
  feature_surveillance_enabled,
  feature_verification_requires_approval,
  feature_warn_auto_mute_enabled,
  feature_harm_detection_enabled,
  feature_bad_words_enabled,
  feature_link_filter_enabled,
  feature_anti_spam_enabled,
  feature_anti_hoist_enabled,
  feature_invite_tracking_enabled,
  feature_auto_slowmode_enabled,
  -- Thresholds
  starboard_threshold,
  starboard_external_threshold,
  warn_auto_escalate_count,
  warn_auto_escalate_window_days,
  warn_auto_mute_base_minutes,
  bad_word_delete_threshold,
  anti_spam_max_messages,
  anti_spam_window_ms,
  invite_raid_threshold,
  invite_raid_window_ms,
  auto_slowmode_threshold,
  auto_slowmode_window_ms,
  appeal_vote_threshold,
  -- Appearance / defaults
  starboard_emoji_tiers,
  react_default_emojis,
  -- Timestamps
  last_event_digest_at
) VALUES (
  1,
  -- Channel IDs
  '1505668684771754009', -- notification_channel_id
  '1358461831055675623', -- public_log_channel_id
  '1505669304492883978', -- surveillance_log_channel_id
  '1358461717654409257', -- reports_log_channel_id
  '1358461729960628415', -- warnings_log_channel_id
  '1358461729960628415', -- bans_log_channel_id
  '1358461789519610077', -- welcome_channel_id
  '1358461716354302152', -- approval_channel_id
  '1358461724197388619', -- court_parent_channel_id
  '1358462032395112610', -- starboard_channel_id
  '1505669304492883978', -- harm_alert_channel_id
  '1358461747450744882', -- modmail_channel_id
  '1358461729960628415', -- say_log_channel_id
  NULL,                  -- appeal_channel_id
  NULL,                  -- event_announcement_channel_id
  -- Feature toggles
  true,  -- feature_welcome_enabled
  true,  -- feature_starboard_enabled
  true,  -- feature_court_enabled
  true,  -- feature_system_notifications_enabled
  true,  -- feature_surveillance_enabled
  true,  -- feature_verification_requires_approval
  true,  -- feature_warn_auto_mute_enabled
  true,  -- feature_harm_detection_enabled
  true,  -- feature_bad_words_enabled
  true,  -- feature_link_filter_enabled
  true,  -- feature_anti_spam_enabled
  true,  -- feature_anti_hoist_enabled
  false, -- feature_invite_tracking_enabled
  false, -- feature_auto_slowmode_enabled
  -- Thresholds
  5,     -- starboard_threshold
  10,    -- starboard_external_threshold
  3,     -- warn_auto_escalate_count
  30,    -- warn_auto_escalate_window_days
  60,    -- warn_auto_mute_base_minutes
  3,     -- bad_word_delete_threshold
  5,     -- anti_spam_max_messages
  10000, -- anti_spam_window_ms
  3,     -- invite_raid_threshold
  60000, -- invite_raid_window_ms
  10,    -- auto_slowmode_threshold
  10000, -- auto_slowmode_window_ms
  2,     -- appeal_vote_threshold
  -- Appearance / defaults
  '1:⭐,5:🌟,10:💫,25:🌠',
  '👍,👎',
  -- Timestamps
  NULL   -- last_event_digest_at
)
ON CONFLICT (id) DO UPDATE SET
  notification_channel_id             = EXCLUDED.notification_channel_id,
  public_log_channel_id               = EXCLUDED.public_log_channel_id,
  surveillance_log_channel_id         = EXCLUDED.surveillance_log_channel_id,
  reports_log_channel_id              = EXCLUDED.reports_log_channel_id,
  warnings_log_channel_id             = EXCLUDED.warnings_log_channel_id,
  bans_log_channel_id                 = EXCLUDED.bans_log_channel_id,
  welcome_channel_id                  = EXCLUDED.welcome_channel_id,
  approval_channel_id                 = EXCLUDED.approval_channel_id,
  court_parent_channel_id             = EXCLUDED.court_parent_channel_id,
  starboard_channel_id                = EXCLUDED.starboard_channel_id,
  harm_alert_channel_id               = EXCLUDED.harm_alert_channel_id,
  modmail_channel_id                  = EXCLUDED.modmail_channel_id,
  say_log_channel_id                  = EXCLUDED.say_log_channel_id,
  appeal_channel_id                   = EXCLUDED.appeal_channel_id,
  event_announcement_channel_id       = EXCLUDED.event_announcement_channel_id,
  feature_welcome_enabled             = EXCLUDED.feature_welcome_enabled,
  feature_starboard_enabled           = EXCLUDED.feature_starboard_enabled,
  feature_court_enabled               = EXCLUDED.feature_court_enabled,
  feature_system_notifications_enabled = EXCLUDED.feature_system_notifications_enabled,
  feature_surveillance_enabled        = EXCLUDED.feature_surveillance_enabled,
  feature_verification_requires_approval = EXCLUDED.feature_verification_requires_approval,
  feature_warn_auto_mute_enabled      = EXCLUDED.feature_warn_auto_mute_enabled,
  feature_harm_detection_enabled      = EXCLUDED.feature_harm_detection_enabled,
  feature_bad_words_enabled           = EXCLUDED.feature_bad_words_enabled,
  feature_link_filter_enabled         = EXCLUDED.feature_link_filter_enabled,
  feature_anti_spam_enabled           = EXCLUDED.feature_anti_spam_enabled,
  feature_anti_hoist_enabled          = EXCLUDED.feature_anti_hoist_enabled,
  feature_invite_tracking_enabled     = EXCLUDED.feature_invite_tracking_enabled,
  feature_auto_slowmode_enabled       = EXCLUDED.feature_auto_slowmode_enabled,
  starboard_threshold                 = EXCLUDED.starboard_threshold,
  starboard_external_threshold        = EXCLUDED.starboard_external_threshold,
  warn_auto_escalate_count            = EXCLUDED.warn_auto_escalate_count,
  warn_auto_escalate_window_days      = EXCLUDED.warn_auto_escalate_window_days,
  warn_auto_mute_base_minutes         = EXCLUDED.warn_auto_mute_base_minutes,
  bad_word_delete_threshold           = EXCLUDED.bad_word_delete_threshold,
  anti_spam_max_messages              = EXCLUDED.anti_spam_max_messages,
  anti_spam_window_ms                 = EXCLUDED.anti_spam_window_ms,
  invite_raid_threshold               = EXCLUDED.invite_raid_threshold,
  invite_raid_window_ms               = EXCLUDED.invite_raid_window_ms,
  auto_slowmode_threshold             = EXCLUDED.auto_slowmode_threshold,
  auto_slowmode_window_ms             = EXCLUDED.auto_slowmode_window_ms,
  appeal_vote_threshold               = EXCLUDED.appeal_vote_threshold,
  starboard_emoji_tiers               = EXCLUDED.starboard_emoji_tiers,
  react_default_emojis                = EXCLUDED.react_default_emojis,
  last_event_digest_at                = EXCLUDED.last_event_digest_at;
