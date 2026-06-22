import { boolean, check, integer, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { SNOWFLAKE_LENGTH } from './shared';

export type StarboardEmojiTier = { threshold: number; emoji: string };

/**
 * Singleton settings table. Exactly one row with id=1.
 * Seeded on first boot; edited via /config slash commands.
 */
export const settings = pgTable(
  'settings',
  {
    id: integer().primaryKey().default(1),

    // Channel IDs (nullable until configured)
    notificationChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    modLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    publicLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    surveillanceLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    reportsLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    welcomeChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    approvalChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    courtParentChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    starboardChannelId: varchar({ length: SNOWFLAKE_LENGTH }),

    // Feature toggles
    featureWelcomeEnabled: boolean().notNull().default(true),
    featureStarboardEnabled: boolean().notNull().default(false),
    featureCourtEnabled: boolean().notNull().default(false),
    featureSystemNotificationsEnabled: boolean().notNull().default(true),
    featureSurveillanceEnabled: boolean().notNull().default(true),
    featureVerificationRequiresApproval: boolean().notNull().default(true),

    // Thresholds
    starboardThreshold: integer().notNull().default(5),
    starboardExternalThreshold: integer().notNull().default(10),
    warnAutoEscalateCount: integer().notNull().default(3),
    warnAutoEscalateWindowDays: integer().notNull().default(30),
    featureWarnAutoMuteEnabled: boolean().notNull().default(false),
    warnAutoMuteBaseMinutes: integer().notNull().default(60),

    // Starboard appearance — array of {threshold, emoji} tiers sorted ascending by threshold
    starboardEmojiTiers: jsonb()
      .$type<StarboardEmojiTier[]>()
      .notNull()
      .default([
        { threshold: 1, emoji: '⭐' },
        { threshold: 5, emoji: '🌟' },
        { threshold: 10, emoji: '💫' },
        { threshold: 25, emoji: '🌠' },
      ]),

    // Harm detection
    featureHarmDetectionEnabled: boolean().notNull().default(false),

    // Profanity filter (file-based, configured via PROFANITY_LIST_PATH env var)
    featureBadWordsEnabled: boolean().notNull().default(true),
    badWordDeleteThreshold: integer().notNull().default(4),

    // Link filter (blocklist file, configured via BLOCKLIST_PATHS env var)
    featureLinkFilterEnabled: boolean().notNull().default(false),

    // Modmail
    modmailChannelId: varchar({ length: SNOWFLAKE_LENGTH }),

    // Anti-spam
    featureAntiSpamEnabled: boolean().notNull().default(false),
    // Anti-hoist
    featureAntiHoistEnabled: boolean().notNull().default(false),
    antiSpamMaxMessages: integer().notNull().default(5),
    antiSpamWindowMs: integer().notNull().default(10000),

    // React command defaults — array of emoji strings
    reactDefaultEmojis: jsonb().$type<string[]>().notNull().default(['👍', '👎']),

    // Invite tracking
    featureInviteTrackingEnabled: boolean().notNull().default(false),
    inviteRaidThreshold: integer().notNull().default(3),
    inviteRaidWindowMs: integer().notNull().default(60000),

    // Auto-slowmode
    featureAutoSlowmodeEnabled: boolean().notNull().default(false),
    autoSlowmodeThreshold: integer().notNull().default(10),
    autoSlowmodeWindowMs: integer().notNull().default(10000),

    // Ban appeals
    appealChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    appealVoteThreshold: integer().notNull().default(2),

    // Events
    eventAnnouncementChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    lastEventDigestAt: timestamp({ withTimezone: true }),

    // Suggestions
    suggestionChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    suggestionApprovalChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    suggestionVoteThreshold: integer().notNull().default(10),
    suggestionVoteDurationHours: integer().notNull().default(72),
  },
  (t) => [
    check('settings_singleton', sql`${t.id} = 1`),
    check(
      'settings_positive_thresholds',
      sql`${t.starboardThreshold} > 0
        AND ${t.starboardExternalThreshold} > 0
        AND ${t.warnAutoEscalateCount} > 0
        AND ${t.warnAutoEscalateWindowDays} > 0
        AND ${t.warnAutoMuteBaseMinutes} > 0
        AND ${t.antiSpamMaxMessages} > 0
        AND ${t.antiSpamWindowMs} > 0
        AND ${t.appealVoteThreshold} > 0
        AND ${t.suggestionVoteThreshold} > 0
        AND ${t.suggestionVoteDurationHours} > 0`
    ),
  ]
);
