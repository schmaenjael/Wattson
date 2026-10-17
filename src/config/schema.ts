import { z } from 'zod';

import { Continents, LanguageGroup, RuleCategory, StatChannelType } from '~/database/schema/enums';

/** Reusable Discord snowflake validator (17-20 digits). */
const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord snowflake (17-20 digits)');

/**
 * Secrets + infra knobs sourced from `process.env`. This schema is the single runtime authority
 * for environment configuration (the ambient `Environment` interface in types/globals.d.ts only
 * types the handful of direct `process.env.*` reads that remain).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']),
  TOKEN: z.string().min(1),
  CLIENT_ID: snowflake,
  APPLICATION_ID: snowflake,
  GUILD_ID: snowflake,
  ADMIN_USER_ID: snowflake,

  POSTGRES_DB: z.string().min(1),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  BOT_USERNAME: z.string().min(1),
  BOT_PASSWORD: z.string().min(1),

  // DB pool / retry infra (previously hardcoded in database/client.ts)
  POOL_MAX: z.coerce.number().int().positive().default(15),
  DB_MAX_RETRIES: z.coerce.number().int().positive().default(5),
  DB_RETRY_DELAY_MS: z.coerce.number().int().positive().default(5000),

  HATE_SPEECH_DETECTOR_ENDPOINT: z.string().url().optional(),

  OLLAMA_ENDPOINT: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),

  BSKY_SERVICE: z.string().optional(),
  BSKY_IDENTIFIER: z.string().optional(),
  BSKY_APP_PASSWORD: z.string().optional(),

  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),

  HAIILO_BASE_URL: z.string().url().optional(),
  HAIILO_API_KEY: z.string().optional(),

  BLOCKLIST_PATHS: z.string().optional(),

  LOGTO_ENDPOINT: z.string().url(),
  LOGTO_DEVICE_APP_ID: z.string().min(1),
  LOGTO_M2M_APP_ID: z.string().min(1),
  LOGTO_M2M_APP_SECRET: z.string().min(1),
  LOGTO_MANAGEMENT_API_RESOURCE: z.string().min(1),
});

const emojiTier = z.object({ threshold: z.number().int().positive(), emoji: z.string().min(1) });

/** Structural configuration loaded from `config/config.<NODE_ENV>.json5` at startup. */
export const configSchema = z.object({
  channels: z.object({
    notification: snowflake.optional(),
    modLog: snowflake.optional(),
    publicLog: snowflake.optional(),
    surveillanceLog: snowflake.optional(),
    reportsLog: snowflake.optional(),
    reportsTodo: snowflake.optional(),
    welcome: snowflake.optional(),
    approval: snowflake.optional(),
    courtParent: snowflake.optional(),
    starboard: snowflake.optional(),
    modmail: snowflake.optional(),
    appeal: snowflake.optional(),
    eventAnnouncement: snowflake.optional(),
    suggestion: snowflake.optional(),
    suggestionApproval: snowflake.optional(),
  }),
  features: z.object({
    welcome: z.boolean(),
    starboard: z.boolean(),
    court: z.boolean(),
    systemNotifications: z.boolean(),
    surveillance: z.boolean(),
    verificationRequiresApproval: z.boolean(),
    warnAutoMute: z.boolean(),
    harmDetection: z.boolean(),
    badWords: z.boolean(),
    linkFilter: z.boolean(),
    antiSpam: z.boolean(),
    antiHoist: z.boolean(),
    inviteTracking: z.boolean(),
    autoSlowmode: z.boolean(),
    ask: z.boolean(),
    rag: z.boolean(),
    modmail: z.boolean(),
    appeal: z.boolean(),
    suggestions: z.boolean(),
    events: z.boolean(),
    sticky: z.boolean(),
    react: z.boolean(),
    forumRoles: z.boolean(),
    analytics: z.boolean(),
    statChannels: z.boolean(),
    reports: z.boolean(),
  }),
  thresholds: z.object({
    starboard: z.number().int().positive(),
    starboardExternal: z.number().int().positive(),
    warnAutoEscalateCount: z.number().int().positive(),
    warnAutoEscalateWindowDays: z.number().int().positive(),
    warnAutoMuteBaseMinutes: z.number().int().positive(),
    badWordDelete: z.number().int().positive(),
    antiSpamMaxMessages: z.number().int().positive(),
    antiSpamWindowMs: z.number().int().positive(),
    antiSpamMuteMinutes: z.number().int().positive(),
    inviteRaidThreshold: z.number().int().positive(),
    inviteRaidWindowMs: z.number().int().positive(),
    autoSlowmodeThreshold: z.number().int().positive(),
    autoSlowmodeWindowMs: z.number().int().positive(),
    appealVote: z.number().int().positive(),
    suggestionVote: z.number().int().positive(),
    suggestionVoteDurationHours: z.number().int().positive(),
    // Round-2 policy tuning (formerly hardcoded constants)
    autoSlowmodeTiers: z.array(z.number().int().nonnegative()).min(1),
    autoSlowmodeStepDownFactor: z.number().positive(),
    muteCapMinutes: z.number().int().positive(),
    reverifyWarnDays: z.number().int().positive(),
  }),
  starboard: z.object({ emojiTiers: z.array(emojiTier).min(1) }),
  react: z.object({ defaultEmojis: z.array(z.string().min(1)).min(1) }),
  roles: z.object({
    permission: z.object({ moderation: snowflake.optional(), administration: snowflake.optional(), eventmanager: snowflake.optional() }),
    utility: z.object({
      unregistered: snowflake.optional(),
      community: snowflake.optional(),
      member: snowflake.optional(),
      muted: snowflake.optional(),
      modmail_handler: snowflake.optional(),
    }),
    // Environment-specific code -> roleId mappings; codes reference the static config/catalog.json5.
    countryMappings: z.array(z.object({ code: z.string().length(2), roleId: snowflake })),
    languageMappings: z.array(z.object({ code: z.string().length(2), roleId: snowflake })),
    forumMappings: z.array(z.object({ roleId: snowflake, channelId: snowflake })),
  }),
  pronouns: z.array(z.object({ value: z.string().min(1), label: z.string().min(1), roleId: snowflake.optional() })),
  statChannels: z.object({
    [StatChannelType.AllMembers]: snowflake.optional(),
    [StatChannelType.ActiveMembers]: snowflake.optional(),
    [StatChannelType.TotalRoles]: snowflake.optional(),
    [StatChannelType.TextChannels]: snowflake.optional(),
    [StatChannelType.MessagesToday]: snowflake.optional(),
  }),
  schedules: z.object({
    banSweep: z.string().min(1),
    muteSweep: z.string().min(1),
    warningSweep: z.string().min(1),
    suggestionSweep: z.string().min(1),
    modmailStale: z.string().min(1),
    analyticsFlush: z.string().min(1),
    eventDigest: z.string().min(1),
    reverify: z.string().min(1),
    statChannels: z.string().min(1),
  }),
  timeouts: z.object({
    ragMs: z.number().int().positive(),
    ollamaMs: z.number().int().positive(),
    summarizerMs: z.number().int().positive(),
    harmMs: z.number().int().positive(),
    healthProbeMs: z.number().int().positive(),
    logtoPollMs: z.number().int().positive(),
  }),
});

/**
 * Static reference catalog loaded from `config/catalog.json5` irrespective of NODE_ENV. Holds the
 * ISO country list and language list — identical data in every environment. Environment-specific
 * role assignments for these codes live under `configSchema.roles.{country,language}Mappings`.
 */
export const catalogSchema = z.object({
  countries: z.array(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      region: z.enum(Continents),
      chapter: z.boolean().default(false),
      enabled: z.boolean().default(false),
    })
  ),
  languages: z.array(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      group: z.enum(LanguageGroup),
      showInMenu: z.boolean().default(false),
      sortOrder: z.number().int().default(0),
    })
  ),
});

/** Static server rules loaded from `config/rules.json5` irrespective of NODE_ENV. */
export const rulesSchema = z.object({
  rules: z.array(
    z.object({
      category: z.enum(RuleCategory),
      categoryIndex: z.number().int().positive(),
      title: z.string().min(1),
      content: z.string().min(1),
      example: z.string().min(1).optional(),
    })
  ),
});

export type Env = z.infer<typeof envSchema>;
export type AppConfig = z.infer<typeof configSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type RulesConfig = z.infer<typeof rulesSchema>;
export type StarboardEmojiTier = AppConfig['starboard']['emojiTiers'][number];
