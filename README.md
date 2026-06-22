# 🕵️ Wattson — Volt Europa's Discord Agent

## 📖 Background

Wattson is the successor to [VoltBot](https://github.com/fabnem12/VoltBot) (archived at v1.0.0, originally by **fabnem12** and **WhiteBlackGoose**). The original bot served the [Volt Europa Discord server](https://discord.com/invite/volteuropa) well. Wattson is a ground-up redesign of our beloved VoltBot.

Core design principles:

- **Single-guild, single purpose.** Wattson serves exactly one guild (`GUILD_ID`). No multi-tenant code paths exist and none will be added. Any accidental guild join is rejected immediately at runtime.
- **Operator-controlled LLM.** Harm detection runs against a self-hosted model with generic tasks handled by a self-hosted ollama instance. Message content never reaches a third-party inference API.
- **Append-only moderation records.** Warnings, bans, reports, and court cases are never deleted. Lifecycle is expressed through lifecycle columns (`revokedAt`, `resolvedAt`, `closedAt`). The full audit trail is always intact.

## 🪴 Architecture

The full design reference lives in [ARCHITECTURE.md](ARCHITECTURE.md). It covers the boot sequence, command/event contracts, middleware chain, repository pattern, provider interfaces, scheduler, localization, logging, security model, and migration workflow.

A brief orientation:

```
src/index.ts                   Boot: env → DB → locales → settings seed → Discord login
src/core/
  commands/                    Auto-discovered slash commands (one file per command)
  events/                      Auto-discovered Discord event handlers
  components/                  Reusable EmbedBuilder wrappers
  middleware/                  MiddlewareFunction<T> — usePermissions, etc.
  models/                      Client, Command, Event, Component, UserRole
  providers/                   Stateful domain services (blocklist, sticky, automod, ...)
  loaders/                     Startup-only wiring (commands, events, locales)
  locales/                     typesafe-i18n (en/, de/ — auto-generated types)
src/database/
  schema/                      One Drizzle pgTable per file + shared/enums/relations
  repositories/                Named async functions per domain — only place DB writes occur
  client.ts                    Drizzle connection singleton (getDb())
  settings.ts                  Cached guild settings singleton row
src/settings/                  env.ts, system.ts (AppFeature/LogNamespace/ProcessExitCode), theme.ts
src/utilities/                 Logger (Pino), duration parser, misc helpers
```

---

## ✨ Features

### Moderation

- [x] **Reports** — `/report` submission, `/reports list|view|resolve|dismiss`
- [x] **Warnings** — `/warn`, `/warnings list|revoke`
- [x] **Bans** — `/ban`, `/unban`, automatic expiry sweeper (`banSweeper` scheduler job)
- [x] **Mutes** — timed mutes with automatic lift
- [x] **Court system** — peer-review workflow: `/court open|close|dismiss|escalate|list|history`
- [x] **Link filter** — blocks messages containing domains from Pi-hole-format blocklists (up to 500K entries, sub-millisecond in-memory `Set` lookup); configurable via `/config feature`
- [x] **Profanity filter** — pattern-based bad-word detection with configurable delete thresholds
- [x] **Automod** — message + profile description scanning via self-hosted Ollama; `/automod` pattern management
- [x] **GDPR deletion** — `/gdpr delete` — full moderation history erasure for a user with audit trail

### Utility

- [x] **Verification** — automated OBSCR-role verification flow with audit log
- [x] **Welcome messages** — configurable channel, DM on join
- [x] **Rules** — centralised `/rules` command; managed via database
- [x] **Sticky messages** — per-channel re-posting after N messages; info/warning levels; `❓` reaction triggers a DM with full extended explanation; managed via `/sticky set|remove|list`
- [x] **Modmail** — `/modmail open` for private mod contact; categorised, closeable, stale-detection
- [x] **Statistics** — `/stats joins|moderation|activity|engagement|invites` plus `/stats chart verifications|moderation|engagement`; engagement covers messages, voice time, reactions, and active members tracked via a low-write in-memory buffer
- [x] **Member activity tracking** — message counts, voice-channel time, and reactions buffered in memory and flushed every 5 minutes (no per-event DB writes); powers engagement stats and the active-member count
- [x] **Ping** — `/ping`
- [x] **Forum role sync** — auto-adds members to configured forum threads when they receive a mapped role

### Surveillance & Audit

- [x] **Message logging** — edit and delete events streamed to a surveillance channel
- [x] **User update tracking** — username/role change events recorded in audit log
- [x] **Starboard** — community-pinned messages with configurable threshold
  - [ ] Post to Bluesky _(stub — awaiting credentials)_
  - [ ] Post to Instagram _(stub — awaiting credentials)_
  - [ ] Post to Volt Intranet (Haiilo) _(stub — awaiting credentials)_
- [x] **Volter export** — approved role-holder data export for Volt membership records

### Configuration

- [x] **`/config`** — paginated guild settings viewer + per-feature on/off toggles, surveillance channel assignment, starboard config, automod thresholds
- [x] **Forum role sync** — `/config forum add|remove|list` maps Discord forum thread channels to roles; members are auto-added to mapped threads when the role is assigned (retroactive sync on configure)
- [x] **Stat channels** — `/config statchannel` maps a stat (all members, active members, total roles, text channels, messages today) to a voice channel; its name is refreshed daily at 01:00 to `Stat name: number` by the `stat-channels-schedulable` job

### Non-Functional

- [x] Platform-agnostic deployment via Docker + `docker-compose`
- [x] CI/CD via `.gitlab-ci.yml` (lint, typecheck, schema-drift check, Docker build)
- [x] Structured JSON logging with automatic sensitive-field redaction (Pino)
- [x] Parameterised queries only (Drizzle ORM — no raw SQL)
- [ ] Full i18n (English + German, typesafe) <-- Needs more translations!

---

## 🔽 Installation & Setup

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.2.8
- PostgreSQL 15+ (or Docker — see below)
- An Ollama instance running a compatible model (default: `granite3.2:8b`)
- A Discord application with a bot token (created at [discord.dev](https://discord.dev))

### 1. Clone and install

```bash
git clone https://gitlab.volteuropa.org/eur/tech/inno/discord/Wattson.git
cd wattson
bun install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in all required values:

```bash
cp .env.example .env
```

| Variable              | Required | Description                                                    |
| --------------------- | -------- | -------------------------------------------------------------- |
| `TOKEN`               | ✅       | Discord bot token                                              |
| `CLIENT_ID`           | ✅       | Discord application client ID                                  |
| `APPLICATION_ID`      | ✅       | Discord application ID                                         |
| `GUILD_ID`            | ✅       | The single guild this bot serves                               |
| `NODE_ENV`            | ✅       | `development` or `production`                                  |
| `POSTGRES_USER`       | ✅       | Superuser for DB initialisation                                |
| `POSTGRES_PASSWORD`   | ✅       | Superuser password                                             |
| `POSTGRES_DB`         | ✅       | Database name                                                  |
| `POSTGRES_HOST`       | ✅       | Postgres host (`localhost` for local dev)                      |
| `POSTGRES_PORT`       |          | Postgres port (default: `5432`)                                |
| `BOT_USERNAME`        | ✅       | Least-privilege bot DB role                                    |
| `BOT_PASSWORD`        | ✅       | Bot DB role password                                           |
| `OLLAMA_ENDPOINT`     | ✅       | `http://localhost:11434` for local dev                         |
| `OLLAMA_MODEL`        | ✅       | Ollama model name                                              |
| `BLOCKLIST_PATHS`     |          | Comma-separated paths to Pi-hole blocklist files (link filter) |
| `PROFANITY_LIST_PATH` |          | Path to bad-words list (profanity filter)                      |

### 3. Start the database (Docker)

```bash
docker-compose up -d postgres
```

The `scripts/init-db.sh` script creates the bot DB role automatically on first start.

### 4. Run migrations

```bash
bun run db:migrate
```

To generate migrations after schema changes:

```bash
bun run db:generate
bun run db:migrate
```

### 5. Register slash commands

```bash
bun run script:register-commands
```

This must be re-run whenever commands are added, removed, or their options change.

### 6. Start the bot

I recommend running with `--build` whenever a dependency of a Dockerfile changes or a new file was added to the dependency list.

```bash
# Development (watch mode)
docker-compose --profile development up -d --build

bun run dev
```

The full Docker stack (bot + Postgres + Ollama + pgAdmin) is available via:

```bash
docker-compose --profile production up -d --build
```

---

## 🛠 Development Workflow

### Tooling

```bash
bun run script:lint        # ESLint — must pass before commit
bun run script:format      # Prettier
bun run script:typecheck   # tsc --noEmit
```

Pre-commit hooks enforce formatting and lint automatically.

### Adding a new command

1. Create `src/core/commands/<category>/<name>.ts` following the `Command<ApplicationCommandType.ChatInput>` contract (see [ARCHITECTURE.md](ARCHITECTURE.md#commands)).
2. Export a `new Command({ feature, type, requiredPermissions, middleware, data, executeCommand })` as default.
3. Add any new `AppFeature` value to `src/settings/system.ts` and the `appFeatureMap` there.
4. Run `bun run script:register-commands` to push the updated command list to Discord.

The loader discovers commands at startup via `readdir` — no manual registration in code is needed.

### Adding a new event

Create `src/core/events/<category>/<name>.ts` exporting a `new Event({ type, feature, middleware, executeCommand })`. Discovered automatically.

### Database changes

1. Edit or add a file in `src/database/schema/`.
2. Export the table/type from `src/database/schema/index.ts`.
3. Add repository functions to `src/database/repositories/<entity>.ts` (call `getDb()` inside each).
4. Export from `src/database/repositories/index.ts`.
5. Run `bun run db:generate` then `bun run db:migrate` or copy-paste the generate migration file into the DBMS SQL tool.

For the full repository + schema conventions, see [ARCHITECTURE.md](ARCHITECTURE.md#database).

---

## 🤖 AI-Assisted Development

AI-Assisted or AI-driven development is explicitly allowed, as this code is not deemed security critical. In addition to that, AI agent driven development significantly speeds up the process of writing a codebase such as this, so its a welcome tool.

The code structure right now permits effective working with AI driven tools such as Claude or Codex in this codebase. The provided `CLAUDE.md` contains a list of instructions that have served well during some feature development.

Before opening a PR, please review AI generated code for clear artificats and that it follows the same coding style that was used up to now.

---

## 🐛 Issues & Feedback

Bug reports and feature requests go on the project's GitLab issue tracker. Include the relevant structured log output (`NODE_ENV=development` gives human-readable Pino output via `pino-pretty`).

## ⚒️ Maintainers

Wattson is currently maintained by Manuel Mayer (manuel.mayer@volteuropa.org).

List of all maintainers:

- [**Manuel Mayer**](https://github.com/schmaenjael) [![GitHub followers](https://img.shields.io/github/followers/schmaenjael.svg?style=social)](https://github.com/schmaenjael)

## ⚠️ License

Copyright (c) 2025 Volt Europa  
Distribution or modification of this work is not permitted, see LICENSE.
