# Wattson — Claude Rules

Hint: If bun is not installed, execute 1:1 the bun scripts with npx

ALWAYS: Check if a fitting MCP connection exists and rely on the information provided from there.
ALWAYS: Execute bun run script:lint and bun run script:format after every prompt!
ALWAYS: Execute bun run build after every prompt to check for TSC errors!
ALWAYS: Remove unnecessary DB columns or tables. Ensure the schemas stay lean and clean.
NEVER: Execute bun run db:\* commands. Always leave it to the operator.

## Stack

- Runtime: Bun (>=1.2.8)
- Language: TypeScript strict mode, ESNext target
- Discord: discord.js v14
- DB: PostgreSQL via Drizzle ORM
- Logging: Pino (structured JSON)
- i18n: typesafe-i18n
- Format/lint: Prettier + ESLint (pre-commit hooks)

## Code Style

- Modern TS only -> always async/await, reduce callback or `.then()` chains
- Always curly braces on if/else/for/while -> no single-line braceless blocks
- No `any` types except genuine variance escape hatches -> check with user first
- Verbose explicit typing -> prefer `InferSelectModel<>` / `InferInsertModel<>` over hand-written interfaces
- Path aliases: `~/` = `src/`, `@/` = repo root
- No comments unless WHY is non-obvious
- Flat commands and events hierarchy
- An Event File ONLY ever calls the methods of different features and doesnt contain any business logic itself, its just the handler and directs the tasks to the providers.
-

## Project Structure

```
src/
  services/          # Directory with self-hosted external services such as LLMs, Models, APIs, DBs, etc.
  core/
    commands/        # flat per category subfolder; one file per command
    components/      # Discord UI builders (PascalCase files)
    events/          # flat; one file per event
    loaders/         # startup-only wiring
    locales/         # typesafe-i18n generated + hand-edited translations
    middleware/      # reusable MiddlewareFunction<T> exports
    models/          # Client, Command, Event, Exceptions, UserRole, Permission
    providers/       # domain services (automod, starboard, verification, external); each exposes its public surface via index.ts barrel (see below)
    scheduler/       # recurring background jobs
    types/           # shared TypeScript types
  database/
    client.ts        # getDb() singleton
    repositories/    # pure async functions, one file per domain
    schema/          # one Drizzle table definition per file
    settings.ts      # cached guild settings helper
  settings/          # env vars, system constants, theme/color maps
  utilities/         # Logger, duration parser, misc helpers
```

Folder structure is flat within each category -> no deep nesting.

## Commands

Pattern:

```ts
export default new Command<ApplicationCommandType.ChatInput>({
  feature: AppFeature.X,
  type: ApplicationCommandType.ChatInput,
  requiredPermissions: [Permission.Moderation],  // enforced by usePermissions
  middleware: [],
  data: new SlashCommandBuilder()...,
  async executeCommand(command, client, interaction, middlewareData) { ... },
});
```

- `requiredPermissions` -> `usePermissions` middleware (attached to InteractionCreate event) enforces before execution
- `middleware: []` explicit even when empty
- `Command.execute()` short-circuits on non-OK middleware (logs a debug line and returns before calling `executeCommand`), so commands no longer need a `middlewareData.some(...)` guard

## Events

Exactly ONE file per Discord gateway event, flat in `src/core/events/`. Events contain NO business logic — they only call provider methods. Two archetypes:

- **Fan-out** (multiple features react to one gateway event): declare `handlers[]`, e.g. `messageReactionAdd.ts`, `guildMemberAdd.ts`, `guildMemberUpdate.ts`. The `Event` model runs them in declared order and isolates failures — one throwing handler does not block the others.

  ```ts
  new Event({ type, feature, middleware, handlers: [providerA, providerB] });
  ```

- **Dispatch** (`interactionCreate.ts`): declare `routes[]` instead of `handlers`. The `Event` model dispatches by `kind` + first `:`-segment of the `customId` to a provider handler.

  ```ts
  new Event({
    type: Events.InteractionCreate,
    feature: AppFeature.System,
    middleware: [usePermissions],
    routes: [
      { kind: 'button', name: 'court_vote', rights: [Permission.Moderation, Permission.Administration], handler: handleCourtVote },
      { kind: 'modal', name: 'suggestion', handler: handleSuggestionModal },
    ],
  });
  ```

- Route `kind`: `command | autocomplete | button | select | modal`. `name` = customId prefix (omit for command/autocomplete).
- Route `rights[]`: OR semantics, `ManageGuild` always passes. Use ONLY when every action under the prefix needs the same gate. Otherwise gate inside the provider with `memberHasAnyPermission` (e.g. public votes mixed with mod approvals, or modals that must `showModal` first).
- Provider handlers sub-route remaining customId segments with a `Record<string, handler>` map or `switch` — same shape at every routing level.
- `middleware` array of `MiddlewareFunctionEvent<T>` -> non-OK status short-circuits handler

## Components

- Every embed is a `BaseEmbed` subclass (`src/core/components/BaseEmbed.ts`, extends `Component`) implementing `render(): EmbedBuilder`. No standalone `build*Embed()` functions.
- Construct + render at the call site: `new XxxEmbed({ ...params }).render()`. Read `attachments`/`flags` off the instance where needed.
- Domain params are the class's `TRequired`. `Component` also requires `color` + `locale`; when an embed computes its own color/owns its locale, the subclass constructor derives them and forwards to `super({ ...params, color, locale })` (use `baseLocale` for embeds with hard-coded copy).
- `withBranding(embed)` (protected on `BaseEmbed`) applies the standard Wattson footer (`L[locale].GENERAL.WATTSON_IN_SERVICE()` + volt logo icon) and `.setTimestamp()`. Use it ONLY for embeds that carry the Wattson footer; embeds with their own footer (or none) set their footer/timestamp directly.
- Action rows and buttons are NOT embeds: keep them as exported helper functions (e.g. `buildSuggestionVoteRow`, `buildAppealVoteRow`, `buildKeepOpenRow`) returning `ActionRowBuilder`/`ButtonBuilder`.

## Middleware

- Return type: `Promise<MiddlewareResult>` = `{ status: ProcessExitCode, payload?: unknown }`
- `ProcessExitCode.OK` = pass; anything else = short-circuit + caller returns early
- Permission middleware (`usePermissions`) lives on the InteractionCreate event (`src/core/events/interactionCreate.ts`), not per-command. AND semantics for command `requiredPermissions`.
- Shared role-resolution core in `src/core/middleware/permissionCore.ts` (`memberHasAllPermissions` = AND for commands; `memberHasAnyPermission` = OR for route `rights`)
- Command-specific guards go in command's own `middleware: []` array

## Database

- Schema: `src/database/schema/<entity>.ts` -> one `pgTable` per file, shared constants in `shared.ts`
- Repositories: `src/database/repositories/<entity>.ts` -> exported async functions only, call `getDb()` inside each
- Types via Drizzle inference: `InferSelectModel<typeof table>`, insert type = `Omit<InferInsertModel<...>, 'id' | 'createdAt' | ...>`
- No raw SQL; use Drizzle query builder

### DDL ownership — one owner per concern

Decide with a single question: **does the bot's ORM read/write it?**

- **Yes → Drizzle owns it.** Every schema/table/enum/index the bot queries (`public`, `ml`). Define it in `src/database/schema/*`, let drizzle-kit emit the migration. Never hand-create these in `services/postgres/postgres-init.*`.
- **No → `services/postgres/postgres-init.*` owns it.** Roles/users, passwords, `GRANT`s, extensions, and schemas owned by an external service that the bot never queries via Drizzle (e.g. `rag_data`, used by the RAG service). drizzle-kit does not manage roles/grants/extensions, and secrets must not land in committed migrations.
- Keep each object whole in its owner. `rag_data` (schema + table + index + grants) stays entirely in the init template — do not split it across both. A grant on a Drizzle-owned schema (e.g. read-only on `ml`) still belongs to the init side: put it in `postgres-init.sh` after the migration loop, since the schema only exists post-migration.

## Logging

- `Logger.getInstance(AppFeature.X)` -> namespaced Pino child logger
- Always structured: `logger.info({ key: value }, 'message')` — object first, string second
- Sensitive fields auto-redacted (token, password, email, apiKey, etc.)

## Error Handling

- Single class: `BotException(client, msg, cause?)` -> logs via Pino + notifies Discord error channel; never exits process
- `process.exit` is explicit in calling code only (e.g. DB connection exhaustion in `database/client.ts`)
- Plain `new Error(...)` allowed only inside provider internals where it's immediately caught in the same function and a Discord client is unavailable (e.g. ollama providers)
- Only validate at system boundaries (user input, Discord options, external APIs)
- No defensive checks on internal invariants

## i18n

- All user-facing strings via `L[interaction.locale].NAMESPACE.KEY()`
- Add keys to both `src/core/locales/de/index.ts` and `en/index.ts`; run `bun run script:typesafe-i18n` to regenerate types
- Never hardcode user-facing strings outside locale files

## Single-Guild Constraint

- Bot runs on exactly one guild (GUILD_ID env) -> no multi-tenant logic, no guild-ID parameters in new code

## Providers

- Each provider lives in `src/core/providers/<name>/` and exposes its public surface via a single barrel `index.ts` (e.g. `export { handleCourtVote } from './vote';`). The barrel re-exports ONLY symbols consumed from outside the provider dir — never purely-internal helpers.
- Code OUTSIDE a provider dir (events, commands, scheduler, AND other providers) imports it ONLY through the barrel: `~/core/providers/<name>` — never via a deep path like `~/core/providers/<name>/<subfile>`.
- Imports WITHIN the same provider dir stay as relative deep paths (`./vote`, `./outcome`).
- A provider may be a single `index.ts` when small; split internals into sibling files past ~500 lines and re-export the public ones from the barrel.

## External Providers

- BSKY, Instagram, Haiilo: interface-only stubs until credentials arrive -> do not implement real logic

## Tooling Rules

- `bun run script:format` may be run at any time
- `bun run script:lint` must pass before commit
- DB changes: `bun run db:generate` then `bun run db:migrate`
- Command registration: `bun run script:register-commands`

## Documentation

- Architecture changes -> update `ARCHITECTURE.md`
- Setup/config changes -> update `README.md`
- New explicit rules added during a prompt -> update this file (`CLAUDE.md`)

## Feedback Policy

- Always report issues found plus a recommendation to fix
- Aggressive folder/component restructuring is OK when there is a clearly better alternative

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
