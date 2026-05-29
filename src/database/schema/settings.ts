import { boolean, check, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { SNOWFLAKE_LENGTH } from './shared';

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

    // Starboard appearance — comma-separated "threshold:emoji" pairs e.g. "1:⭐,5:🌟,10:💫,25:🌠"
    starboardEmojiTiers: varchar({ length: 512 }).notNull().default('1:⭐,5:🌟,10:💫,25:🌠'),

    // Harm detection
    featureHarmDetectionEnabled: boolean().notNull().default(false),

    // Profanity filter (file-based, configured via PROFANITY_LIST_PATH env var)
    // severity >= badWordDeleteThreshold → immediate delete, no LLM; severity < threshold → always LLM context check
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

    // React command defaults
    reactDefaultEmojis: varchar({ length: 512 }).notNull().default('👍,👎'),

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
  },
  (t) => [check('settings_singleton', sql`${t.id} = 1`)]
);
