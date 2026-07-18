import { ApplicationCommandType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { Command, Permission } from '~/core/models';
import { AppFeature, appFeatureMap, Colors } from '~/settings';
import { getSchedulables, SCHEDULABLE_CHOICES } from '~/core/loaders/loadSchedulables';
import { getSettings, upsertSchedulableConfig, type Settings } from '~/database';
import { handlePaginatedEmbeds } from '~/core/components';

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

  featuresPage.setFooter({ text: 'Page 1 of 4' }).setTimestamp();

  const channelsPage = new EmbedBuilder()
    .setColor(color)
    .setTitle('Wattson Config — Channels (2/4)')
    .setDescription('Channel mappings for each bot subsystem.')
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
          `**Suggestions:** ${ch(s.suggestionChannelId)}`,
          `**Suggestion approval:** ${ch(s.suggestionApprovalChannelId)}`,
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Page 2 of 4' })
    .setTimestamp();

  const rolesPage = new EmbedBuilder()
    .setColor(color)
    .setTitle('Wattson Config — Roles (3/4)')
    .setDescription('Role mappings that control bot permission tiers.')
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
    .setFooter({ text: 'Page 3 of 4' })
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
          `**Emoji tiers:** \`${s.starboardEmojiTiers.map((t) => `${t.threshold}:${t.emoji}`).join(',')}\`\n-# Format: threshold:emoji pairs, comma-separated`,
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
      { name: 'React', value: `**Default emojis:** \`${s.reactDefaultEmojis.join(',')}\`\n-# Overridable per \`/react\` invocation` },
      {
        name: 'Suggestions',
        value: [
          `**Vote threshold:** ${s.suggestionVoteThreshold} net upvotes → escalates to approval`,
          `**Vote duration:** ${s.suggestionVoteDurationHours}h before the sweeper closes voting`,
        ].join('\n'),
      }
    )
    .setFooter({ text: 'Page 4 of 4' })
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
    )
    .addSubcommand((s) =>
      s
        .setName('run')
        .setDescription('Manually trigger a background schedulable immediately.')
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('Which schedulable to run')
            .setRequired(true)
            .addChoices(...SCHEDULABLE_CHOICES)
        )
    ),

  async executeCommand(command, client, interaction) {
    const sub = interaction.options.getSubcommand(true);

    const handlers: Record<string, () => Promise<void>> = {
      show: async () => {
        const settings = await getSettings();
        await handlePaginatedEmbeds(buildConfigPages(settings), interaction, { flags: MessageFlags.Ephemeral });
      },

      run: async () => {
        const name = interaction.options.getString('name', true);
        const schedulable = getSchedulables().get(name);
        if (!schedulable) {
          await interaction.reply({ content: `Unknown schedulable \`${name}\`.`, flags: MessageFlags.Ephemeral });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const startedAt = Date.now();
        let summary: string | void;
        try {
          summary = await schedulable.options.execute(client, schedulable.logger);
        } catch (err) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(`❌ ${name} failed`)
                .addFields({ name: 'Error', value: `\`\`\`${String(err).slice(0, 900)}\`\`\`` })
                .setTimestamp(),
            ],
          });
          return;
        }
        const color = appFeatureMap[command.options.feature].color;
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(color)
              .setTitle(`✅ ${name} completed`)
              .addFields(
                { name: 'Duration', value: `${Date.now() - startedAt}ms`, inline: true },
                { name: 'Summary', value: summary ? summary.slice(0, 1024) : '*No output*', inline: false }
              )
              .setTimestamp(),
          ],
        });
      },

      schedulable: async () => {
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
      },
    };

    await handlers[sub]?.();
  },
});
