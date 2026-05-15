# 🕵️ Wattson, VoltEuropa's Discord Agent

## 📖 Background

> This Bot is the continuation of the discord bot "VoltBot" developed by **fabnem12** and **WhiteBlackGoose**, which is archived starting from version 1.0.0 of Wattson and can be accessed via https://github.com/fabnem12/VoltBot; due to the ever-increasing requirements of the VoltBot, a new start was looked for. This repository aims to restructure the Bot and modernize it to fulfill the requirements of the [Volt Europa Discord Server](https://discord.com/invite/volteuropa).

### 💜 Party Reference

To find out more about our mission at Volt Europa, please refer to [VoltEuropa.org](https://volteuropa.org/)!

## 🔽 Installation & Usage

Clone the repository from GitLab:

```bash
$ git clone <GITLAB_REPO_URL>
```

Install the dependencies (beware, the project uses `bun` instead of `npm`):

```bash
$ bun install
```

Navigate to [discord.dev](https://discord.dev) and get a bot token and create a `.env` file with the following content:

```js
TOKEN=[...]
CLIENT_ID=[...]
APPLICATION_ID=[...]
NODE_ENV=[...]
```

Afterwards run the application

```bash
$ bun run dev
```

To deploy the application, we recommend building it first using

```bash
$ bun run build
```

Then reregister the slash commands at the discord API using

```bash
$ bun run script:register-commands
```

And finally deploy it by using `node`. Do not forget to adjust the `.env` file to use `production` instead of `development`.

## 📁 Scaffolding

```bash
wattson
├── .gitlab-ci.yml          # CI (lint, typecheck, schema drift, Docker build)
├── assets                  # banners, avatars, language map
├── scripts
│   ├── migrations          # Drizzle-kit generated SQL
│   └── register-commands.ts
├── src
│   ├── core
│   │   ├── commands        # auto-discovered slash/context commands
│   │   ├── components      # reusable EmbedBuilder wrappers
│   │   ├── events          # auto-discovered Discord event handlers
│   │   ├── loaders         # env, locales, events, commands
│   │   ├── locales         # typesafe-i18n (en/, de/)
│   │   ├── middleware      # useGuildOnly, usePermissions, useAdmin
│   │   ├── models          # Client, Command, Event, Component, UserRole
│   │   ├── providers       # VerificationFlow, AutomodProvider, ExternalPoster
│   │   ├── scheduler       # banSweeper
│   │   └── types           # cross-cutting type definitions
│   ├── database
│   │   ├── schema          # one file per table + shared/enums/relations
│   │   ├── repositories    # named queries per table
│   │   ├── client.ts       # Drizzle connection
│   │   └── settings.ts     # singleton-row accessor
│   ├── settings            # env, system, theme
│   └── utilities           # Logger, Utils, duration
├── types                   # globals.d.ts, reset.d.ts
├── ARCHITECTURE.md
├── docker-compose.yml
├── Dockerfile.wattson
├── drizzle.config.ts
├── package.json
└── README.md
```

## 🪴 Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the canonical design reference (boot flow, command/event contract, settings singleton, repository pattern, provider interfaces, security).

## ✨ Features

### Functional Requirements:

- [x] Status-Discord-Log on startup
- [x] Ping functionality
- [x] Welcome Message
- [x] RBAC System based on Server Roles
- [x] Rule centralization
- [x] User Behaviour Logging
- [x] Automated Verification Process (with OBSCR role marker)
- [x] Reports (`/reports list|view|resolve|dismiss`)
- [x] Warns (`/warn`, `/warnings list|revoke`)
- [x] Bans (`/ban`, `/unban`, automatic expiry sweeper)
- [x] Statistics (`/stats joins|moderation|activity`)
- [x] Starboard functionality (in-Discord)
  - [ ] Post to BSKY _(stub only — awaiting credentials)_
  - [ ] Post to Instagram _(stub only — awaiting credentials)_
  - [ ] Post to Volt Intranet (Haiilo) _(stub only — awaiting credentials)_
- [x] Automod of Messages + User Descriptions (regex or self-hosted Ollama, `/automod` for pattern management)
- [x] Courting functionality (`/court open|close|dismiss|escalate|list|history`)

### Non-Functional Requirements:

- [x] Platform Agnostic Deployment (Docker)
- [x] Continuous Deployment via CI/CD
- [x] Secure (env validation, redaction, parameterised queries, append-only moderation)
- [x] Well-Documented ([ARCHITECTURE.md](ARCHITECTURE.md))
- [x] High Performance
- [x] Redact sensitive logging

## 🐛 Bugs

If you have questions, feature requests or a bug you want to report, please file an issue on the project's GitLab tracker.

## ⚒️ Maintainers

- [**schmaenjael**](https://github.com/schmaenjael) [![GitHub followers](https://img.shields.io/github/followers/schmaenjael.svg?style=social)](https://github.com/schmaenjael)

## ⚠️ License

Copyright (c) 2025 VoltEuropa
<br />
Licensed under the GNU General Public License v3.0; for further information refer to the appended `LICENSE`!
