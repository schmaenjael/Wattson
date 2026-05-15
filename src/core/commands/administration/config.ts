import { ApplicationCommandType, ChannelType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command } from '~/core/models';
import { useAdmin } from '~/core/middleware';
import { AppFeature, appFeatureMap, ProcessExitCode } from '~/settings';
import { getSettings, updateSettings, type Settings } from '~/database';
import { handlePaginatedEmbeds } from '~/core/components';

type ChannelKey =
  | 'notificationChannelId'
  | 'publicLogChannelId'
  | 'surveillanceLogChannelId'
  | 'reportsLogChannelId'
  | 'warningsLogChannelId'
  | 'bansLogChannelId'
  | 'welcomeChannelId'
  | 'approvalChannelId'
  | 'courtParentChannelId'
  | 'starboardChannelId'
  | 'harmAlertChannelId'
  | 'modmailChannelId';

const CHANNEL_CHOICES: { name: string; value: ChannelKey }[] = [
  { name: 'System notifications', value: 'notificationChannelId' },
  { name: 'Public log', value: 'publicLogChannelId' },
  { name: 'Surveillance log', value: 'surveillanceLogChannelId' },
  { name: 'Reports log', value: 'reportsLogChannelId' },
  { name: 'Warnings log', value: 'warningsLogChannelId' },
  { name: 'Bans log', value: 'bansLogChannelId' },
  { name: 'Welcome', value: 'welcomeChannelId' },
  { name: 'Verification approval', value: 'approvalChannelId' },
  { name: 'Court parent', value: 'courtParentChannelId' },
  { name: 'Starboard', value: 'starboardChannelId' },
  { name: 'Harm detection alerts', value: 'harmAlertChannelId' },
  { name: 'Modmail (mod-only thread parent)', value: 'modmailChannelId' },
];

type RoleKey =
  | 'roleUnregisteredId'
  | 'roleCommunityId'
  | 'roleMemberId'
  | 'roleModerationId'
  | 'roleAdministrationId'
  | 'roleMutedId'
  | 'roleObscrId'
  | 'roleVolterId'
  | 'roleModmailHandlerId';

const ROLE_CHOICES: { name: string; value: RoleKey }[] = [
  { name: 'Unregistered', value: 'roleUnregisteredId' },
  { name: 'Community', value: 'roleCommunityId' },
  { name: 'Member', value: 'roleMemberId' },
  { name: 'Moderation', value: 'roleModerationId' },
  { name: 'Administration', value: 'roleAdministrationId' },
  { name: 'Muted', value: 'roleMutedId' },
  { name: 'OBSCR (verification marker)', value: 'roleObscrId' },
  { name: 'Volter (verified Volt member)', value: 'roleVolterId' },
  { name: 'Modmail handler (pinged on new modmails)', value: 'roleModmailHandlerId' },
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
  | 'featureLinkFilterEnabled';

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
];

type ThresholdKey =
  | 'starboardThreshold'
  | 'starboardExternalThreshold'
  | 'warnAutoEscalateCount'
  | 'warnAutoEscalateWindowDays'
  | 'badWordDeleteThreshold';
const THRESHOLD_CHOICES: { name: string; value: ThresholdKey }[] = [
  { name: 'Starboard threshold (stars)', value: 'starboardThreshold' },
  { name: 'Starboard external-post threshold (stars)', value: 'starboardExternalThreshold' },
  { name: 'Warn auto-escalate count', value: 'warnAutoEscalateCount' },
  { name: 'Warn auto-escalate window (days)', value: 'warnAutoEscalateWindowDays' },
  { name: 'Bad-word delete threshold (severity ≥ N → immediate delete)', value: 'badWordDeleteThreshold' },
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
];

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
    warnings: (s) =>
      s.featureBadWordsEnabled && !process.env.PROFANITY_LIST_PATH
        ? ['`PROFANITY_LIST_PATH` env var not set — no profanity list loaded, filter is a no-op']
        : [],
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
    description: 'Uses an Ollama LLM to score messages for harmful content and posts alerts.',
    enabled: (s) => s.featureHarmDetectionEnabled,
    warnings: (s) => [
      ...(!s.harmAlertChannelId ? ['`harmAlertChannelId` not set — alerts cannot be delivered'] : []),
      ...(s.featureHarmDetectionEnabled && !process.env.OLLAMA_MODEL ? ['`OLLAMA_MODEL` env var not set — LLM evaluation will be skipped'] : []),
    ],
  },
  {
    label: 'Link Filter (Blocklist)',
    description: 'Deletes messages containing domains from Pi-hole-format blocklists loaded at startup.',
    enabled: (s) => s.featureLinkFilterEnabled,
    warnings: (s) =>
      s.featureLinkFilterEnabled && !process.env.BLOCKLIST_PATHS
        ? ['`BLOCKLIST_PATHS` env var not set — no blocklist loaded, filter is a no-op']
        : [],
  },
];

const buildConfigPages = (s: Settings): EmbedBuilder[] => {
  const color = appFeatureMap[AppFeature.System].color;

  const activeWarnings = FEATURES.flatMap((f) => (f.enabled(s) ? f.warnings(s).map((w) => `**${f.label}:** ${w}`) : []));

  const featuresPage = new EmbedBuilder()
    .setColor(color)
    .setTitle('Wattson Config — Features (1/4)')
    .setDescription('Feature toggles, documentation, and health warnings for enabled features.')
    .addFields({ name: 'Status', value: FEATURES.map((f) => `${bool(f.enabled(s))} **${f.label}**\n-# ${f.description}`).join('\n') });

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
          `**Public log:** ${ch(s.publicLogChannelId)}`,
          `**Surveillance log:** ${ch(s.surveillanceLogChannelId)}`,
          `**Reports log:** ${ch(s.reportsLogChannelId)}`,
          `**Warnings log:** ${ch(s.warningsLogChannelId)}`,
          `**Bans log:** ${ch(s.bansLogChannelId)}`,
        ].join('\n'),
      },
      {
        name: 'Feature Channels',
        value: [
          `**Welcome:** ${ch(s.welcomeChannelId)}`,
          `**Verification approval:** ${ch(s.approvalChannelId)}`,
          `**Court parent:** ${ch(s.courtParentChannelId)}`,
          `**Starboard:** ${ch(s.starboardChannelId)}`,
          `**Harm detection alerts:** ${ch(s.harmAlertChannelId)}`,
          `**Modmail (mod-only):** ${ch(s.modmailChannelId)}`,
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
          `**Moderation:** ${ro(s.roleModerationId)}\n-# Grants access to warn, ban, court, reports, and stats commands`,
          `**Administration:** ${ro(s.roleAdministrationId)}\n-# Grants full bot configuration access via /config`,
        ].join('\n'),
      },
      {
        name: 'Utility Roles',
        value: [
          `**Muted:** ${ro(s.roleMutedId)}\n-# Applied to muted members; overrides channel send permissions`,
          `**OBSCR:** ${ro(s.roleObscrId)}\n-# Internal marker assigned during the verification flow`,
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
          `**List path:** \`${process.env.PROFANITY_LIST_PATH ?? '(not set)'}\`\n-# Set PROFANITY_LIST_PATH env var; severity 1 always skipped, 2–(N-1) → LLM check`,
        ].join('\n'),
      },
      {
        name: 'Harm Detection',
        value: [
          `**Status:** ${bool(s.featureHarmDetectionEnabled)}`,
          `**Alert channel:** ${ch(s.harmAlertChannelId)}\n-# Requires OLLAMA_MODEL env var to be set`,
        ].join('\n'),
      },
      {
        name: 'Link Filter',
        value: [
          `**Status:** ${bool(s.featureLinkFilterEnabled)}`,
          `**Blocklist paths:** \`${process.env.BLOCKLIST_PATHS ?? '(not set)'}\`\n-# Set BLOCKLIST_PATHS env var (comma-separated file paths)`,
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Page 4 of 4 · use /config threshold to adjust values' })
    .setTimestamp();

  return [featuresPage, channelsPage, rolesPage, thresholdsPage];
};

export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.System,
  type: ApplicationCommandType.ChatInput,
  // Bootstrap-safe: useAdmin accepts either Administration role OR Discord ManageGuild.
  // Intentionally NOT gated by usePermissions so the first admin can configure roles.
  middleware: [useAdmin],
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
    .addSubcommand((s) =>
      s
        .setName('role')
        .setDescription('Set a role mapping for a permission level.')
        .addStringOption((o) =>
          o
            .setName('key')
            .setDescription('Which role to set')
            .setRequired(true)
            .addChoices(...ROLE_CHOICES)
        )
        .addRoleOption((o) => o.setName('role').setDescription('The role (leave blank to unset)').setRequired(false))
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
        .setName('enable-all')
        .setDescription('Enable or disable every feature flag at once.')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable all features').setRequired(true))
    ),

  async executeCommand(command, client, interaction, middlewareData) {
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return;

    const sub = interaction.options.getSubcommand(true);

    if (sub === 'show') {
      const settings = await getSettings();
      await handlePaginatedEmbeds(buildConfigPages(settings), interaction, { flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'channel') {
      const key = interaction.options.getString('key', true) as ChannelKey;
      const channel = interaction.options.getChannel('channel', false);
      await updateSettings({ [key]: channel?.id ?? null } as Partial<Settings>);
      await interaction.reply({ content: channel ? `Set **${key}** to <#${channel.id}>.` : `Cleared **${key}**.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'role') {
      const key = interaction.options.getString('key', true) as RoleKey;
      const role = interaction.options.getRole('role', false);
      await updateSettings({ [key]: role?.id ?? null } as Partial<Settings>);
      await interaction.reply({ content: role ? `Set **${key}** to <@&${role.id}>.` : `Cleared **${key}**.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'feature') {
      const key = interaction.options.getString('key', true) as FeatureKey;
      const enabled = interaction.options.getBoolean('enabled', true);
      await updateSettings({ [key]: enabled } as Partial<Settings>);
      await interaction.reply({ content: `Set **${key}** to \`${enabled}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'threshold') {
      const key = interaction.options.getString('key', true) as ThresholdKey;
      const value = interaction.options.getInteger('value', true);
      await updateSettings({ [key]: value } as Partial<Settings>);
      await interaction.reply({ content: `Set **${key}** to \`${value}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'starboard') {
      const emojiTiers = interaction.options.getString('emoji-tiers', true);
      await updateSettings({ starboardEmojiTiers: emojiTiers });
      await interaction.reply({ content: `Updated starboard emoji tiers: \`${emojiTiers}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'enable-all') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const patch = Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, enabled])) as Partial<Settings>;
      await updateSettings(patch);
      await interaction.reply({ content: `All features ${enabled ? 'enabled' : 'disabled'}.`, flags: MessageFlags.Ephemeral });
      return;
    }
  },
});
