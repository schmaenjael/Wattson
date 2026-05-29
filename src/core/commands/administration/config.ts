import { ApplicationCommandType, ChannelType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { getSchedulables, SCHEDULABLE_CHOICES } from '~/core/loaders/loadSchedulables';
import { upsertSchedulableConfig } from '~/database';
import {
  getSettings,
  updateSettings,
  upsertRoleMapping,
  deleteRoleMapping,
  listRoleMappings,
  getVerificationCountryOptions,
  getEuropeanLanguageOptions,
  getWorldLanguageOptions,
  insertForumRoleMapping,
  deleteForumRoleMapping,
  listForumRoleMappings,
  type Settings,
  RoleMappingType,
} from '~/database';
import { handlePaginatedEmbeds } from '~/core/components';

type ChannelKey =
  | 'notificationChannelId'
  | 'modLogChannelId'
  | 'publicLogChannelId'
  | 'surveillanceLogChannelId'
  | 'reportsLogChannelId'
  | 'welcomeChannelId'
  | 'approvalChannelId'
  | 'courtParentChannelId'
  | 'starboardChannelId'
  | 'modmailChannelId'
  | 'eventAnnouncementChannelId';

const CHANNEL_CHOICES: { name: string; value: ChannelKey }[] = [
  { name: 'System notifications', value: 'notificationChannelId' },
  { name: 'Moderation log (internal)', value: 'modLogChannelId' },
  { name: 'Public moderation log', value: 'publicLogChannelId' },
  { name: 'Surveillance log', value: 'surveillanceLogChannelId' },
  { name: 'Reports log', value: 'reportsLogChannelId' },
  { name: 'Welcome', value: 'welcomeChannelId' },
  { name: 'Verification approval', value: 'approvalChannelId' },
  { name: 'Court parent', value: 'courtParentChannelId' },
  { name: 'Starboard', value: 'starboardChannelId' },
  { name: 'Modmail (mod-only thread parent)', value: 'modmailChannelId' },
  { name: 'Event announcements', value: 'eventAnnouncementChannelId' },
];

type FeatureKey =
  | 'featureWelcomeEnabled'
  | 'featureBadWordsEnabled'
  | 'featureStarboardEnabled'
  | 'featureCourtEnabled'
  | 'featureSystemNotificationsEnabled'
  | 'featureSurveillanceEnabled'
  | 'featureVerificationRequiresApproval'
  | 'featureHarmDetectionEnabled'
  | 'featureLinkFilterEnabled'
  | 'featureAntiSpamEnabled'
  | 'featureAntiHoistEnabled'
  | 'featureWarnAutoMuteEnabled';

const FEATURE_CHOICES: { name: string; value: FeatureKey }[] = [
  { name: 'Welcome', value: 'featureWelcomeEnabled' },
  { name: 'Bad words filter', value: 'featureBadWordsEnabled' },
  { name: 'Starboard', value: 'featureStarboardEnabled' },
  { name: 'Court', value: 'featureCourtEnabled' },
  { name: 'System notifications', value: 'featureSystemNotificationsEnabled' },
  { name: 'Surveillance', value: 'featureSurveillanceEnabled' },
  { name: 'Verification requires approval', value: 'featureVerificationRequiresApproval' },
  { name: 'Harm detection (LLM)', value: 'featureHarmDetectionEnabled' },
  { name: 'Link filter (blocklist)', value: 'featureLinkFilterEnabled' },
  { name: 'Anti-spam (per-user rate limiting)', value: 'featureAntiSpamEnabled' },
  { name: 'Anti-hoist (strip hoisting prefixes from nicknames)', value: 'featureAntiHoistEnabled' },
  { name: 'Warn auto-mute (mute on warning threshold)', value: 'featureWarnAutoMuteEnabled' },
];

type StringKey = 'reactDefaultEmojis';
const STRING_CHOICES: { name: string; value: StringKey }[] = [
  { name: 'Default react emojis (comma or space separated)', value: 'reactDefaultEmojis' },
];

type ThresholdKey =
  | 'starboardThreshold'
  | 'starboardExternalThreshold'
  | 'warnAutoEscalateCount'
  | 'warnAutoEscalateWindowDays'
  | 'badWordDeleteThreshold'
  | 'antiSpamMaxMessages'
  | 'antiSpamWindowMs'
  | 'warnAutoMuteBaseMinutes';
const THRESHOLD_CHOICES: { name: string; value: ThresholdKey }[] = [
  { name: 'Starboard threshold (stars)', value: 'starboardThreshold' },
  { name: 'Starboard external-post threshold (stars)', value: 'starboardExternalThreshold' },
  { name: 'Warn auto-escalate count', value: 'warnAutoEscalateCount' },
  { name: 'Warn auto-escalate window (days)', value: 'warnAutoEscalateWindowDays' },
  { name: 'Bad-word delete threshold (severity ≥ N → immediate delete)', value: 'badWordDeleteThreshold' },
  { name: 'Anti-spam: max messages per window', value: 'antiSpamMaxMessages' },
  { name: 'Anti-spam: window size (ms)', value: 'antiSpamWindowMs' },
  { name: 'Warn auto-mute: base duration (minutes)', value: 'warnAutoMuteBaseMinutes' },
];

const ALL_FEATURE_KEYS: FeatureKey[] = [
  'featureWelcomeEnabled',
  'featureBadWordsEnabled',
  'featureStarboardEnabled',
  'featureCourtEnabled',
  'featureSystemNotificationsEnabled',
  'featureSurveillanceEnabled',
  'featureVerificationRequiresApproval',
  'featureHarmDetectionEnabled',
  'featureLinkFilterEnabled',
  'featureAntiSpamEnabled',
  'featureAntiHoistEnabled',
  'featureWarnAutoMuteEnabled',
];

const PERMISSION_CHOICES = [
  { name: 'Unregistered', value: 'unregistered' },
  { name: 'Community', value: 'community' },
  { name: 'Member', value: 'member' },
  { name: 'Event Manager', value: 'eventmanager' },
  { name: 'Moderation', value: 'moderation' },
  { name: 'Administration', value: 'administration' },
] as const;

const UTILITY_CHOICES = [
  { name: 'Muted', value: 'muted' },
  { name: 'Modmail handler', value: 'modmail_handler' },
] as const;

const PRONOUN_CHOICES = [
  { name: 'she/her', value: 'she' },
  { name: 'he/him', value: 'he' },
  { name: 'they/them', value: 'they' },
  { name: 'any', value: 'any' },
  { name: 'ask me', value: 'ask' },
] as const;

const ROLE_TYPE_CHOICES = [
  { name: 'Country', value: RoleMappingType.Country },
  { name: 'Language', value: RoleMappingType.Language },
  { name: 'Pronouns', value: RoleMappingType.Pronouns },
  { name: 'Permission', value: RoleMappingType.Permission },
  { name: 'Utility', value: RoleMappingType.Utility },
] as const;

const ch = (id: string | null | undefined) => (id ? `<#${id}>` : '—');
const ro = (id: string | null | undefined) => (id ? `<@&${id}>` : '—');
const bool = (v: boolean) => (v ? '🟢 enabled' : '⚫ disabled');

interface FeatureDef {
  label: string;
  description: string;
  enabled: (s: Settings) => boolean;
  warnings: (s: Settings) => string[];
}

const FEATURES: FeatureDef[] = [
  {
    label: 'Welcome',
    description: 'Sends a greeting embed when a new member completes verification.',
    enabled: (s) => s.featureWelcomeEnabled,
    warnings: (s) => (!s.welcomeChannelId ? ['`welcomeChannelId` not set — welcome messages will be skipped'] : []),
  },
  {
    label: 'Bad Words Filter',
    description: 'Scans messages against a file-based profanity list and deletes or escalates to LLM based on severity.',
    enabled: (s) => s.featureBadWordsEnabled,
    warnings: () => [],
  },
  {
    label: 'Starboard',
    description: 'Reposts highly-reacted messages to a dedicated starboard channel.',
    enabled: (s) => s.featureStarboardEnabled,
    warnings: (s) => (!s.starboardChannelId ? ['`starboardChannelId` not set — entries cannot be posted'] : []),
  },
  {
    label: 'Court',
    description: 'Opens private threads for formal moderation cases with a structured verdict flow.',
    enabled: (s) => s.featureCourtEnabled,
    warnings: (s) => (!s.courtParentChannelId ? ['`courtParentChannelId` not set — threads cannot be created'] : []),
  },
  {
    label: 'System Notifications',
    description: 'Posts startup events and error alerts to a designated notification channel.',
    enabled: (s) => s.featureSystemNotificationsEnabled,
    warnings: (s) => (!s.notificationChannelId ? ['`notificationChannelId` not set — alerts will be silently dropped'] : []),
  },
  {
    label: 'Surveillance',
    description: 'Logs message edits, deletions, voice state changes, and role changes.',
    enabled: (s) => s.featureSurveillanceEnabled,
    warnings: (s) => (!s.surveillanceLogChannelId ? ['`surveillanceLogChannelId` not set — events will not be logged'] : []),
  },
  {
    label: 'Verification Requires Approval',
    description: 'Holds new member verification in a queue until a moderator manually approves.',
    enabled: (s) => s.featureVerificationRequiresApproval,
    warnings: (s) =>
      s.featureVerificationRequiresApproval && !s.approvalChannelId ? ['`approvalChannelId` not set — pending verifications will not be posted'] : [],
  },
  {
    label: 'Harm Detection (LLM)',
    description: 'Uses an Ollama LLM to score messages for harmful content and posts alerts to the surveillance log.',
    enabled: (s) => s.featureHarmDetectionEnabled,
    warnings: (s) => [
      ...(!s.surveillanceLogChannelId ? ['`surveillanceLogChannelId` not set — harm alerts will not be delivered'] : []),
      ...(s.featureHarmDetectionEnabled && !process.env.OLLAMA_MODEL ? ['`OLLAMA_MODEL` env var not set — LLM evaluation will be skipped'] : []),
    ],
  },
  {
    label: 'Link Filter (Blocklist)',
    description: 'Deletes messages containing domains from Pi-hole-format blocklists loaded at startup.',
    enabled: (s) => s.featureLinkFilterEnabled,
    warnings: () => [],
  },
  {
    label: 'Anti-Spam',
    description: 'Mutes users who exceed the message rate limit in a single channel within the configured window.',
    enabled: (s) => s.featureAntiSpamEnabled,
    warnings: (s) => (!s.roleMutedId ? ['`roleMutedId` not set — auto-mute cannot be applied'] : []),
  },
  {
    label: 'Anti-Hoist',
    description: 'Strips leading special characters from nicknames and issues an automated warning to the user.',
    enabled: (s) => s.featureAntiHoistEnabled,
    warnings: () => [],
  },
  {
    label: 'Warn Auto-mute',
    description:
      'Automatically mutes users when their non-expired active warning count crosses thresholds. Duration scales with active warning count.',
    enabled: (s) => s.featureWarnAutoMuteEnabled,
    warnings: (s) => (!s.roleMutedId ? ['`roleMutedId` not set — auto-mute cannot be applied'] : []),
  },
];

const buildConfigPages = (s: Settings): EmbedBuilder[] => {
  const color = appFeatureMap[AppFeature.System].color;

  const activeWarnings = FEATURES.flatMap((f) => (f.enabled(s) ? f.warnings(s).map((w) => `**${f.label}:** ${w}`) : []));

  const featuresPage = new EmbedBuilder()
    .setColor(color)
    .setTitle('Wattson Config — Features (1/4)')
    .setDescription('Feature toggles, documentation, and health warnings for enabled features.')
    .addFields({ name: 'Status', value: FEATURES.map((f) => `${bool(f.enabled(s))} **${f.label}**`).join('\n') });

  if (activeWarnings.length > 0) {
    featuresPage.addFields({ name: '⚠️ Configuration Warnings', value: activeWarnings.map((w) => `> ${w}`).join('\n') });
  }

  featuresPage.setFooter({ text: 'Page 1 of 4 · use /config feature to toggle' }).setTimestamp();

  const channelsPage = new EmbedBuilder()
    .setColor(color)
    .setTitle('Wattson Config — Channels (2/4)')
    .setDescription('Channel mappings for each bot subsystem. Use `/config channel` to set or clear.')
    .addFields(
      {
        name: 'Log Channels',
        value: [
          `**System notifications:** ${ch(s.notificationChannelId)}`,
          `**Moderation log (internal):** ${ch(s.modLogChannelId)}`,
          `**Public moderation log:** ${ch(s.publicLogChannelId)}`,
          `**Surveillance log:** ${ch(s.surveillanceLogChannelId)}`,
          `**Reports log:** ${ch(s.reportsLogChannelId)}`,
        ].join('\n'),
      },
      {
        name: 'Feature Channels',
        value: [
          `**Welcome:** ${ch(s.welcomeChannelId)}`,
          `**Verification approval:** ${ch(s.approvalChannelId)}`,
          `**Court parent:** ${ch(s.courtParentChannelId)}`,
          `**Starboard:** ${ch(s.starboardChannelId)}`,
          `**Modmail (mod-only):** ${ch(s.modmailChannelId)}`,
          `**Event announcements:** ${ch(s.eventAnnouncementChannelId)}`,
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Page 2 of 4 · use /config channel to set' })
    .setTimestamp();

  const rolesPage = new EmbedBuilder()
    .setColor(color)
    .setTitle('Wattson Config — Roles (3/4)')
    .setDescription('Role mappings that control bot permission tiers. Use `/config role` to set or clear.')
    .addFields(
      {
        name: 'Permission Hierarchy',
        value: [
          `**Unregistered:** ${ro(s.roleUnregisteredId)}\n-# New members before completing verification — very limited access`,
          `**Community:** ${ro(s.roleCommunityId)}\n-# Verified members without Volt membership`,
          `**Member:** ${ro(s.roleMemberId)}\n-# Active Volt Europa members`,
          `**Event Manager:** ${ro(s.roleEventManagerId)}\n-# Grants access to create and manage server events`,
          `**Moderation:** ${ro(s.roleModerationId)}\n-# Grants access to warn, ban, court, reports, and stats commands`,
          `**Administration:** ${ro(s.roleAdministrationId)}\n-# Grants full bot configuration access via /config`,
        ].join('\n'),
      },
      {
        name: 'Utility Roles',
        value: [
          `**Muted:** ${ro(s.roleMutedId)}\n-# Applied to muted members; overrides channel send permissions`,
          `**Modmail handler:** ${ro(s.roleModmailHandlerId)}\n-# Pinged when a new modmail is opened`,
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Page 3 of 4 · use /config role to set' })
    .setTimestamp();

  const thresholdsPage = new EmbedBuilder()
    .setColor(color)
    .setTitle('Wattson Config — Thresholds & Filters (4/4)')
    .addFields(
      {
        name: 'Moderation Thresholds',
        value: [
          `**Warn auto-escalate:** ${s.warnAutoEscalateCount} active warnings within ${s.warnAutoEscalateWindowDays} days triggers escalation`,
          `**Warn auto-mute:** ${bool(s.featureWarnAutoMuteEnabled)} · base ${s.warnAutoMuteBaseMinutes}m · 1 warn = grace, 2 warns = base/4, N≥3 warns = base×2^(N−3), cap 14d`,
        ].join('\n'),
      },
      {
        name: 'Starboard',
        value: [
          `**Post threshold:** ${s.starboardThreshold} ⭐`,
          `**External post threshold:** ${s.starboardExternalThreshold} ⭐`,
          `**Emoji tiers:** \`${s.starboardEmojiTiers}\`\n-# Format: threshold:emoji pairs, comma-separated`,
        ].join('\n'),
      },
      {
        name: 'Bad Words Filter',
        value: [
          `**Status:** ${bool(s.featureBadWordsEnabled)}`,
          `**Delete threshold:** severity ≥ ${s.badWordDeleteThreshold} → immediate delete (no LLM)`,
          `**Word list dir:** \`config/bad-words/\` (all .txt files)\n-# Severity 1 always skipped, 2–(N-1) → LLM check`,
        ].join('\n'),
      },
      {
        name: 'Harm Detection',
        value: [
          `**Status:** ${bool(s.featureHarmDetectionEnabled)}`,
          `**Alerts route to:** surveillance log channel\n-# Requires OLLAMA_MODEL env var to be set`,
        ].join('\n'),
      },
      {
        name: 'Link Filter',
        value: [
          `**Status:** ${bool(s.featureLinkFilterEnabled)}`,
          `**Blocklist dir:** \`config/blocklists/\` (all .txt files)\n-# Drop Pi-hole-format .txt files into the directory; changes require restart`,
        ].join('\n'),
      },
      {
        name: 'Anti-Spam',
        value: [
          `**Status:** ${bool(s.featureAntiSpamEnabled)}`,
          `**Max messages:** ${s.antiSpamMaxMessages} per window`,
          `**Window:** ${s.antiSpamWindowMs}ms\n-# Auto-mute (10 min) applied when threshold exceeded; requires \`roleMutedId\` set`,
        ].join('\n'),
      },
      {
        name: 'React',
        value: `**Default emojis:** \`${s.reactDefaultEmojis}\`\n-# Overridable per \`/react\` invocation · use \`/config string\` to change`,
      }
    )
    .setFooter({ text: 'Page 4 of 4 · use /config threshold or /config string to adjust values' })
    .setTimestamp();

  return [featuresPage, channelsPage, rolesPage, thresholdsPage];
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.System,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Administration],
  middleware: [],
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Wattson runtime settings.')
    .addSubcommand((s) => s.setName('show').setDescription('Show all current settings.'))
    .addSubcommand((s) =>
      s
        .setName('channel')
        .setDescription('Set a channel mapping.')
        .addStringOption((o) =>
          o
            .setName('key')
            .setDescription('Which channel to set')
            .setRequired(true)
            .addChoices(...CHANNEL_CHOICES)
        )
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('The channel (leave blank to unset)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('role')
        .setDescription('Configure role mappings (permission levels, community groups, and answer roles).')
        .addSubcommand((s) =>
          s
            .setName('permission')
            .setDescription('Set a role for a permission level (unregistered, community, member, moderation, administration).')
            .addStringOption((o) =>
              o
                .setName('key')
                .setDescription('Permission level')
                .setRequired(true)
                .addChoices(...PERMISSION_CHOICES)
            )
            .addRoleOption((o) => o.setName('role').setDescription('The role (leave blank to unset)').setRequired(false))
        )
        .addSubcommand((s) =>
          s
            .setName('utility')
            .setDescription('Set a utility role (muted, modmail handler).')
            .addStringOption((o) =>
              o
                .setName('key')
                .setDescription('Utility role')
                .setRequired(true)
                .addChoices(...UTILITY_CHOICES)
            )
            .addRoleOption((o) => o.setName('role').setDescription('The role (leave blank to unset)').setRequired(false))
        )
        .addSubcommand((s) =>
          s
            .setName('country')
            .setDescription('Map a country/region code to a Discord role.')
            .addStringOption((o) => o.setName('code').setDescription('Country or region code (e.g. de, fr)').setRequired(true).setAutocomplete(true))
            .addRoleOption((o) => o.setName('role').setDescription('The Discord role to assign').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('language')
            .setDescription('Map a language code to a Discord role.')
            .addStringOption((o) => o.setName('code').setDescription('Language code (e.g. en, fr, de)').setRequired(true).setAutocomplete(true))
            .addRoleOption((o) => o.setName('role').setDescription('The Discord role to assign').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('pronouns')
            .setDescription('Map a pronoun choice to a Discord role.')
            .addStringOption((o) =>
              o
                .setName('value')
                .setDescription('Pronoun choice')
                .setRequired(true)
                .addChoices(...PRONOUN_CHOICES)
            )
            .addRoleOption((o) => o.setName('role').setDescription('The Discord role to assign').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a role mapping.')
            .addStringOption((o) =>
              o
                .setName('type')
                .setDescription('Mapping category')
                .setRequired(true)
                .addChoices(...ROLE_TYPE_CHOICES)
            )
            .addStringOption((o) => o.setName('value').setDescription('Mapping value to remove').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((s) =>
          s
            .setName('list')
            .setDescription('List configured role mappings.')
            .addStringOption((o) =>
              o
                .setName('type')
                .setDescription('Filter by category (optional)')
                .setRequired(false)
                .addChoices(...ROLE_TYPE_CHOICES)
            )
        )
    )
    .addSubcommand((s) =>
      s
        .setName('feature')
        .setDescription('Enable or disable a feature.')
        .addStringOption((o) =>
          o
            .setName('key')
            .setDescription('Which feature')
            .setRequired(true)
            .addChoices(...FEATURE_CHOICES)
        )
        .addBooleanOption((o) => o.setName('enabled').setDescription('enable/disable').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('threshold')
        .setDescription('Set a numeric threshold.')
        .addStringOption((o) =>
          o
            .setName('key')
            .setDescription('Which threshold')
            .setRequired(true)
            .addChoices(...THRESHOLD_CHOICES)
        )
        .addIntegerOption((o) => o.setName('value').setDescription('New value (≥0)').setMinValue(0).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('starboard')
        .setDescription('Configure starboard appearance.')
        .addStringOption((o) =>
          o
            .setName('emoji-tiers')
            .setDescription('Comma-separated "threshold:emoji" pairs e.g. "1:⭐,5:🌟,10:💫,25:🌠"')
            .setRequired(true)
            .setMaxLength(512)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('string')
        .setDescription('Set a string config value.')
        .addStringOption((o) =>
          o
            .setName('key')
            .setDescription('Which setting')
            .setRequired(true)
            .addChoices(...STRING_CHOICES)
        )
        .addStringOption((o) => o.setName('value').setDescription('New value').setRequired(true).setMaxLength(512))
    )
    .addSubcommand((s) =>
      s
        .setName('enable-all')
        .setDescription('Enable or disable every feature flag at once.')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable all features').setRequired(true))
    )
    .addSubcommandGroup((group) =>
      group
        .setName('forum')
        .setDescription('Map forum thread channels to roles (members get auto-added when role is assigned).')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add a mapping: role → forum thread.')
            .addRoleOption((o) => o.setName('role').setDescription('The Discord role').setRequired(true))
            .addChannelOption((o) =>
              o
                .setName('channel')
                .setDescription('The forum thread (post) to map to this role')
                .addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread)
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a mapping: role → forum thread.')
            .addRoleOption((o) => o.setName('role').setDescription('The Discord role').setRequired(true))
            .addStringOption((o) => o.setName('channel').setDescription('Forum thread channel ID').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((s) => s.setName('list').setDescription('List all forum role mappings.'))
    )
    .addSubcommand((s) =>
      s
        .setName('schedulable')
        .setDescription('Reschedule a background job with a new cron expression.')
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('Which schedulable to configure')
            .setRequired(true)
            .addChoices(...SCHEDULABLE_CHOICES)
        )
        .addStringOption((o) =>
          o.setName('cron').setDescription('New cron expression (e.g. "0 * * * *" for hourly)').setRequired(true).setMaxLength(128)
        )
    ),

  async autocomplete(_client, interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand(false);
    const focused = interaction.options.getFocused(true);
    const query = focused.value.toLowerCase();

    if (group === 'forum' && sub === 'remove' && focused.name === 'channel') {
      const roleId = interaction.options.get('role')?.value as string | undefined;
      const mappings = await listForumRoleMappings();
      const relevant = roleId ? mappings.filter((m) => m.roleId === roleId) : mappings;
      const seen = new Set<string>();
      const choices = relevant
        .filter((m) => {
          if (seen.has(m.channelId)) return false;
          seen.add(m.channelId);
          return m.channelId.includes(query);
        })
        .slice(0, 25)
        .map((m) => {
          const resolved = interaction.guild?.channels.cache.get(m.channelId);
          return { name: resolved ? `${resolved.name} (${m.channelId})` : m.channelId, value: m.channelId };
        });
      await interaction.respond(choices);
      return;
    }

    if (sub === 'country') {
      const options = await getVerificationCountryOptions();
      const filtered = options
        .filter((o) => o.label.toLowerCase().includes(query) || o.value.toLowerCase().includes(query))
        .slice(0, 25)
        .map((o) => ({ name: `${o.label} (${o.value})`, value: o.value }));
      await interaction.respond(filtered);
      return;
    }

    if (sub === 'language') {
      const [eu, world] = await Promise.all([getEuropeanLanguageOptions(), getWorldLanguageOptions()]);
      const all = [...eu, ...world];
      const filtered = all
        .filter((o) => o.label.toLowerCase().includes(query) || o.value.toLowerCase().includes(query))
        .slice(0, 25)
        .map((o) => ({ name: `${o.label} (${o.value})`, value: o.value }));
      await interaction.respond(filtered);
      return;
    }

    if (sub === 'remove') {
      const type = interaction.options.getString('type') as RoleMappingType | null;
      if (!type) {
        await interaction.respond([]);
        return;
      }
      const rows = await listRoleMappings(type);
      const filtered = rows
        .filter((r) => r.value.includes(query))
        .slice(0, 25)
        .map((r) => ({ name: r.value, value: r.value }));
      await interaction.respond(filtered);
      return;
    }

    await interaction.respond([]);
  },

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand(true);

    if (group === 'forum') {
      if (sub === 'add') {
        const role = interaction.options.getRole('role', true);
        const channelOption = interaction.options.getChannel('channel', true);
        const thread = await interaction.guild?.channels.fetch(channelOption.id).catch(() => null);

        if (!thread?.isThread() || thread.parent?.type !== ChannelType.GuildForum) {
          await interaction.reply({ content: 'Channel must be a thread inside a forum channel.', flags: MessageFlags.Ephemeral });
          return;
        }

        await insertForumRoleMapping({ channelId: thread.id, roleId: role.id });

        const members = interaction.guild?.roles.cache.get(role.id)?.members;
        let synced = 0;
        if (members) {
          await Promise.allSettled(
            members.map(async (member) => {
              await thread.members.add(member.id).catch(() => null);
              synced++;
            })
          );
        }

        await interaction.reply({
          content: `Mapped ${role} → <#${thread.id}>. Added ${synced} existing role holder(s) to the thread.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === 'remove') {
        const role = interaction.options.getRole('role', true);
        const channelId = interaction.options.getString('channel', true).trim();
        const deleted = await deleteForumRoleMapping(channelId, role.id);
        await interaction.reply({
          content: deleted ? `Removed mapping ${role} → <#${channelId}>.` : `No mapping found for ${role} → \`${channelId}\`.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === 'list') {
        const mappings = await listForumRoleMappings();
        const color = appFeatureMap[command.options.feature].color;
        const embed = new EmbedBuilder().setColor(color).setTitle('Forum Role Mappings').setTimestamp();

        if (mappings.length === 0) {
          embed.setDescription('*No mappings configured.*');
        } else {
          const grouped = new Map<string, typeof mappings>();
          for (const m of mappings) {
            const bucket = grouped.get(m.channelId) ?? [];
            bucket.push(m);
            grouped.set(m.channelId, bucket);
          }
          for (const [channelId, entries] of grouped) {
            embed.addFields({ name: `<#${channelId}>`, value: entries.map((e) => `<@&${e.roleId}>`).join('\n') });
          }
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      return;
    }

    if (group === 'role') {
      if (sub === 'permission') {
        const key = interaction.options.getString('key', true);
        const role = interaction.options.getRole('role', false);
        if (role) {
          await upsertRoleMapping({ type: RoleMappingType.Permission, value: key, roleId: role.id });
          await interaction.reply({ content: `Set **permission:${key}** → ${role}.`, flags: MessageFlags.Ephemeral });
        } else {
          const deleted = await deleteRoleMapping(RoleMappingType.Permission, key);
          await interaction.reply({
            content: deleted ? `Cleared **permission:${key}**.` : `No mapping for **permission:${key}**.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      if (sub === 'utility') {
        const key = interaction.options.getString('key', true);
        const role = interaction.options.getRole('role', false);
        if (role) {
          await upsertRoleMapping({ type: RoleMappingType.Utility, value: key, roleId: role.id });
          await interaction.reply({ content: `Set **utility:${key}** → ${role}.`, flags: MessageFlags.Ephemeral });
        } else {
          const deleted = await deleteRoleMapping(RoleMappingType.Utility, key);
          await interaction.reply({
            content: deleted ? `Cleared **utility:${key}**.` : `No mapping for **utility:${key}**.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      if (sub === 'country') {
        const code = interaction.options.getString('code', true).toLowerCase().trim();
        const role = interaction.options.getRole('role', true);
        const options = await getVerificationCountryOptions();
        const valid = options.some((o) => o.value.toLowerCase() === code);
        if (!valid) {
          await interaction.reply({
            content: `\`${code}\` is not a valid country/region code. Use the autocomplete to pick a valid value.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await upsertRoleMapping({ type: RoleMappingType.Country, value: code, roleId: role.id });
        await interaction.reply({ content: `Mapped **country:${code}** → ${role}.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (sub === 'language') {
        const code = interaction.options.getString('code', true).toLowerCase().trim();
        const role = interaction.options.getRole('role', true);
        const [eu, world] = await Promise.all([getEuropeanLanguageOptions(), getWorldLanguageOptions()]);
        const valid = [...eu, ...world].some((o) => o.value.toLowerCase() === code);
        if (!valid) {
          await interaction.reply({
            content: `\`${code}\` is not a valid language code. Use the autocomplete to pick a valid value.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await upsertRoleMapping({ type: RoleMappingType.Language, value: code, roleId: role.id });
        await interaction.reply({ content: `Mapped **language:${code}** → ${role}.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (sub === 'pronouns') {
        const value = interaction.options.getString('value', true);
        const role = interaction.options.getRole('role', true);
        await upsertRoleMapping({ type: RoleMappingType.Pronouns, value, roleId: role.id });
        await interaction.reply({ content: `Mapped **pronouns:${value}** → ${role}.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (sub === 'remove') {
        const type = interaction.options.getString('type', true) as RoleMappingType;
        const value = interaction.options.getString('value', true).toLowerCase().trim();
        const deleted = await deleteRoleMapping(type, value);
        await interaction.reply({
          content: deleted ? `Removed mapping **${type}:${value}**.` : `No mapping found for **${type}:${value}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === 'list') {
        const typeFilter = interaction.options.getString('type') as RoleMappingType | null;
        const rows = await listRoleMappings(typeFilter ?? undefined);
        const color = appFeatureMap[command.options.feature].color;
        const embed = new EmbedBuilder().setColor(color).setTitle('Role Mappings').setTimestamp();

        if (rows.length === 0) {
          embed.setDescription('*No mappings configured.*');
        } else {
          const grouped = new Map<RoleMappingType, typeof rows>();
          for (const row of rows) {
            const bucket = grouped.get(row.type) ?? [];
            bucket.push(row);
            grouped.set(row.type, bucket);
          }
          for (const [type, entries] of grouped) {
            embed.addFields({
              name: type.charAt(0).toUpperCase() + type.slice(1),
              value: entries.map((e) => `\`${e.value}\` → <@&${e.roleId}>`).join('\n'),
            });
          }
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
      }

      return;
    }

    if (sub === 'show') {
      const settings = await getSettings();
      await handlePaginatedEmbeds(buildConfigPages(settings), interaction, { flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'channel') {
      const key = interaction.options.getString('key', true) as ChannelKey;
      const channel = interaction.options.getChannel('channel', false);
      await updateSettings({ [key]: channel?.id ?? null });
      await interaction.reply({ content: channel ? `Set **${key}** to <#${channel.id}>.` : `Cleared **${key}**.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'feature') {
      const key = interaction.options.getString('key', true) as FeatureKey;
      const enabled = interaction.options.getBoolean('enabled', true);
      await updateSettings({ [key]: enabled });
      await interaction.reply({ content: `Set **${key}** to \`${enabled}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'threshold') {
      const key = interaction.options.getString('key', true) as ThresholdKey;
      const value = interaction.options.getInteger('value', true);
      await updateSettings({ [key]: value });
      await interaction.reply({ content: `Set **${key}** to \`${value}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'starboard') {
      const emojiTiers = interaction.options.getString('emoji-tiers', true);
      await updateSettings({ starboardEmojiTiers: emojiTiers });
      await interaction.reply({ content: `Updated starboard emoji tiers: \`${emojiTiers}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'string') {
      const key = interaction.options.getString('key', true) as StringKey;
      const value = interaction.options.getString('value', true);
      await updateSettings({ [key]: value });
      await interaction.reply({ content: `Set **${key}** to \`${value}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'enable-all') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const patch = Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, enabled]));
      await updateSettings(patch);
      await interaction.reply({ content: `All features ${enabled ? 'enabled' : 'disabled'}.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'schedulable') {
      const name = interaction.options.getString('name', true);
      const cron = interaction.options.getString('cron', true).trim();

      const schedulable = getSchedulables().get(name);
      if (!schedulable) {
        await interaction.reply({ content: `Unknown schedulable \`${name}\`.`, flags: MessageFlags.Ephemeral });
        return;
      }

      try {
        schedulable.restart(client, cron);
      } catch {
        await interaction.reply({ content: `Invalid cron expression: \`${cron}\`.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await upsertSchedulableConfig(name, cron);
      await interaction.reply({
        content: `Schedulable **${name}** rescheduled to \`${cron}\`. Takes effect immediately.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  },
});
