import { boolean, check, integer, pgTable, varchar } from 'drizzle-orm/pg-core';
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
    publicLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    surveillanceLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    reportsLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    warningsLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    bansLogChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    welcomeChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    approvalChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    courtParentChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    starboardChannelId: varchar({ length: SNOWFLAKE_LENGTH }),

    // Role IDs
    roleUnregisteredId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleCommunityId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleMemberId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleModerationId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleAdministrationId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleMutedId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleObscrId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleVolterId: varchar({ length: SNOWFLAKE_LENGTH }),

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

    // Starboard appearance — comma-separated "threshold:emoji" pairs e.g. "1:⭐,5:🌟,10:💫,25:🌠"
    starboardEmojiTiers: varchar({ length: 512 }).notNull().default('1:⭐,5:🌟,10:💫,25:🌠'),

    // Harm detection
    harmAlertChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    featureHarmDetectionEnabled: boolean().notNull().default(false),

    // Profanity filter (file-based, configured via PROFANITY_LIST_PATH env var)
    // Severity 1 always skipped; severity >= badWordDeleteThreshold → immediate delete without LLM; 2–(threshold-1) → LLM check
    featureBadWordsEnabled: boolean().notNull().default(true),
    badWordDeleteThreshold: integer().notNull().default(4),

    // Link filter (blocklist file, configured via BLOCKLIST_PATHS env var)
    featureLinkFilterEnabled: boolean().notNull().default(false),

    // Modmail
    modmailChannelId: varchar({ length: SNOWFLAKE_LENGTH }),
    roleModmailHandlerId: varchar({ length: SNOWFLAKE_LENGTH }),
  },
  (t) => [check('settings_singleton', sql`${t.id} = 1`)]
);
