# TODO

## Hate-speech detector v2 — context-aware, self-learning, CPU-trained

📋 **Full plan & living roadmap:** [`.claude/tasks/2026-06-22-hate-speech-detector-v2.md`](.claude/tasks/2026-06-22-hate-speech-detector-v2.md)

**Where it stands (2026-06-22):**

- ✅ **Phase 0 — data capture** is code-complete. New `ml` Postgres schema with
  `ml.harm_detection_samples` (no FKs), repo + retro-labeling, automod capture, GDPR purge.
  Build + lint green.
- ⏳ **Blocked on operator:** run `bun run db:generate && bun run db:migrate` — verify the SQL
  contains `CREATE SCHEMA "ml"` first. The read-only `ml` training role is now provisioned
  automatically by the postgres init scripts (`ML_DB_USER`/`ML_DB_PASSWORD`); no manual GRANT needed.

**Pick up here tomorrow:**

1. Decide: commit Phase 0, then start **Phase 1** (context-aware `/detect` contract + config-driven thresholds).
2. **Stage C — switch to self-hosted `qwen3-30b-a3b-instruct-2507`** (new agenda item). Decide
   online detector vs. offline teacher/judge; benchmark a Q4/Q5 quant's tokens/sec + RAM on the
   target GPU-less box. Self-hosted → satisfies hard-constraint #2 (replaces the dropped Claude-teacher idea).
3. Answer the 5 open questions for the operator (bottom of the roadmap).

## Scaffolding improvements — enterprise single-guild hardening

📋 **Full plan & living roadmap:** [`.claude/tasks/2026-06-22-scaffolding-improvements.md`](.claude/tasks/2026-06-22-scaffolding-improvements.md)

**Where it stands (2026-06-22):**

- ✅ **Tier 1 (PR 1–4)** — CI build gate, middleware guard lifted into `Command.execute()`,
  loaders collapsed, global error handlers + clean shutdown.
- ✅ **Tier 2 (PR 5, 7)** — all 31 providers barrel via `index.ts`; embeds unified on
  `BaseEmbed` + `withBranding()`. **PR 6 (route auto-discovery) rejected** — explicit table kept.
- ✅ **Tier 4 (PR 12–15)** — pool `max` 5→15 + `getPoolStats()`, settings cache TTL, env
  value validation, `node:http` `/health` endpoint. No new dependencies.
- Verified repo-wide: prettier clean, `tsc --build --force` green, eslint green.
- ⏳ **Not committed** — working tree also holds the hate-speech-detector-v2 changes; needs a
  staged/atomic commit of only the scaffolding files (or operator stages it).

**Pick up here tomorrow:**

1. Decide commit strategy for the uncommitted scaffolding work (branch + atomic per-PR commits
   of only our files, vs. operator stages manually).
2. Start **Tier 3 — AI-readiness (PR 8–11):** shared `LlmClient` (retry/backoff/token-accounting,
   pure refactor of existing `fetch` calls — no new deps), externalize the Ollama prompt to
   `config/prompts/`, wire RAG→LLM grounded answers, tool-calling/structured-output scaffolding.
3. Small follow-ups Tier 4 unlocked: add `HEALTHCHECK_PORT` to `.env.example` + a docker-compose
   healthcheck stanza; optionally surface `getPoolStats()` in the `/health` body.
