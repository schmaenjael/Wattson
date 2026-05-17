# Wattson — Claude Rules

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

## Project Structure

```
src/
  core/
    commands/        # flat per category subfolder; one file per command
    components/      # Discord UI builders (PascalCase files)
    events/          # flat per category subfolder; one file per event
    loaders/         # startup-only wiring
    locales/         # typesafe-i18n generated + hand-edited translations
    middleware/      # reusable MiddlewareFunction<T> exports
    models/          # Client, Command, Event, Exceptions, UserRole, Permission
    providers/       # domain services (automod, starboard, verification, external)
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
- `executeCommand` checks `middlewareData.some(m => m.status !== ProcessExitCode.OK)` as first line

## Events

Pattern mirrors commands: `new Event({ type, feature, middleware, executeCommand })`.

- `middleware` array of `MiddlewareFunctionEvent<T>` -> non-OK status short-circuits handler

## Middleware

- Return type: `Promise<MiddlewareResult>` = `{ status: ProcessExitCode, payload?: unknown }`
- `ProcessExitCode.OK` = pass; anything else = short-circuit + caller returns early
- Permission middleware lives on InteractionCreate event (`src/core/events/system/commands.ts`), not per-command
- Command-specific guards go in command's own `middleware: []` array

## Database

- Schema: `src/database/schema/<entity>.ts` -> one `pgTable` per file, shared constants in `shared.ts`
- Repositories: `src/database/repositories/<entity>.ts` -> exported async functions only, call `getDb()` inside each
- Types via Drizzle inference: `InferSelectModel<typeof table>`, insert type = `Omit<InferInsertModel<...>, 'id' | 'createdAt' | ...>`
- No raw SQL; use Drizzle query builder

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
