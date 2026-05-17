-- Default settings seed.
-- Enables sensible feature defaults and thresholds.
-- Channel and role IDs are Discord-server-specific — configure them
-- after first boot via /config channel and /config role.
-- Safe to re-run: ON CONFLICT DO UPDATE overwrites with the same values.

INSERT INTO settings (
  id,
  -- Feature toggles
  feature_welcome_enabled,
  feature_starboard_enabled,
  feature_court_enabled,
  feature_system_notifications_enabled,
  feature_surveillance_enabled,
  feature_verification_requires_approval,
  feature_harm_detection_enabled,
  feature_bad_words_enabled,
  feature_link_filter_enabled,
  feature_anti_spam_enabled,
  feature_anti_hoist_enabled,
  -- Thresholds
  starboard_threshold,
  starboard_external_threshold,
  warn_auto_escalate_count,
  warn_auto_escalate_window_days,
  bad_word_delete_threshold,
  anti_spam_max_messages,
  anti_spam_window_ms,
  -- Starboard emoji tiers
  starboard_emoji_tiers,
  -- React defaults
  react_default_emojis
) VALUES (
  1,
  -- Features
  true,  -- feature_welcome_enabled
  true,  -- feature_starboard_enabled
  true,  -- feature_court_enabled
  true,  -- feature_system_notifications_enabled
  true,  -- feature_surveillance_enabled
  true,  -- feature_verification_requires_approval
  false, -- feature_harm_detection_enabled (requires hate-speech-detector; enable via /config after verifying connectivity)
  true,  -- feature_bad_words_enabled
  false, -- feature_link_filter_enabled
  false, -- feature_anti_spam_enabled
  false, -- feature_anti_hoist_enabled
  -- Thresholds
  3,     -- starboard_threshold
  10,    -- starboard_external_threshold
  3,     -- warn_auto_escalate_count
  30,    -- warn_auto_escalate_window_days
  4,     -- bad_word_delete_threshold
  5,     -- anti_spam_max_messages
  10000, -- anti_spam_window_ms
  -- Starboard tiers
  '1:⭐,3:🌟,5:💫,10:🌠',
  -- React defaults
  '👍,👎'
)
ON CONFLICT (id) DO UPDATE SET
  feature_welcome_enabled                = EXCLUDED.feature_welcome_enabled,
  feature_starboard_enabled              = EXCLUDED.feature_starboard_enabled,
  feature_court_enabled                  = EXCLUDED.feature_court_enabled,
  feature_system_notifications_enabled   = EXCLUDED.feature_system_notifications_enabled,
  feature_surveillance_enabled           = EXCLUDED.feature_surveillance_enabled,
  feature_verification_requires_approval = EXCLUDED.feature_verification_requires_approval,
  feature_harm_detection_enabled         = EXCLUDED.feature_harm_detection_enabled,
  feature_bad_words_enabled              = EXCLUDED.feature_bad_words_enabled,
  feature_link_filter_enabled            = EXCLUDED.feature_link_filter_enabled,
  feature_anti_spam_enabled              = EXCLUDED.feature_anti_spam_enabled,
  feature_anti_hoist_enabled             = EXCLUDED.feature_anti_hoist_enabled,
  starboard_threshold                    = EXCLUDED.starboard_threshold,
  starboard_external_threshold           = EXCLUDED.starboard_external_threshold,
  warn_auto_escalate_count               = EXCLUDED.warn_auto_escalate_count,
  warn_auto_escalate_window_days         = EXCLUDED.warn_auto_escalate_window_days,
  bad_word_delete_threshold              = EXCLUDED.bad_word_delete_threshold,
  anti_spam_max_messages                 = EXCLUDED.anti_spam_max_messages,
  anti_spam_window_ms                    = EXCLUDED.anti_spam_window_ms,
  starboard_emoji_tiers                  = EXCLUDED.starboard_emoji_tiers,
  react_default_emojis                   = EXCLUDED.react_default_emojis;
