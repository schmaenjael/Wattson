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
  Promise.all([
    loadEnvironment()        // assert REQUIRED_ENV_VARS; exit on missing
    loadAllLocales()         // typesafe-i18n node adapter
    connectDatabase()        // drizzle() with pg pool + retry, camelCase JS ↔ snake_case SQL
  ])
  .then(() => ensureSettingsSeeded())   // idempotent INSERT of settings id=1 singleton row
  .then(() => Client.getInstance().start())
        loadEvents()         // readdir src/core/events/**/*.ts → client.on(type, handler)
        loadSlashCommands()  // readdir src/core/commands/**/*.ts → Collection<name, Command>
        client.login(TOKEN)
```

Any failure in the initial `Promise.all` is fatal (`process.exit(ProcessExitCode.ERROR)`). The order matters: environment must be validated before database, and settings must be seeded before the bot can process interactions.

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
│   ├── settings.ts                 # getSettings() / updateSettings() / invalidateSettingsCache()
│   ├── index.ts                    # barrel — re-exports everything below
│   ├── schema/
│   │   ├── shared.ts               # SNOWFLAKE_LENGTH, REASON_LENGTH, createdAt(), updatedAt() helpers
│   │   ├── enums.ts                # ALL pgEnum definitions + mirrored TypeScript enums
│   │   ├── relations.ts            # Drizzle relation definitions (for query joins)
│   │   ├── index.ts                # barrel
│   │   ├── users.ts
│   │   ├── usernameHistory.ts
│   │   ├── warnings.ts
│   │   ├── bans.ts
│   │   ├── reports.ts
│   │   ├── courtCases.ts
│   │   ├── courtVotes.ts
│   │   ├── auditLog.ts
│   │   ├── rules.ts
│   │   ├── settings.ts             # singleton settings table (id=1, CHECK constraint)
│   │   ├── slurPatterns.ts
│   │   ├── slurViolations.ts
│   │   ├── starboardEntries.ts
│   │   ├── externalPosts.ts
│   │   ├── languages.ts
│   │   ├── roleMappings.ts
│   │   └── countries.ts
│   └── repositories/               # one file per domain, pure async functions only
│       ├── index.ts                # barrel — import everything via ~/database
│       ├── users.ts
│       ├── usernameHistory.ts
│       ├── warnings.ts
│       ├── bans.ts
│       ├── reports.ts
│       ├── courtCases.ts
│       ├── courtVotes.ts
│       ├── auditLog.ts
│       ├── rules.ts
│       ├── slurs.ts
│       ├── starboard.ts
│       ├── stats.ts                # cross-table aggregation queries (joins/stats)
│       ├── languages.ts
│       ├── roleMappings.ts
│       ├── countries.ts
│       ├── gdprDeletion.ts         # cascaded user data wipe
│       └── volterExport.ts
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
    │   ├── usePermissions.ts       # cross-references member roles against settings.role*Id columns
    │   ├── useAdmin.ts             # checks settings.roleAdministrationId or ManageGuild fallback
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
    ├── scheduler/
    │   └── banSweeper.ts           # polls bans table every 60s for expired active rows; lifts ban + deactivates
    │
    ├── commands/                   # auto-discovered; one file per command, flat within category
    │   ├── general/                # available to all members (no requiredPermissions)
    │   │   ├── help.ts
    │   │   ├── ping.ts
    │   │   ├── request-data-deletion.ts
    │   │   ├── rules.ts
    │   │   ├── stats.ts            # /stats joins|moderation|activity|chart verifications|moderation
    │   │   └── verify.ts           # triggers verification flow via DM
    │   ├── moderation/             # requires Permission.Moderation
    │   │   ├── ban.ts
    │   │   ├── court.ts            # /court open|finalize|list|history|record
    │   │   ├── gdpr-delete.ts
    │   │   ├── report.ts           # file a report
    │   │   ├── reports.ts          # list/resolve reports
    │   │   ├── unban.ts
    │   │   ├── warn.ts
    │   │   └── warnings.ts         # list/revoke warnings
    │   └── administration/         # requires useAdmin middleware
    │       ├── automod.ts          # /automod configure
    │       ├── config.ts           # /config channel|role|feature|threshold
    │       ├── export-volters.ts   # /export-volters
    │       ├── purge.ts            # /purge <n> messages
    │       └── rolemapping.ts      # /rolemapping add|remove|list
    │
    ├── events/                     # auto-discovered; one file per event, flat within category
    │   ├── general/
    │   │   ├── reactionAdd.ts      # starboard trigger
    │   │   └── welcome.ts          # GuildMemberAdd → starts verification flow
    │   ├── moderation/
    │   │   ├── gdprAction.ts       # button handler for GDPR deletion approval
    │   │   ├── reportAction.ts     # button handler for report resolution
    │   │   └── verificationAction.ts # button handler for verification approve/reject
    │   ├── surveillance/
    │   │   ├── memberRemove.ts     # GuildMemberRemove → audit log
    │   │   ├── messageCreate.ts    # automod + harm detection on new messages
    │   │   ├── messageDelete.ts    # audit log
    │   │   ├── messageUpdate.ts    # audit log
    │   │   └── userUpdate.ts       # username change tracking
    │   └── system/
    │       ├── commands.ts         # InteractionCreate → slash/context menu dispatch + usePermissions
    │       ├── buttonInteractions.ts # InteractionCreate → button dispatch (court votes, etc.)
    │       ├── guildCreate.ts      # leave any guild that isn't GUILD_ID
    │       └── ready.ts            # ClientReady → leave wrong guilds, start ban sweeper, log boot
    │
    └── providers/                  # domain services; isolated, injected, swappable
        ├── automod/
        │   ├── index.ts            # getAutomodProvider() — cached factory, switches on settings.automodProvider
        │   ├── types.ts            # AutomodProvider interface
        │   ├── regex.ts            # RegexAutomod — pattern matching against slur_patterns table
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
        │   ├── index.ts            # getHarmDetector() — reads config/harm-detection.json
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
    if (middlewareData.some((m) => m.status !== ProcessExitCode.OK)) return; // ALWAYS first line
    // … implementation
  },
});
```

**Where it belongs:** `src/core/commands/<category>/<name>.ts`

- `general/` — no role requirements; any member can run.
- `moderation/` — set `requiredPermissions: [Permission.Moderation]`.
- `administration/` — add `middleware: [useAdmin]` instead of `requiredPermissions`.

**After adding a command:** run `bun run script:register-commands` to sync with Discord.

---

## Event contract

Same shape as commands but parameterised on `keyof ClientEvents`.

```ts
export default new Event({
  type: Events.GuildMemberAdd,
  feature: AppFeature.Welcome,
  middleware: [],
  async executeCommand(event, client, member) {
    // … implementation
  },
});
```

**Where it belongs:** `src/core/events/<category>/<name>.ts`

- `general/` — member-facing events (joins, reactions).
- `moderation/` — button handlers for moderation UIs (report/verification/GDPR approval panels).
- `surveillance/` — passive logging (message edits/deletes, member removes, username changes).
- `system/` — infrastructure (interaction routing, guild enforcement, ready hook).

---

## Middleware system

Middleware runs before `executeCommand`. Each function returns `{ status: ProcessExitCode, payload? }`. **The chain short-circuits on any non-OK status** — `executeCommand` is never called, and the handler returns immediately.

```
middleware: [fn1, fn2, fn3]
  → fn1() → OK → fn2() → OK → fn3() → OK → executeCommand(…, [r1, r2, r3])
  → fn1() → OK → fn2() → NOPERM → (stop) executeCommand never called
```

`middlewareData` array is passed to `executeCommand` — the first-line guard `middlewareData.some(m => m.status !== ProcessExitCode.OK)` is a safety net for cases where event middleware (not command middleware) may have non-OK results.

**Available middleware:**

| Function         | File                           | What it checks                                                                                                                                                |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePermissions` | `middleware/usePermissions.ts` | Runs on `InteractionCreate` event. Cross-references `member.roles` against `settings.role{Permission}Id` columns. ManageGuild bypasses as bootstrap fallback. |
| `useAdmin`       | `middleware/useAdmin.ts`       | Checks `settings.roleAdministrationId` or ManageGuild. Used directly in command's `middleware: [useAdmin]`.                                                   |

**Permission → settings column mapping** (inside `usePermissions.ts`):

| Permission       | Column                 |
| ---------------- | ---------------------- |
| `Unregistered`   | `roleUnregisteredId`   |
| `Community`      | `roleCommunityId`      |
| `Member`         | `roleMemberId`         |
| `Moderation`     | `roleModerationId`     |
| `Administration` | `roleAdministrationId` |

**How to add a new permission gate:** add it to `Permission` enum in `UserRole.ts`, add a `role<Name>Id` column to the `settings` schema, wire it in `ROLE_COLUMN_BY_PERMISSION` in `usePermissions.ts`.

---

## Button interactions

All button interactions (not just court votes) pass through `src/core/events/system/buttonInteractions.ts`. The event fires on every `InteractionCreate`; it exits immediately if `!interaction.isButton()`.

**Routing pattern:** the `customId` encodes the domain and parameters, e.g. `court_vote:42:ban`. The handler splits on `:` to extract them.

**Adding a new button handler:** add a branch to `buttonInteractions.ts` matching your `customId` prefix. Keep each domain's logic in a provider file; import it there. Do not put long logic directly in the event handler.

**Other button handlers** live in `src/core/events/moderation/` (report/verification/GDPR panels) — these are separate event files that each listen to `InteractionCreate` and check their own `customId` prefixes.

---

## Settings (runtime configuration)

`src/database/settings.ts` wraps the `settings` table — a **singleton row** (`id = 1`, enforced by a `CHECK (id = 1)` constraint). This is the operator's control surface for everything that changes post-deploy.

```ts
const settings = await getSettings(); // in-process cache; fast
await updateSettings({ channelId: '…' }); // writes to DB, invalidates cache
```

**What lives in settings:**

| Group         | Examples                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Channel IDs   | `notificationChannelId`, `courtParentChannelId`, `starboardChannelId`, `approvalChannelId`               |
| Role IDs      | `roleModerationId`, `roleMutedId`, `roleUnregisteredId`, `roleCommunityId`                               |
| Feature flags | `featureCourtEnabled`, `featureAutomodEnabled`, `featureStarboardEnabled`, `featureHarmDetectionEnabled` |
| LLM config    | `ollamaEndpoint`, `ollamaModel`, `automodProvider`                                                       |
| Thresholds    | `starboardThreshold`, `warnAutoEscalateCount`, `warnAutoEscalateWindowDays`                              |

**Modified via** `/config channel`, `/config role`, `/config feature`, `/config threshold`, `/automod configure`.

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

| Table               | Purpose                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`             | Snowflake ID + username cache. Must exist before any FK reference. Always `upsertUser()` before inserting moderation records.                                  |
| `username_history`  | Append-only log of username changes.                                                                                                                           |
| `warnings`          | Moderation warnings. `revokedAt`/`revokedBy` nullable — revocation doesn't delete.                                                                             |
| `bans`              | Bans with `active` flag and optional `expiresAt`. `banSweeper.ts` polls for expired active bans.                                                               |
| `reports`           | User-filed reports with `ReportStatus` (open/resolved/dismissed).                                                                                              |
| `court_cases`       | Judicial thread records. Statuses: open → finalizing → resolved/dismissed/escalated. Stores `threadId`, `verdict`, `summary` (LLM-generated), `voteMessageId`. |
| `court_votes`       | One row per moderator per case. Unique on `(case_id, moderator_id)` — supports vote changes via upsert.                                                        |
| `audit_log`         | Append-only event stream. `eventType` from `AuditEventType` enum, `payload` is `jsonb`.                                                                        |
| `rules`             | Server rules with category, title, content, example. Displayed paginated in verification and via `/rules`.                                                     |
| `settings`          | Singleton row (id=1). All runtime config.                                                                                                                      |
| `slur_patterns`     | Regex patterns for automod. `severity`: warn/ban/review.                                                                                                       |
| `slur_violations`   | Log of automod triggers per user per pattern.                                                                                                                  |
| `starboard_entries` | Tracks which messages have been posted to starboard (prevents duplicates).                                                                                     |
| `external_posts`    | Queue/log for cross-platform posts (BSKY/Instagram/Haiilo). Status: queued/posted/failed.                                                                      |
| `languages`         | Spoken language options for verification. `group`: european/world. `showInMenu` controls whether it appears in the select menu.                                |
| `role_mappings`     | Maps verification answer values (country/language/pronouns) to Discord role IDs. Managed via `/rolemapping`.                                                   |
| `countries`         | Country options for verification.                                                                                                                              |

### Repositories (`src/database/repositories/`)

One file per domain. Every exported function is `async` and calls `getDb()` internally. Types are inferred via Drizzle:

```ts
export type Warning = InferSelectModel<typeof warnings>;
export type NewWarning = Omit<InferInsertModel<typeof warnings>, 'id' | 'createdAt' | 'revokedAt' | 'revokedBy'>;
```

**Special repositories:**

- `stats.ts` — cross-table aggregation queries used by `/stats`. Uses `sql` template + `date_trunc` for monthly/daily bucketing. Not tied to a single table.
- `gdprDeletion.ts` — cascaded wipe of all data for a user across all tables.
- `volterExport.ts` — exports data for Volt's internal member system (Volter).
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
      → buildVerificationFlow()  [config.ts]  — fetches countries/languages/rules from DB
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

### Automod (`providers/automod/`)

Pluggable provider switched via `settings.automodProvider`:

- `regex` (default) — matches against `slur_patterns` table; instant, no external call.
- `ollama` — sends the message to Ollama for semantic classification. Requires `settings.ollamaModel`.

`getAutomodProvider()` is cached per `provider:model` key. Call `invalidateAutomodProvider()` after changing settings.

### Harm detection (`providers/harm/`)

Separate from automod. Reads `config/harm-detection.json` (not the DB) for its config. Classifies messages into four categories: `racism`, `discrimination`, `sexism`, `harassment`. Each result carries a `confidence` level (`low`/`medium`/`high`). Always fails safe — returns all-false result on any error.

Enabled via `settings.featureHarmDetectionEnabled`. Alert channel configured via `settings.harmAlertChannelId`.

### Charts (`providers/charts/`)

Uses `chartjs-node-canvas` to render Chart.js bar charts to PNG `Buffer` server-side. Two functions:

- `renderVerificationsChart(data, months)` — approved vs rejected verifications per month.
- `renderModerationChart(data, months)` — warnings / bans / reports per month.

Background color `#2B2D31` (Discord dark theme). Dataset colors follow Volt Europa brand palette.

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

`src/core/scheduler/banSweeper.ts` — started in the `ClientReady` event handler. Polls `bans` table every 60 seconds for rows where `active = true AND expiresAt <= NOW()`. For each: lifts the Discord-side ban via `guild.bans.remove()`, then `deactivateBan()` in DB. Logs counts.

Single-process, single-server assumption. If the bot ever runs multi-process, this needs to move to a proper distributed scheduler.

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

# 3. Re-seed reference data if needed
psql $DATABASE_URL < scripts/db/04_languages.sql
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
