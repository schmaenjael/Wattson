-- Default settings seed.
-- Enables all feature flags and sets sensible thresholds.
-- Channel and role IDs are Discord-server-specific — configure them
-- after first boot via /config channel and /config role.
-- Safe to re-run: ON CONFLICT DO UPDATE overwrites with the same values.

INSERT INTO settings (
  id,
  -- Feature toggles
  feature_welcome_enabled,
  feature_automod_enabled,
  feature_starboard_enabled,
  feature_court_enabled,
  feature_system_notifications_enabled,
  feature_surveillance_enabled,
  feature_verification_requires_approval,
  feature_harm_detection_enabled,
  -- Thresholds
  starboard_threshold,
  starboard_external_threshold,
  warn_auto_escalate_count,
  warn_auto_escalate_window_days,
  -- Starboard emoji tiers
  starboard_emoji_tiers,
  -- Automod
  automod_provider
) VALUES (
  1,
  -- Features (all on)
  true,  -- feature_welcome_enabled
  true,  -- feature_automod_enabled
  true,  -- feature_starboard_enabled
  true,  -- feature_court_enabled
  true,  -- feature_system_notifications_enabled
  true,  -- feature_surveillance_enabled
  true,  -- feature_verification_requires_approval
  false, -- feature_harm_detection_enabled (requires Ollama; enable via /config after verifying connectivity)
  -- Thresholds
  3,     -- starboard_threshold
  10,    -- starboard_external_threshold
  3,     -- warn_auto_escalate_count
  30,    -- warn_auto_escalate_window_days
  -- Starboard tiers
  '1:⭐,3:🌟,5:💫,10:🌠',
  -- Automod provider
  'regex'
)
ON CONFLICT (id) DO UPDATE SET
  feature_welcome_enabled                = EXCLUDED.feature_welcome_enabled,
  feature_automod_enabled                = EXCLUDED.feature_automod_enabled,
  feature_starboard_enabled              = EXCLUDED.feature_starboard_enabled,
  feature_court_enabled                  = EXCLUDED.feature_court_enabled,
  feature_system_notifications_enabled   = EXCLUDED.feature_system_notifications_enabled,
  feature_surveillance_enabled           = EXCLUDED.feature_surveillance_enabled,
  feature_verification_requires_approval = EXCLUDED.feature_verification_requires_approval,
  feature_harm_detection_enabled         = EXCLUDED.feature_harm_detection_enabled,
  starboard_threshold                    = EXCLUDED.starboard_threshold,
  starboard_external_threshold           = EXCLUDED.starboard_external_threshold,
  warn_auto_escalate_count               = EXCLUDED.warn_auto_escalate_count,
  warn_auto_escalate_window_days         = EXCLUDED.warn_auto_escalate_window_days,
  starboard_emoji_tiers                  = EXCLUDED.starboard_emoji_tiers,
  automod_provider                       = EXCLUDED.automod_provider;
