# Wattson — Deep-Module Seam Audit

Design review of the whole codebase through the deep-module lens (Ousterhout depth-as-leverage + Feathers seams). Six domain reviewers, ~1368-node graph as the map. Vocabulary is exact: **module** = interface + implementation; **interface** = everything a caller must know; **depth** = behaviour-per-unit-of-interface; **seam** = a place you can change behaviour without editing there; **shallow** = interface nearly as complex as implementation.

**Verdict in one line:** the _architecture_ (provider barrels, thin events, repo layer, Schedulable base) is sound; the _seams leak_. Depth that belongs behind provider interfaces has repeatedly spilled into commands, into the message pipeline, and — worst — into Discord embeds used as a database.

## Fix-plan decisions (grilling session, do not re-open)

Scope is **B: structural fixes, no permanent test suite**. Decided and closed:

- **#3 (db-injection across repos) — WON'T FIX.** Testability rationale is void under scope B. Its only other justification, atomic GDPR delete, doesn't hold up: `executeGdprDeletion` is already one clean transaction of trivial one-liners.
- **GDPR "duplication" finding — WON'T FIX.** Over-flagged; the ~18 `tx.delete().where()` lines are trivial one-liners, not duplicated logic. Threading `tx` through repos to remove them would widen every repo interface for no real gain.
- **`getSettings` async — WON'T FIX.** Confirmed synchronous (no I/O; reads in-memory Zod config), and already carries an explanatory docstring. De-asyncing means touching ~40 call sites for a LOW-severity finding — not worth the churn.
- **#7 (isPrivileged predicate) — folded into Wave 2**, done alongside the #1 command extractions rather than as a standalone pass, since most scattered checks live in the same files #1 rewrites.
- **`messagePipeline` dispatcher/provider mislabel — upgraded to full re-seat**, done as part of Wave 3 alongside #5. It should mirror `Event.routes[]` (a message-dispatch mechanism, not a domain provider), with each safety provider owning its own side-effects.
- **Characterization tests are scaffolding only** — written to pin risky waves (#1 extraction, #2 embed→audit swap, pipeline re-seat), deleted once each wave is green. No permanent suite, per scope B.

Wave order: **0** mechanical (done) → **1** #2 embed-as-database fix → **2** #1 full command extraction + new `events` provider + #7 → **3** pipeline re-seat + #5 → **4** #9 BaseEmbed/embed cleanup.

---

## Cross-cutting seam breaks (ranked — these matter more than any single finding)

### 1. HIGH — Business logic leaked out of providers into commands

The dominant defect. The provider seam exists but the depth leaked past it into the interaction layer, so commands hold whole features and can't be tested without a live Discord interaction.

- `commands/modmail.ts:114-479` — 365-line workflow engine (open/message/attach/close/summarize/archive/audit). Provider only called for 2 of ~10 steps.
- `commands/event.ts:49-541` — **no events provider exists at all**; timezone math, cron validation, live signup collector, DM fan-out all inline.
- `commands/warn.ts:167-216` — auto-mute escalation (core moderation) inline instead of beside `automod.issueAutoWarn`.
- `commands/court.ts:92-196` — case-open (thread, muted role, aggregate counts, notice embed) inline; court provider owns only vote/outcome.
  > Fix pattern: every `executeCommand` should parse Discord options and call ONE provider method. Move bodies into `modmail`/`events`(new)/`automod`/`court` providers.

### 2. HIGH — "Discord embed as database" (silent-corruption risk)

State round-trips through UI text with no typed contract; a wording change silently breaks logic.

- `verification/actions.ts:29` (write) ↔ `verification/review.ts:47` (read) — answers serialized into embed fields, parsed back by regex `\(([^)]+)\)$` + `REVERSE_DISPLAY_NAMES`, and that parse **feeds role grants**. The same answers are ALREADY persisted (`recordAuditEvent VerificationAnswered`, run.ts:102). Read the record, not the embed.
- `modmail/summarizer.ts:55-64` ↔ `interactions.ts:115,124` — user-vs-moderator classified by embed author-suffix `" — User"` / `" — Moderator"` magic strings emitted 40 lines away, no shared constant.

### 3. HIGH — No dependency injection at the call boundary

The seam is at the module edge but not the call edge, so nothing downstream is unit-testable and cross-cutting operations must bypass the layer.

- `database/client.ts:15` — `getDb()` global throwing singleton, called inline in all 27 repos. No `tx` threading.
- Consequence: `repositories/gdprDeletion.ts:26` re-hardcodes ~18-table deletion inside one transaction, duplicating every per-user delete repo fn, because repos can't accept a `tx`.
- `models/Exceptions.ts:19` — `BotException` constructor fires `logDiscord().then(log)` — unawaited IO + implicit ordering in a constructor.
- `models/Event.ts:97-109`, `models/Schedulable.ts:71-110` — models call `getSettings()`/`guilds.fetch` inline.
  > Fix pattern: optional last param `db: Database = getDb()` on repo fns (backward-compatible, unlocks tx + tests); constructors pure, expose `report()`/`render()` the caller awaits.

### 4. HIGH/MED — Duplicated primitives with no owning module

Each is a missed deep module; the leverage is currently zero because every caller re-pays the whole interface.

- **Ollama transport** hand-rolled 3× — `ollama/index.ts:40`, `court/summarizer.ts:20`, `modmail/summarizer.ts:24`. court/modmail bypass the `ollama` barrel. → `ollama.generate({system,prompt,timeoutMs})`.
- **Sliding-window/counter Map** re-implemented 3× — `antispam` spamWindows, `autoslowmode` channelStates, `sticky` counters. → one `SlidingWindowCounter` util (also fixes the unbounded-Map memory leak, below).
- **Moderation-issue ritual** copy-pasted — `warn.ts:100-157`, `mute.ts:48-97`, `ban.ts:53-95` (upsertUser pair, validate, insert, dual-embed log, AuditEntry). → `issueModerationAction({target,moderator,kind,reason,expiresAt})`.
- **Modmail close sequence** 3× — `commands/modmail.ts:336-383,401-453`, `modmailSchedulable.ts:106-153`. → `modmail.finalizeModmailClose(client, modmail)`.
- **Discord timestamp** `<t:…:F>` inlined dozens of times; `event.ts` and `court.ts` each redefine a local `ts()`. → export one `ts(date, style)` from utilities.
- **Thread-message collection** loop duplicated in court/modmail summarizers. → `collectThreadMessages(channel, limit)`.

### 5. MED — Shallow providers; behaviour hoisted into `messagePipeline`

`antispam`/`autoslowmode`/`sticky` return only a verdict; the actual side effects (~250 lines: mute, lock, repost, embeds, audit) live in `messagePipeline`. Providers carry near-zero leverage per unit of interface.

- `messagePipeline/index.ts:46-157,186-234` (slowmode + spam-mute), `:24-44,163-171` (sticky repost).
- `sticky/index.ts:8,22-38` — barrel exposes 6 counter primitives; caller drives the loop by hand.
  > Fix pattern: push side-effect execution into the provider (`antispam.recordAndAct`, `autoslowmode.enforce`, `sticky.onMessage`); `messagePipeline` sequences deep calls, owns only the AsyncQueue + ordering (that spine IS correctly deep).

### 6. MED — Leaky barrels (interface advertises internals as contract)

- `harm/index.ts:12-13` — `export *` + `HateSpeechDetector` class; callers use only `getHarmDetector()` + result types.
- `profanity/index.ts:7-8`, `blocklist/index.ts:7` — export impl classes nobody instantiates.
- `verification/index.ts:1-3` — three `export *` publish the whole Flow DSL; only 4 symbols consumed outside.
  > Fix: export the factory + named result types only; keep impl classes and the DSL internal (relative imports).

### 7. MED — Permission rule has no single owner + `usePermissions` interface too narrow

"Who is privileged" smeared across 5+ sites (`usePermissions` ADMIN_USER_ID, `memberHasAnyPermission` ManageGuild, `event.ts`/`modmail.ts`/`userRecord.ts` each re-testing ManageGuild). `usePermissions` gates only at command granularity (AND over `requiredPermissions`), so per-subcommand/ownership gating is re-implemented inline (`modmail.checkModRole` ×4, `event.canManageEvent`/`isEventManager`).

> Fix: one `isPrivileged(member, settings)` predicate in `permissionCore`; let routes express per-subcommand rights.

### 8. MED — `Event` model: 3-path dispatch + inconsistent error isolation

`models/Event.ts:38-50` exposes `routes` / `handlers` / `executeCommand`. **`executeCommand` has zero uses** (12/12 fan-out events use `handlers`), yet CLAUDE.md documents it as _the_ fan-out mechanism (doc/code drift). `handlers` isolates per-item errors; `routes` does not → a throwing route handler becomes an unhandled rejection (loadEvents registers with no `.catch`).

> Fix: delete `executeCommand`, wrap `dispatchRoutes` with the same per-route isolation as `handlers`, update CLAUDE.md.

### 9. MED — Component base too shallow + duplication

- `components/BaseEmbed.ts:17-23` — absorbs only footer+timestamp, and only for the ~5 embeds that opt into `withBranding`; the other ~8 re-roll `.setColor().setTimestamp()`. `color` computed twice (super + render), `this.required.color` never read.
- `components/Modmail.ts:113-153` — `ModmailClosedByUser`/`ByMod`/`Dm` are 3 ~10-line modules differing by one title + one line + which actor. Deletion test: delete any two, keep one, lose nothing. → one `ModmailClosedEmbed({variant, actor})`. (`ModmailSummaryEmbed` is NOT a dupe — keep.)
- Embeds built raw inline in `event.ts:316-437`, `modmail.ts:271-306`, `Schedulable.ts:71-110` — violates the "every embed is a BaseEmbed subclass" rule.
  > Fix: template-method render in BaseEmbed (subclass returns content, base applies color/footer/timestamp); make branding opt-out.

---

## Deep exemplars — the template to copy

These are correctly shaped; new code should imitate them.

- **`Schedulable`** — tiny 5-field config hides cron lifecycle, `protect`, per-tick error isolation, Discord notify. The 9 job files are genuinely thin.
- **`permissionCore`** — `memberHasAllPermissions`/`memberHasAnyPermission` behind a clean `ROLE_COLUMN_BY_PERMISSION` map.
- **`external` poster seam** — 3 real adapters behind `ExternalPoster`, polymorphic dispatch in starboard. A **real** seam (2+ adapters), not hypothetical.
- **`charts`** — returns a `Buffer`, zero chartjs type leak.
- **`verification` Flow engine** — deep step DSL (once the barrel stops leaking it).
- **`getDb` seam** — right _location_; 185 edges are pure fan-in, only 2 legit bypasses. (Only the call-boundary injection is missing — finding #3.)
- **repos** `harmDetectionSamples.retroLabelHarmSamples`, `memberActivityDaily.flushActivityDeltas` — high leverage, multi-table work behind one call.
- **`interactionCreate` route table** — `customId.split(':')[0]` parsing centralized, does not leak to providers.

---

## Lower-severity / hygiene

- `database/settings.ts:80` — `getSettings` is `async` doing zero IO; 60-field hand-written type duplicating the Zod config. Drop `async` or derive the type.
- Repos mix `null` vs `undefined` for absence (`bans.ts` does both). Pick one layer-wide (`null`).
- `stats.ts:58` — sequential `count()` awaits; use `Promise.all`.
- `courtVotes.ts:22` — DTO indexed by raw enum value; use an explicit switch so a rename fails at compile time.
- `Client.ts:35` — `Object.freeze` on a `Collection` (Map) doesn't block `.set/.delete`; false immutability.
- `types/interactions.ts:126` — `EventOptions extends Interaction`, leaking command-only fields onto every event.
- `guildMemberUpdate.ts:14` — ordering invariant (record before enforce) encoded only as array position + comment.
- Unbounded module-level Maps (`_harmAlertState`, spamWindows, sticky counters) — no eviction, grow for process lifetime. TTL/size-bound them.
- `textSimilarity` provider — pure stateless math, one consumer; belongs in `utilities/`, not a provider dir.
- `harm/types.ts:2` — `HarmAction` per-category action modelled but never wired (dead interface / hypothetical seam). Wire it or delete it.
- `modmail/closeActions.ts` — correct adapter shape but ONE adapter (hypothetical seam); fine to keep, don't add indirection until a 2nd action lands.
- Intra-provider absolute imports (`court/vote.ts:6`, `verification/review.ts:33`) should be relative `./`.
- Loader inconsistency: events/commands auto-discover via `readdir`; schedulables hardcode an import list. Pick one.

---

## Suggested fix order (highest leverage first)

1. **#2 embed-as-database** — correctness risk on role grants; read from the audit record. Small, urgent.
2. **#3 inject `db`** into repos (optional param) — unlocks GDPR de-duplication (#4) and repo unit tests in one move.
3. **#1 extract provider methods** from `modmail`/`event`/`warn`/`court` commands — biggest structural win; create the missing `events` provider.
4. **#4 ownerless primitives** — `ollama.generate`, `SlidingWindowCounter`, `issueModerationAction`, `ts()`. Mechanical, high fan-in payoff.
5. **#8 Event model** — delete dead `executeCommand`, unify error isolation, fix the CLAUDE.md drift.
6. **#5/#6/#9** — push side-effects into safety providers, tighten barrels, deepen BaseEmbed + collapse the 3 modmail embeds.
