# Wattson — Architecture Reference

Canonical reference for contributors. Covers every layer of the codebase: why things are named the way they are, where code lives, how data flows, and where new features belong.

---

## Hard constraints

These are non-negotiable. Do not design around them.

1. **Single guild, ever.** `process.env.GUILD_ID` is the only guild Wattson serves. On `GuildCreate` with any other guild it immediately leaves. On `ClientReady` it leaves any extra cached guilds. No multi-tenant code paths exist.
2. **Self-hosted LLM only.** Ollama runs at an operator-controlled endpoint. Message content never leaves the deployment. Third-party inference APIs are explicitly not wired in.
3. **Moderation records are append-only.** Warnings, bans, reports, court cases are never `DELETE`d. Lifecycle is expressed through nullable columns: `revokedAt`, `active`, `resolvedAt`, `closedAt`. This preserves the full audit trail.
4. **All DB writes go through repositories.** No feature code writes raw Drizzle outside `src/database/repositories/`. This is a strict architectural boundary.

---

## Tech stack

| Layer       | Choice                                                      |
| ----------- | ----------------------------------------------------------- |
| Runtime     | Bun ≥ 1.2.8                                                 |
| Language    | TypeScript strict, ESNext target                            |
| Discord     | discord.js v14                                              |
| Database    | PostgreSQL via Drizzle ORM (`pg` driver)                    |
| Logging     | Pino (structured JSON, per-feature namespaces)              |
| i18n        | typesafe-i18n (auto-generated types from `en/` base locale) |
| LLM         | Ollama (self-hosted, HTTP)                                  |
| Format/Lint | Prettier + ESLint (flat config, pre-commit hooks)           |

---

## Boot sequence

```
src/index.ts
  loadConfig()               // env + config/config.<NODE_ENV>.json5 + static JSON5, Zod-validated; throws on invalid
  Promise.all([
    loadAllLocales()         // typesafe-i18n node adapter
    connectDatabase()        // drizzle() with pg pool + retry, camelCase JS ↔ snake_case SQL
  ])
  .then(() => client.start())
        loadEvents()         // readdir src/core/events/**/*.ts → client.on(type, handler)
        loadCommands()       // readdir src/core/commands/**/*.ts → Collection<name, Command>
        client.login(TOKEN)
  .then(() => startHealthServer(client))
```

`loadConfig()` runs first and synchronously — every later stage reads from it, so an invalid or incomplete config file aborts the boot before any connection is opened. Any failure in the `Promise.all` is likewise fatal (`process.exit(ProcessExitCode.ERROR)`).

---

## Folder layout

```
src/
├── index.ts                        # entry point — boot sequence
│
├── settings/                       # compile-time constants (not runtime DB settings)
│   ├── env.ts                      # REQUIRED_ENV_VARS array — validated at boot
│   ├── system.ts                   # ProcessExitCode, AppFeature enum, appFeatureMap, LogNamespace
│   └── theme.ts                    # Colors (Volt Europa brand + bot palette), assets (AttachmentBuilder wrappers)
│
├── utilities/
│   ├── Logger.ts                   # Pino wrapper — getInstance(feature?) → child logger
│   ├── Utils.ts                    # measurePerformance() and misc helpers
│   ├── duration.ts                 # human-readable duration parser
│   └── index.ts                    # barrel
│
├── database/
│   ├── client.ts                   # connectDatabase() + getDb() singleton (drizzle instance)
│   ├── settings.ts                 # getSettings() — flattens the JSON5 config into the legacy column shape
│   ├── index.ts                    # barrel — re-exports everything below
│   ├── schema/                     # one pgTable per file
│   │   ├── shared.ts               # SNOWFLAKE_LENGTH, REASON_LENGTH, createdAt(), updatedAt() helpers
│   │   ├── enums.ts                # ALL pgEnum definitions + mirrored TypeScript enums
│   │   ├── relations.ts            # Drizzle relation definitions (for query joins)
│   │   ├── index.ts                # barrel
│   │   ├── users.ts, usernameHistory.ts, memberHistory.ts
│   │   ├── warnings.ts, bans.ts, mutes.ts, reports.ts, lockedChannels.ts
│   │   ├── courtCases.ts, courtVotes.ts, appeals.ts, appealVotes.ts
│   │   ├── modmails.ts, suggestions.ts, suggestionVotes.ts
│   │   ├── events.ts, eventRegistrations.ts, stickyMessages.ts
│   │   ├── starboardEntries.ts, externalPosts.ts
│   │   ├── auditLog.ts, harmDetectionSamples.ts, inviteSnapshot.ts
│   │   ├── memberActivityDaily.ts, schedulableConfigs.ts
│   │   └── voltVerifications.ts
│   └── repositories/               # one file per domain, pure async functions only
│       ├── index.ts                # barrel — import everything via ~/database
│       ├── stats.ts                # cross-table aggregation queries (joins/stats)
│       ├── gdprDeletion.ts         # cascaded user data wipe
│       └── …                       # one file mirroring each schema domain above
│
└── core/
    ├── loaders/
    │   ├── loadEnvironment.ts      # validates REQUIRED_ENV_VARS, populates process.env type
    │   ├── loadCommands.ts         # auto-discovers commands/, populates Client.commands Collection
    │   ├── loadEvents.ts           # auto-discovers events/, binds client.on() / client.once()
    │   └── index.ts
    │
    ├── models/                     # base classes — do not add feature logic here
    │   ├── Client.ts               # singleton discord.js Client subclass; holds commands Collection
    │   ├── Command.ts              # Command<T> — runs middleware chain then executeCommand
    │   ├── Event.ts                # Event<T> — same pipeline for event handlers
    │   ├── Component.ts            # Component<T> — embed builder base class
    │   ├── Exceptions.ts           # BotException — logs via Pino + pings error channel; never exits
    │   ├── UserRole.ts             # Permission enum + UserRole interface
    │   └── index.ts
    │
    ├── types/
    │   ├── interactions.ts         # InteractionType<T>, CommandOptions<T>, EventOptions<T>,
    │   │                           # MiddlewareFunction<T>, MiddlewareResult
    │   └── index.ts
    │
    ├── middleware/
    │   ├── permissionCore.ts       # ROLE_COLUMN_BY_PERMISSION + memberHasAll/AnyPermission — shared core
    │   ├── usePermissions.ts       # event middleware on interactionCreate; enforces requiredPermissions
    │   ├── useFeatureFlag.ts       # useFeatureFlag(flag) command middleware + ensureFeatureEnabled()
    │   ├── logModAction.ts         # afterware: turns a command's returned AuditEntry into an audit row
    │   └── index.ts
    │
    ├── components/                 # reusable EmbedBuilder wrappers, named after their UI role
    │   ├── Error.ts                # ErrorEmbed — wraps BotException into a user-visible embed
    │   ├── Ping.ts
    │   ├── Report.ts
    │   ├── Rules.ts
    │   ├── Welcome.ts
    │   ├── pagination.ts           # handlePaginatedEmbeds() — generic button-driven paginator
    │   ├── padding.ts              # blank-field helpers for embed layout
    │   └── index.ts
    │
    ├── locales/
    │   ├── en/index.ts             # base locale — all keys defined here
    │   ├── de/index.ts             # German translations
    │   ├── i18n-types.ts           # AUTO-GENERATED — do not edit manually
    │   ├── i18n-node.ts            # typesafe-i18n node adapter
    │   ├── i18n-util.ts
    │   ├── i18n-util.sync.ts
    │   └── index.ts                # exports L (locale accessor)
    │
    ├── scheduler/                  # one Schedulable per file; cron from config.schedules, overridable per row
    │   ├── banSchedulable.ts       # lifts expired bans
    │   ├── muteSchedulable.ts      # removes the muted role when a mute expires
    │   ├── warningSchedulable.ts   # expires warnings past the escalation window
    │   ├── modmailSchedulable.ts   # stale-thread reminders + auto-close
    │   ├── suggestionSchedulable.ts, eventSchedulable.ts
    │   ├── verificationSchedulable.ts  # re-verification sweep
    │   └── analyticsSchedulable.ts, statChannelsSchedulable.ts
    │
    ├── commands/                   # auto-discovered; FLAT — one file per command, no category folders
    │   │                           # access is declared per command via requiredPermissions, not by folder
    │   ├── help.ts, ping.ts, rules.ts, stats.ts, verify.ts, request-data-deletion.ts
    │   ├── ask.ts                  # AI Q&A via Ollama (gated by features.ask)
    │   ├── ban.ts, unban.ts, mute.ts, warn.ts, purge.ts, clear.ts, lockdown.ts, say.ts
    │   ├── court.ts                # /court open|finalize|list|history|record
    │   ├── report.ts, reports.ts, userRecord.ts, gdpr-delete.ts
    │   ├── modmail.ts, appeal.ts, suggest.ts, event.ts
    │   ├── sticky.ts, react.ts
    │   └── config.ts               # /config show|schedulable|run — display + cron management only
    │
    ├── events/                     # auto-discovered; flat — exactly ONE file per Discord gateway event
    │   ├── interactionCreate.ts    # config-driven router: slash/context/autocomplete + button/select/modal
    │   │                           #   routes[] dispatch to provider handlers; rights[] enforced per route
    │   ├── guildMemberAdd.ts       # fan-out → inviteTracking + welcome providers
    │   ├── guildMemberUpdate.ts    # fan-out → antihoist + forumRoles + surveillance providers
    │   ├── messageReactionAdd.ts   # fan-out → starboard + analytics + sticky providers
    │   ├── messageCreate.ts        # fan-out → antispam, autoslowmode, sticky, automod, analytics
    │   ├── messageUpdate.ts        # fan-out → surveillance edit report + automod
    │   ├── messageDelete.ts        # surveillance audit log
    │   ├── memberRemove.ts         # GuildMemberRemove → audit log
    │   ├── voiceStateUpdate.ts     # voice activity analytics
    │   ├── inviteCreate.ts / inviteDelete.ts  # invite cache maintenance
    │   ├── guildCreate.ts          # leave any guild that isn't GUILD_ID
    │   └── ready.ts                # ClientReady → leave wrong guilds, start schedulers, log boot
    │
    └── providers/                  # domain services; isolated, injected, swappable
        ├── automod/
        │   ├── run.ts             # runAutomod() — link filter → profanity → LLM harm check, in order
        │   ├── autoMute.ts        # warn-count escalation → muted role + mutes row
        │   └── index.ts           # barrel
        ├── moderation/             # single code path for warn / mute / ban (commands + report actions)
        │   ├── warn.ts             # issueWarning() — row, DM, mod log, audit, warn auto-mute escalation
        │   ├── mute.ts             # applyMute() — muted role + row, discriminated result (not_configured / not_in_guild / already_muted)
        │   ├── ban.ts              # applyBan() — Discord ban first, then row + mod log + audit
        │   └── index.ts            # barrel
        ├── report/
        │   ├── publish.ts          # publishReport() — plain copy → reportsLog, buttons copy → reportsTodo, stores both message IDs
        │   ├── actions.ts          # handleReportButton() (dismiss / showModal), handleReportModal() (execute action, then close)
        │   ├── close.ts            # closeReport() — status + audit, delete todo copy, stamp resolution on log copy
        │   └── index.ts            # barrel
        ├── profanity/             # file-based word list (config/bad-words), severity-scored
        │   └── ollama.ts           # OllamaAutomod — sends message to Ollama for classification
        ├── charts/
        │   └── index.ts            # renderVerificationsChart(), renderModerationChart() → Buffer (PNG)
        ├── court/
        │   ├── summarizer.ts       # summarizeCourtThread() — sends thread messages to Ollama, returns bullet list
        │   └── outcome.ts          # buildVoteEmbed(), buildVoteRow(), fetchCourtSummary(),
        │                           # archiveCourtThread(), executeCaseOutcome()
        ├── external/               # stubs until credentials arrive — interface-only, no real HTTP
        │   ├── index.ts            # getExternalPoster() factory
        │   ├── types.ts            # ExternalPoster interface
        │   ├── bsky.ts             # BskyStub
        │   ├── instagram.ts        # InstagramStub
        │   └── haiilo.ts           # HaiiloStub
        ├── harm/
        │   ├── index.ts            # getHarmDetector() — reads config/harm-detection.json5
        │   ├── types.ts            # HarmDetectionConfig, HarmDetectionResult
        │   └── ollama.ts           # OllamaHarmDetector — classifies into racism/discrimination/sexism/harassment
        ├── starboard/
        │   ├── index.ts
        │   └── starboard.ts        # reaction threshold logic, cross-post to starboard channel
        └── verification/
            ├── index.ts
            ├── flow.ts             # Flow DSL + FlowRunner — step types, step execution, FlowCancelled
            ├── config.ts           # buildVerificationFlow() — assembles the step sequence from DB data
            ├── run.ts              # runVerification() — entry point; manages activeVerifications Set
            └── actions.ts          # grantAccess(), postWelcomeEmbed(), createChoiceMenu()
```

---

## Command contract

Every slash or context-menu command is a `new Command<T>({ … })` default export. The file is auto-discovered by `loadCommands.ts` via recursive `readdir`.

```ts
export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.X, // logger namespace + embed color
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation], // enforced by usePermissions (see below)
  middleware: [], // explicit empty array when none
  data: new SlashCommandBuilder().setName('x').setDescription('…'),

  async executeCommand(command, client, interaction, middlewareData) {
    // … implementation — no middleware guard needed, see below
  },
});
```

`Command.execute()` short-circuits on the first non-OK middleware result: it logs a debug line and
returns **before** calling `executeCommand`. Commands therefore do not guard on `middlewareData`.

**Where it belongs:** `src/core/commands/<name>.ts` — the directory is **flat**, with no category
subfolders. Access is declared on the command itself:

- No gate — omit `requiredPermissions` or leave it `[]`.
- Role gate — `requiredPermissions: [Permission.Moderation]` (AND semantics, enforced by `usePermissions`).
- Feature gate — `middleware: [useFeatureFlag('featureXEnabled')]`.

**After adding a command:** run `bun run script:register-commands` to sync with Discord.

---

## Event contract

Same shape as commands but parameterised on `keyof ClientEvents`. **Exactly one file per Discord
gateway event, flat in `src/core/events/`.** An event file contains **no business logic** — it only
calls provider methods. There are two archetypes:

**Fan-out** — when several features react to the same gateway event, the handler calls each provider
in order:

```ts
export default new Event({
  type: Events.GuildMemberAdd,
  feature: AppFeature.System,
  middleware: [],
  async executeCommand(_event, client, member) {
    await trackMemberJoin(member); // inviteTracking provider
    await welcomeMember(client, member); // welcome provider
  },
});
```

**Dispatch** — `interactionCreate.ts` declares `routes[]` instead of an `executeCommand` body. The
`Event` model builds a `Map` keyed by `kind` + the first `:`-segment of the `customId` and dispatches
the matched provider handler. Optional `rights[]` are enforced (OR semantics; `ManageGuild` always
passes) before the handler runs:

```ts
export default new Event({
  type: Events.InteractionCreate,
  feature: AppFeature.System,
  middleware: [usePermissions],
  routes: [
    { kind: 'command', handler: dispatchCommand },
    { kind: 'autocomplete', handler: dispatchAutocomplete },
    { kind: 'button', name: 'court_vote', rights: [Permission.Moderation, Permission.Administration], handler: handleCourtVote },
    { kind: 'modal', name: 'suggestion', handler: handleSuggestionModal },
  ],
});
```

**Where it belongs:** `src/core/events/<gatewayEventName>.ts` (e.g. `messageReactionAdd.ts`).

**High-volume queued dispatch (`MessageCreate`)** is the one exception to the plain-`handlers[]`
shape: `core/models/MessagePipeline.ts` wraps a bounded `AsyncQueue` around a sequence of provider
calls (`sticky.onMessage` → `autoslowmode.enforce` → `antispam.recordAndAct` → `runAutomod`), each
step isolated with try/catch the same way `Event.execute`'s `handlers[]` loop isolates fan-out
handlers — a throwing step doesn't block the rest. It lives beside `Event`/`Command`/`Schedulable`
in `core/models/` (a dispatch mechanism, not a domain provider) and exports a single
`onMessageCreate(client, message)` entrypoint that `events/messageCreate.ts` lists in its
`handlers[]` like any other provider function.

---

## Middleware system

Middleware runs before `executeCommand`. Each function returns `{ status: ProcessExitCode, payload? }`. **The chain short-circuits on any non-OK status** — `executeCommand` is never called, and the handler returns immediately.

```
middleware: [fn1, fn2, fn3]
  → fn1() → OK → fn2() → OK → fn3() → OK → executeCommand(…, [r1, r2, r3])
  → fn1() → OK → fn2() → NOPERM → (stop) executeCommand never called
```

The `middlewareData` array is still passed to `executeCommand` so a command can read a middleware's
`payload`, but it never needs to inspect `status` — a non-OK result means `executeCommand` was not
reached at all.

**Available middleware:**

| Function         | File                           | What it checks                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePermissions` | `middleware/usePermissions.ts` | Runs on `InteractionCreate` event for slash/context commands. Cross-references `member.roles` against `settings.role{Permission}Id` columns via `permissionCore.ts`. ManageGuild bypasses as bootstrap fallback (AND semantics).                   |
| `useFeatureFlag` | `middleware/useFeatureFlag.ts` | Factory: `useFeatureFlag('featureAskEnabled')` short-circuits the command with `UNAVAILABLE` and an ephemeral reply when the flag is off. Its `ensureFeatureEnabled(interaction, flag)` counterpart guards button/modal handlers inside providers. |

Route-level `rights[]` on interaction routes reuse the same role columns via
`memberHasAnyPermission` (OR semantics; `ManageGuild` always passes), also in `permissionCore.ts`.

`logModAction` (`middleware/logModAction.ts`) is **afterware**, not middleware: it runs after
`executeCommand` and writes an audit row when the command returned an `AuditEntry`.

**Permission → settings key mapping** (`ROLE_COLUMN_BY_PERMISSION` in `middleware/permissionCore.ts`):

| Permission       | Settings key           | Config key                        |
| ---------------- | ---------------------- | --------------------------------- |
| `Unregistered`   | `roleUnregisteredId`   | `roles.utility.unregistered`      |
| `Community`      | `roleCommunityId`      | `roles.utility.community`         |
| `Member`         | `roleMemberId`         | `roles.utility.member`            |
| `EventManager`   | `roleEventManagerId`   | `roles.permission.eventmanager`   |
| `Moderation`     | `roleModerationId`     | `roles.permission.moderation`     |
| `Administration` | `roleAdministrationId` | `roles.permission.administration` |

**How to add a new permission gate:** add it to the `Permission` enum in `models/Permission.ts`, add
the role to `roles.*` in `config/schema.ts` and the JSON5 file, expose it as `role<Name>Id` on the
`Settings` type in `database/settings.ts`, then wire it into `ROLE_COLUMN_BY_PERMISSION`.

**Bootstrap fallback asymmetry, worth knowing:** `memberHasAllPermissions` (commands) honours bare
`ManageGuild` **only while `roleAdministrationId` is unconfigured**; `memberHasAnyPermission` (route
`rights[]`) always lets `ManageGuild` through.

---

## Interaction routing

All interactions — slash/context commands, autocomplete, buttons, select menus, modals — pass through
the single `src/core/events/interactionCreate.ts` and its `routes[]` config. The `Event` model
(`models/Event.ts`) resolves the interaction kind, computes the route key (`kind` for command/
autocomplete; `kind:firstCustomIdSegment` for component/modal), looks it up in the route `Map`,
enforces any `rights`, and calls the matched handler.

**Routing pattern:** the `customId` encodes domain and parameters, e.g. `court_vote:42:ban`. The
top-level route matches on the first segment (`court_vote`); the provider handler sub-routes on the
remaining segments — also via a `Record<string, handler>` map or `switch`, so every routing level
has the same shape regardless of handler count.

**Adding a new interaction handler:**

1. Put the logic in a provider as an exported `handle…(client, interaction)` function. If the domain
   has multiple actions under one `customId` prefix, sub-route inside the provider with a map/switch.
2. Register one route in `interactionCreate.ts`: `{ kind, name: '<prefix>', rights?: [...], handler }`.
3. Use route-level `rights` when **every** action under the prefix needs the same gate (gdpr, report,
   appeal, court). When actions differ (e.g. public votes alongside mod-only approvals, or a modal that
   must `showModal` as its sole first response), omit `rights` and gate inside the provider using
   `memberHasAnyPermission` from `middleware/permissionCore.ts`.

---

## Settings (runtime configuration)

Settings are **file-backed and read-only at runtime**. `config/config.<NODE_ENV>.json5` is loaded and Zod-validated once at boot (`src/config/loader.ts`); the `settings` table no longer exists. `src/database/settings.ts` survives only as an adapter — `getSettings()` flattens the in-memory config into the legacy flat column shape so the ~40 existing consumers were untouched by the migration. It is `async` to preserve that contract and performs no I/O.

```ts
const settings = await getSettings(); // flattened view of the JSON5 config; no I/O
const { config } = getConfig(); // the validated config itself, for new code
```

**What lives in the config:**

| Group         | Config key                              | Flattened as                                            |
| ------------- | --------------------------------------- | ------------------------------------------------------- |
| Channel IDs   | `channels.courtParent`                  | `courtParentChannelId`                                  |
| Role IDs      | `roles.permission.*`, `roles.utility.*` | `roleModerationId`, `roleMutedId`, `roleUnregisteredId` |
| Feature flags | `features.court`                        | `featureCourtEnabled`                                   |
| Thresholds    | `thresholds.starboard`                  | `starboardThreshold`                                    |
| Schedules     | `schedules.muteSweep`                   | read via `getConfig()` directly                         |

**Changing a setting** means editing the JSON5 file and restarting the bot. There is no write path and no `/config` mutation subcommand — `/config` is display-only (`show`), plus `schedulable` / `run` for cron management. Missing or malformed keys fail Zod loudly at boot rather than silently defaulting.

**Adding a feature flag** — five touch points, all required:

1. `src/config/schema.ts` — add the key to the `features` Zod object
2. `config/config.<env>.json5` — set the value (Zod fails loudly at boot if missing)
3. `src/database/settings.ts` — add `featureXEnabled: boolean` to the `Settings` type and map it in `getSettings()`
4. `src/core/commands/config.ts` — add a `FEATURES` registry entry so `/config` documents it
5. At least one guard — commands use `middleware: [useFeatureFlag('featureXEnabled')]`, provider interaction handlers use
   `ensureFeatureEnabled(interaction, 'featureXEnabled')`, and silent paths (gateway events, schedulers) read
   `getConfig().config.features.x` at the top of the provider's exported function

Silent paths guard **inside the provider**, not at the caller — a feature usually has several entry points (command,
interaction route, scheduler) and gating only the command leaves the scheduler running.

**Env vars** are only for secrets and IDs that must be known before the DB is reachable: `TOKEN`, `CLIENT_ID`, `APPLICATION_ID`, `GUILD_ID`, Postgres credentials, and optional external API keys (`OLLAMA_ENDPOINT`, `BSKY_*`, etc.).

---

## Database layer

### Schema (`src/database/schema/`)

One file per table. Shared utilities live in `shared.ts`:

```ts
SNOWFLAKE_LENGTH = 20; // max Discord ID length
REASON_LENGTH = 512; // max moderation reason
createdAt(); // timestamp with time zone, NOT NULL, DEFAULT NOW()
updatedAt(); // same + $onUpdate hook
```

All PostgreSQL enums are defined in `enums.ts` alongside their TypeScript mirror enum. The convention is:

```ts
export enum CourtStatus { Open = 'open', Finalizing = 'finalizing', … }
export const courtStatusEnum = pgEnum('court_status', Object.values(CourtStatus) as [string, …]);
```

The TypeScript enum is used everywhere in application code; the pgEnum is used only in table column definitions.

**After any schema change:** `bun run db:generate` → `bun run db:migrate`.

### Tables reference

| Table                              | Purpose                                                                                                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                            | Snowflake ID + username cache. Must exist before any FK reference. Always `upsertUser()` before inserting moderation records.                                                                                                                                                     |
| `username_history`                 | Append-only log of username changes.                                                                                                                                                                                                                                              |
| `warnings`                         | Moderation warnings. `revokedAt`/`revokedBy` nullable — revocation doesn't delete.                                                                                                                                                                                                |
| `bans`                             | Bans with `active` flag and optional `expiresAt`. `banSchedulable.ts` sweeps expired active bans.                                                                                                                                                                                 |
| `reports`                          | User-filed reports with `ReportStatus` (open/resolved/dismissed). `logMessageId` / `todoMessageId` locate the two delivered copies so closure can edit / delete them.                                                                                                             |
| `court_cases`                      | Judicial thread records. Statuses: open → finalizing → resolved/dismissed/escalated. Stores `threadId`, `verdict`, `summary` (LLM-generated), `voteMessageId`.                                                                                                                    |
| `court_votes`                      | One row per moderator per case. Unique on `(case_id, moderator_id)` — supports vote changes via upsert.                                                                                                                                                                           |
| `audit_log`                        | Append-only event stream. `eventType` from `AuditEventType` enum, `payload` is `jsonb`.                                                                                                                                                                                           |
| `mutes`                            | Active mutes with `expiresAt`. `muteSchedulable.ts` removes the muted role on expiry. Anti-spam and warn auto-escalation both write here.                                                                                                                                         |
| `locked_channels`                  | Channels currently locked down, so `/lockdown` can restore the prior permission overwrites.                                                                                                                                                                                       |
| `appeals` / `appeal_votes`         | Ban appeals and the moderator vote tally that resolves them.                                                                                                                                                                                                                      |
| `modmails`                         | Modmail threads with status, category, and close bookkeeping.                                                                                                                                                                                                                     |
| `suggestions` / `suggestion_votes` | Community suggestions and their vote rows.                                                                                                                                                                                                                                        |
| `events` / `event_registrations`   | Server events and per-member signups.                                                                                                                                                                                                                                             |
| `sticky_messages`                  | Per-channel sticky text, level, and repost interval.                                                                                                                                                                                                                              |
| `schedulable_configs`              | Per-schedulable cron override, edited via `/config schedulable`.                                                                                                                                                                                                                  |
| `member_history`                   | Join/leave history per member.                                                                                                                                                                                                                                                    |
| `invite_snapshot`                  | Invite-use counts cached between gateway events, for attributing a join to an invite.                                                                                                                                                                                             |
| `volt_verifications`               | Verification submissions and their approval state.                                                                                                                                                                                                                                |
| `ml.harm_detection_samples`        | Training-data capture (lives in the dedicated **`ml`** schema, no FKs into `public`): every harm-detector hit with text, context, raw scores, `modelVersion`, and `action`. Retro-labelled (`humanLabel`) from revoked auto-warnings and report outcomes. Purged on GDPR erasure. |
| `starboard_entries`                | Tracks which messages have been posted to starboard (prevents duplicates).                                                                                                                                                                                                        |
| `external_posts`                   | Queue/log for cross-platform posts (BSKY/Instagram/Haiilo). Status: queued/posted/failed.                                                                                                                                                                                         |
| `member_activity_daily`            | Per-user, per-UTC-day activity buckets (`messageCount`, `voiceSeconds`, `reactionCount`). Composite PK `(userId, day)`. Written by the analytics flush job, never per-event. Existence of a row = "member was active that day".                                                   |

Role mappings (verification answers → role IDs), forum-thread mappings, and stat-channel IDs are **not** tables —
they live in `config/config.<NODE_ENV>.json5` under `roles.countryMappings`, `roles.languageMappings`,
`roles.forumMappings`, and `statChannels`.

### Repositories (`src/database/repositories/`)

One file per domain. Every exported function is `async` and calls `getDb()` internally. Types are inferred via Drizzle:

```ts
export type Warning = InferSelectModel<typeof warnings>;
export type NewWarning = Omit<InferInsertModel<typeof warnings>, 'id' | 'createdAt' | 'revokedAt' | 'revokedBy'>;
```

**Special repositories:**

- `stats.ts` — cross-table aggregation queries used by `/stats`. Uses `sql` template + `date_trunc` for monthly/daily bucketing. Not tied to a single table.
- `gdprDeletion.ts` — cascaded wipe of all data for a user across all tables.
- `auditLog.ts` — `recordAuditEvent()` is the single write path for the entire audit stream.

**Import pattern:** always import via the barrel:

```ts
import { insertWarning, listWarningsForUser, … } from '~/database';
```

Never import directly from schema or repository files outside the database layer.

---

## AppFeature and color system

Every command and event declares `feature: AppFeature.X`. This flows into two things:

1. **Logger namespace:** `appFeatureMap[feature].namespace` → e.g. `[MOD]`, `[SYS]`, `[DB]`
2. **Embed color:** `appFeatureMap[feature].color` → a `HexColorString` from the Volt Europa palette

```ts
const color = appFeatureMap[command.options.feature].color;
new EmbedBuilder().setColor(color);
```

**Volt Europa brand colors** (from `theme.ts`):

- `Purple` `#502379` — rules, welcome, role management
- `Yellow` `#FDC220` — system, database, warnings
- `Blue` `#82D0F4` — reports (starboard data series)
- `Green` `#1BBE6F` — approvals, verifications completed
- `Red` `#E63E12` — GDPR, bans, rejections

---

## ProcessExitCode

Follows UNIX sysexits convention. Used in middleware results and `process.exit()` calls.

| Code          | Value | Meaning                             |
| ------------- | ----- | ----------------------------------- |
| `OK`          | 0     | Success / middleware pass           |
| `ERROR`       | 1     | General unrecoverable error         |
| `UNAVAILABLE` | 69    | Service unavailable                 |
| `SOFTWARE`    | 70    | Internal software error             |
| `IOERR`       | 74    | I/O error                           |
| `TEMPFAIL`    | 75    | Temporary failure                   |
| `NOPERM`      | 77    | Permission denied (middleware gate) |
| `CONFIG`      | 78    | Configuration error                 |

---

## Providers in depth

### Verification (`providers/verification/`)

The verification flow is a multi-step DM wizard. The DSL lives in `flow.ts`:

**Step types:**

| Kind                | What it does                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `text`              | Sends a prompt embed; waits for a text message reply in DM. Optional `validate()` function.                                                |
| `choice`            | Sends a `StringSelectMenuBuilder` with options. Supports `multi`, `min`, `max`. Options can be `categorized` (grouped by category header). |
| `confirm`           | Yes/No button prompt.                                                                                                                      |
| `paginated-confirm` | Sends rule pages as separate embeds with Prev/Next buttons. Accept/Deny only appear on the last page.                                      |

**Data flow:**

```
welcome.ts (GuildMemberAdd)
  → runVerification()       [run.ts]
      → buildVerificationFlow()  [config.ts]  — countries/languages/rules from config (catalog.ts)
      → FlowRunner.run(dm, opts) [flow.ts]    — executes steps, collects FlowAnswers
      → grantAccess(member, answers) [actions.ts]
            → getRoleMappingsForAnswers()  — country/language/pronouns → role IDs
            → member.roles.add(roleIds)
            → if requiresApproval: post approval embed to approvalChannelId
            → else: postWelcomeEmbed()
```

`activeVerifications` (a `Set<string>`) in `run.ts` prevents concurrent duplicate flows for the same user.

### Court (`providers/court/`)

The court system is a formal judicial process for server members.

**Full lifecycle:**

```
/court open @user reason
  → insertCourtCase()
  → private thread created in courtParentChannelId
  → accused gets roleMuted
  → opening embed: reason, moderator, accused history (reports/warnings/bans), rules notice

/court finalize          ← must be run INSIDE the court thread
  → findActiveCaseByThreadId(interaction.channelId)
  → thread.setLocked(true)
  → vote embed posted with 🔨 Ban / ⚠️ Warn / 🚫 Dismiss buttons
  → case status → Finalizing
  → voteMessageId stored in DB

[button: court_vote:<id>:<option>]  ← buttonInteractions.ts
  → validate moderator role
  → upsertCourtVote()   ← one vote per moderator, upsert allows changing vote
  → getVoteTallies()
  → edit vote embed with updated counts
  → if any option reaches VOTE_THRESHOLD (3):
      → executeCaseOutcome()
            → insert warning or guild.bans.create()
            → remove roleMuted (if not ban)
            → fetchCourtSummary() → summarizeCourtThread() via Ollama
            → closeCourtCase() with verdict + LLM summary
            → recordAuditEvent()
            → DM accused with verdict embed
            → archiveCourtThread()

/court record <id>       ← shows full case record including LLM summary
/court list              ← open cases
/court history @user     ← all cases for a user
```

**summarizer.ts:** fetches up to 200 thread messages (paginated, oldest-first), filters bot messages, sends to Ollama with a prompt that returns a bullet-point list of notable points made by participants. Returns `null` if Ollama is not configured or the call fails.

### Moderation (`providers/moderation/`)

`issueWarning()`, `applyMute()`, `applyBan()` own the full side effects of a moderation action — user upsert,
Discord call, DB row, DM (warn), mod-log embeds, and the `audit_log` entry. `/warn`, `/mute`, `/ban` are thin
boundaries (option parsing, target validation, duration parsing, reply) over these; report buttons reuse the
same functions, so there is exactly one path per action. `applyMute()` returns a discriminated result instead
of throwing for the expected cases (role unconfigured, target not in guild, already muted).

### Reports (`providers/report/`)

`/report` inserts the row, then `publishReport()` posts the embed twice: a plain copy to `channels.reportsLog`
(permanent record) and a copy with the Dismiss / Warn / Mute / Ban row to `channels.reportsTodo` (open work
queue). Both message IDs are stored on the `reports` row (`logMessageId`, `todoMessageId`).

- **Dismiss** closes directly. **Warn / Mute / Ban** open a modal (reason prefilled with the message link;
  optional duration for mute and ban) and, on submit, call the moderation provider. Mute runs _before_ the
  implicit warn so warn auto-mute escalation does not double-mute. Ban from a report defaults to
  `appealable = false`, `deleteMessageSeconds = 0`.
- `closeReport()` is the single closure path for buttons, modals, and `/reports resolve|dismiss`: it sets the
  status (warn/mute/ban → `resolved`, dismiss → `dismissed`, preserving the harm-sample label mapping),
  records `ReportResolved`, deletes the todo copy, and appends a _Resolution_ field to the log copy.
- Both handlers re-check `status === open` (buttons before `showModal`, modals after `deferReply`) so the
  second of two concurrent moderators gets "already handled by …" instead of a double action.

### Automod (`providers/automod/`)

`runAutomod()` is a fixed, ordered pipeline rather than a pluggable provider — each stage is
independently toggleable and returns early once a message is actioned:

1. **Link filter** (`features.linkFilter`) — `BlocklistChecker` extracts every URL and bare hostname from the
   content and tests each against an in-memory `Set` of Pi-hole-format domains.
2. **Profanity** (`features.badWords`) — file-based word list from `config/bad-words`, severity-scored;
   deletes at or above `thresholds.badWordDelete`.
3. **Harm detection** (`features.harmDetection`) — sends the message to Ollama for semantic classification.
   Skipped entirely when the feature is off or no model is configured.

### Surveillance (`providers/antispam/`, `providers/autoslowmode/`, `providers/sticky/`)

Each owns its full side effects — window/counter state, the Discord action, and the audit/log write — behind one entrypoint called by `MessagePipeline`, not just a verdict the caller has to act on:

- `antispam.recordAndAct(client, message, settings, logger)` — rolling per-user-per-channel message-rate window; mutes + audits on trip. Returns `true` when triggered (the pipeline stops there — automod doesn't also run on that message).
- `autoslowmode.enforce(client, message, settings, logger)` — per-channel rate window driving a tiered step-up/step-down/restore state machine; sets `rateLimitPerUser` and records the lock. No-op outside guild text channels or under an existing manual lock.
- `sticky.onMessage(message, logger)` — bumps the channel's repost counter; reposts (fire-and-forget) once the configured interval is reached.

### Harm detection (`providers/harm/`)

Separate from automod. Reads `config/harm-detection.json5` (not the DB) for its config. Classifies messages into four categories: `racism`, `discrimination`, `sexism`, `harassment`. Each result carries a `confidence` level (`low`/`medium`/`high`). Always fails safe — returns all-false result on any error.

Enabled via `settings.featureHarmDetectionEnabled`. Alert channel configured via `settings.harmAlertChannelId`.

### Charts (`providers/charts/`)

Uses `chartjs-node-canvas` to render Chart.js charts to PNG `Buffer` server-side. Functions:

- `renderVerificationsChart(data, months)` — approved vs rejected verifications per month.
- `renderModerationChart(data, months)` — warnings / bans / reports per month.
- `renderEngagementChart(data, days)` — daily messages (bars) and active members (line, secondary axis) from `member_activity_daily`.

Background color `#2B2D31` (Discord dark theme). Dataset colors follow Volt Europa brand palette.

### Analytics (`providers/analytics/`)

Write-behind buffer for member activity. Event handlers in `events/analytics/` (`messageCreate`, `voiceStateUpdate`, `messageReactionAdd`) mutate in-memory `Map`s only — no per-event DB writes. Voice time is session-based: `startVoiceSession`/`endVoiceSession` track open sessions (seeded on `ClientReady` for members already in voice), and `checkpointVoiceSessions()` settles open sessions on each flush so long sessions aren't lost. `flushAnalytics()` (checkpoint → drain → single batched increment-upsert into `member_activity_daily`) is invoked by `analyticsSchedulable` every 5 minutes and on `SIGTERM`/`SIGINT`. Hard-crash loss is bounded by the flush interval — an accepted tradeoff for analytics.

### Stat channels (`providers/statChannels/`)

`STAT_CHANNEL_LABELS` / `STAT_CHANNEL_CHOICES` (shared by `/config` and the schedulable) and `computeStatValue(guild, statType)` for the five stat types (all members, active members in the last 30 days, total roles, text channels, yesterday's message total). Consumed by `statChannelsSchedulable`.

### Starboard (`providers/starboard/`)

Triggered by `ReactionAdd` event. Logic:

1. Checks `settings.featureStarboardEnabled` and `settings.starboardThreshold`.
2. Checks `starboard_entries` to prevent duplicate posts.
3. Posts message embed to `settings.starboardChannelId`.
4. Configurable emoji tiers via `settings.starboardEmojiTiers` (format: `"1:⭐,5:🌟,10:💫"`).

### External posters (`providers/external/`)

BSKY, Instagram, and Haiilo are **interface-only stubs**. They implement `ExternalPoster` but do not make real HTTP calls. Will be implemented when credentials are available. Do not add real logic until that point.

---

## Scheduler

Every recurring job is a `Schedulable` in `src/core/scheduler/`, registered by `loadSchedulables.ts` at boot. Each declares a `defaultCron` read lazily from `config.schedules`; a row in `schedulable_configs` overrides it, and `/config schedulable` edits that row (`/config run` fires one tick immediately). A tick that throws is caught, logged, and posted to the notification channel — it never kills the job.

`banSchedulable.ts` is the reference example: it lists expired active bans, lifts each via `guild.bans.remove()`, then `deactivateBan()` in the DB, and returns a summary string that becomes the tick's notification.

Single-process, single-server assumption. If the bot ever runs multi-process, this needs to move to a proper distributed scheduler.

Recurring jobs are `Schedulable` instances registered in `loaders/loadSchedulables.ts` (cron via Croner; overridable per job via `/config schedulable`, runnable on demand via `/config run`). Analytics jobs:

- `analytics-schedulable` (`*/5 * * * *`) — flushes the in-memory activity buffer to `member_activity_daily`.
- `stat-channels-schedulable` (`0 1 * * *`, 01:00 daily) — renames each configured stat voice channel to `"Label: value"`. Per-channel try/catch, and skips `setName` when the name is unchanged to conserve the channel-rename rate limit (Discord allows only 2 renames per 10 minutes per channel).

---

## Localization

All user-facing strings go through `L[locale].NAMESPACE.KEY()`.

```ts
import { L } from '~/core/locales';
L[interaction.locale].GENERAL.COMMAND_INVALID_PERMISSIONS();
```

**To add a string:**

1. Add the key to `src/core/locales/en/index.ts` (required) and `de/index.ts` (recommended).
2. Run `bun run script:typesafe-i18n` to regenerate `i18n-types.ts`.
3. TypeScript will error if a key is used that doesn't exist in the base locale.

Never hardcode user-facing strings outside locale files.

---

## Logging

```ts
const logger = Logger.getInstance(AppFeature.X);
logger.info({ userId, action }, 'User performed action'); // object first, message second
logger.warn(Object(err), 'Something failed — context');
logger.error({ error }, 'Fatal-ish event');
```

`Logger.getInstance()` without an argument returns the root logger. With a feature, it returns a Pino child logger tagged with that feature's `LogNamespace`.

**Auto-redacted fields** in all environments: `token`, `password`, `authorization`, `apiKey`, `email`, `BOT_PASSWORD`, `POSTGRES_PASSWORD`.

---

## Error handling

```ts
throw new BotException(client, 'Human-readable context', originalError);
```

`BotException` in `models/Exceptions.ts`:

1. Logs the full error via Pino.
2. Pings `settings.notificationChannelId` with an error embed.
3. Never exits the process.

`process.exit()` is reserved for boot-time failures (missing env vars, failed DB connection) and the DB singleton exhaustion case in `database/client.ts`.

Plain `new Error()` is allowed only inside provider internals where it is immediately caught in the same function and no Discord client is available.

### Soft failures — `softFail` / `logSoftFailure`

Best-effort calls (`members.fetch`, `createDM`, `messages.fetch`, a DM send to a user who may have
DMs closed) must not raise a `BotException` embed into the guild, but they must never be silent
either. `src/utilities/attempt.ts` is the single seam for that:

```ts
const member = await guild.members.fetch(id).catch(softFail(AppFeature.Mute, 'MUTE_MEMBER_FETCH', { targetUserId: id }));
const rows = await listAllVerifications().catch(softFail(AppFeature.VerificationSweeper, 'SWEEPER_LIST_ALL_VERIFICATIONS', {}, []));

try {
  return await detector.detect(content);
} catch (error) {
  logSoftFailure(AppFeature.AutomatedWarn, 'AUTOMOD_HARM_DETECTION_FAILED', { contentLength: content.length }, error);
  return null;
}
```

- `softFail(feature, errorCode, context?, fallback?)` builds a `.catch()` handler. It logs, then
  resolves to `fallback` (default `null`), so the call site keeps its original inferred type.
- `logSoftFailure(feature, errorCode, context, error, level?)` is the same log for `try/catch` blocks.
- `attempt(fn, { feature, errorCode, context, level, onError })` wraps a whole best-effort block.

**Error codes** are stable, greppable, `SCREAMING_SNAKE_CASE` strings scoped by area
(`MODMAIL_THREAD_SEND`, `VERIFICATION_DM_OPEN`). They are not a numeric registry — the upstream
error's own code is logged separately as `upstreamCode` (Discord REST JSON code, Postgres SQLSTATE,
or Node `errno`), alongside `httpStatus`, `httpMethod`, `httpUrl`, `errorName` and `reason`.

**Severity is derived, not uniform.** Discord rejections that are part of the normal path
(`UnknownMember`, `UnknownMessage`, `UnknownChannel`, `CannotSendMessagesToThisUser`, …) log at
`debug`; everything else logs at `warn`. Pass an explicit `level` to override — e.g. `debug` for a
component-collector timeout, `error` for a failed DB health probe.

Pino's level defaults to `info` in production, so the `debug` tier — the bulk of what actually fires
on a healthy bot — is suppressed there. Set `LOG_LEVEL=debug` (see README) to surface it when
diagnosing; the default keeps production quiet.

`logSoftFailure` returns the `SoftFailureDetails` it logged (`upstreamCode`, `errorName`, `reason`,
`httpStatus`, …), so a caller that needs to branch on the failure — or surface it to the user — reads
it off the return value instead of re-deriving it:

```ts
const details = logSoftFailure(AppFeature.Clear, 'CLEAR_OLD_MESSAGE_DELETE', { messageId }, error);
if (details.upstreamCode === RESTJSONErrorCodes.MissingPermissions) break;
```

`stack` is attached only when the failure is _not_ expected — an expected-absence line stays terse,
while a genuine throw keeps its trace.

**Only these stay outside the seam:** boot and shutdown (`config/loader.ts`, `database/client.ts`,
`index.ts`), the framework's own handler isolation (`Event`, `MessagePipeline`, the command/event
loaders, `interactionCreate` autocomplete), the health HTTP handler, and `runDiscordAction` — which
is the sibling seam for Discord side effects whose success the database depends on.

Everything here is console-only; nothing reaches Discord. Two call sites stay deliberately silent:
`Logger.log()`'s own Discord delivery path (logging there would recurse) and the shutdown notifier
in `src/index.ts`.

---

## Audit log

Every moderation action writes to `audit_log` via `recordAuditEvent()`:

```ts
await recordAuditEvent({
  eventType: AuditEventType.WarnIssued,
  actorUserId: interaction.user.id, // nullable — system events have no actor
  targetUserId: member.id,
  payload: { warningId: warning.id, reason },
});
```

`payload` is `jsonb` — put whatever context is useful for later analysis. This table is the source of truth for the `/stats` command aggregations.

---

## Where to put new features

| What you're adding               | Where it goes                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| New slash command                | `src/core/commands/<category>/<name>.ts`                                                                      |
| New Discord event handler        | `src/core/events/<category>/<name>.ts`                                                                        |
| New button interaction domain    | Branch in `src/core/events/system/buttonInteractions.ts`, logic in a provider                                 |
| New database table               | `src/database/schema/<name>.ts` + `src/database/repositories/<name>.ts` + export from `repositories/index.ts` |
| New enum value                   | Add to `enums.ts` TypeScript enum (pgEnum auto-updates via `Object.values()`)                                 |
| New settings column              | `src/database/schema/settings.ts` + expose via `/config` subcommand                                           |
| New complex domain service       | `src/core/providers/<domain>/` directory                                                                      |
| New UI component / embed wrapper | `src/core/components/<Name>.ts`                                                                               |
| New aggregate query              | `src/database/repositories/stats.ts`                                                                          |
| New scheduled task               | `src/core/scheduler/<name>.ts`, start it from `ready.ts`                                                      |
| New user-facing string           | `locales/en/index.ts` + `locales/de/index.ts` + `bun run script:typesafe-i18n`                                |

---

## Naming conventions

| Thing                | Convention                                                      | Example                                                    |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| Command files        | `kebab-case.ts`                                                 | `request-data-deletion.ts`                                 |
| Component files      | `PascalCase.ts`                                                 | `ErrorEmbed.ts`                                            |
| Schema files         | `camelCase.ts` matching the exported table variable             | `courtCases.ts` exports `courtVotes`                       |
| Repository functions | `verbNounForContext`                                            | `insertWarning`, `listWarningsForUser`, `countBansForUser` |
| Enum values          | `PascalCase` TypeScript, `snake_case` DB string                 | `CourtStatus.Finalizing = 'finalizing'`                    |
| Settings columns     | `camelCase` in TS, Drizzle auto-converts to `snake_case` in SQL | `roleModerationId` → `role_moderation_id`                  |
| Button customIds     | `domain_action:param1:param2`                                   | `court_vote:42:ban`                                        |
| Provider factories   | `get<Thing>()`                                                  | `getAutomodProvider()`, `getSettings()`                    |

---

## Migration workflow

```bash
# 1. Edit schema file(s) in src/database/schema/
bun run db:generate      # creates scripts/migrations/<timestamp>_<name>.sql
bun run db:migrate       # applies pending migrations to Postgres

# 2. Register new/changed slash commands with Discord
bun run script:register-commands

# 3. Static reference data: countries + languages in config/catalog.json5, server rules in config/rules.json5
#    (both loaded irrespective of NODE_ENV). Per-environment data (pronouns, role mappings) in config/config.<env>.json5 — edit there, not the DB
```

Migrations live in `scripts/migrations/` and are committed. Never hand-edit generated migration files.

---

## Security notes

- **Env vars validated at boot.** Missing required vars exit before any Discord connection is made.
- **Parameterised queries everywhere** via Drizzle — no string interpolation into SQL.
- **Append-only moderation.** No `DELETE` on warnings, bans, reports, court records.
- **LLM stays local.** Ollama endpoint is operator-controlled; message content never sent to a third-party inference API.
- **Pino redaction.** Secrets never appear in log output.
- **Single-guild enforcement.** `guildCreate` and `clientReady` both actively leave unexpected guilds.
- **Permission gates are DB-driven.** Role IDs come from `settings`, not hardcoded. ManageGuild is the fallback only for initial bootstrap before roles are configured.
