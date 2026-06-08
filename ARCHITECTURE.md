# Aiveree — Architecture & Review Brief

This document gives a reviewer the context needed to assess the codebase. Read it before the code.

## What Aiveree is

A persistent AI executive assistant for non-technical ambitious people pursuing career and business goals. The user talks to one entity ("Aiveree"); behind her sits an invisible specialist team. Core principle: **action over conversation** — every feature must execute real work, not just chat. The product promise is continuity, proactivity, and momentum: it keeps working after you close the tab and reaches out when you go quiet.

## Stack

- **Frontend:** React + Vite, single-file `src/App.jsx` (~1,500 lines). No router; view switching via a `screen` state in the top-level `App` component (`home | onboarding | auth | dashboard | projects`).
- **Styling:** All inline styles. Fonts: Poppins (headlines), Inter (body). Brand purple `#5b21b6` / `#a78bfa`, near-black `#0a0a0a`.
- **Backend:** Netlify serverless functions in `netlify/functions/`.
- **Database:** Supabase (Postgres + pgvector for memory embeddings). Client in `src/supabase.js`.
- **AI:** Anthropic Claude (`claude-sonnet-4-20250514`) via `netlify/functions/claude.js`. Embeddings via OpenAI `text-embedding-3-small`.
- **Voice:** ElevenLabs (TTS `elevenlabs-tts.js`, STT `elevenlabs-stt.js`). Browser Web Speech API for input.
- **Messaging:** Twilio WhatsApp (`whatsapp.js`) for proactive outreach.
- **Deploy:** Netlify. Build `npm run build`, deploy `netlify deploy --prod --dir=dist`.

## Key flows

### Onboarding → dashboard
1. `Homepage` → `Onboarding` collects the user's goal and domain.
2. `AuthScreen` creates the account (`auth.js` → Supabase).
3. `CommandCentre` (the dashboard) generates an adaptive operational environment.

### Dashboard generation (`CommandCentre`, the core component)
On load it builds a five-section workspace by calling `claude.js` with a structured-JSON prompt:
1. **Momentum Overview** — chief-of-staff briefing.
2. **Next Best Action** — one specific behaviourally-relevant action (the centrepiece).
3. **Active Workstreams ("In motion")** — real work, see below.
4. **Open Loops** — decisions/inputs surfaced calmly.
5. **Quiet Progress** — background work, for the feeling of continuity.
It also generates `suggested_capabilities` — goal-specific action buttons (not generic domain buttons).

### Real workstream execution + persistence (most recent build)
- After the dashboard loads, each workstream is **actually executed**: a real `claude.js` call (with web search when the task involves research) produces a concrete deliverable.
- Tasks move `in_progress → complete`; completed tasks open a viewer showing the real output.
- **Persistence:** dashboard structure and each completed workstream are saved to Supabase via `workstreams.js` (`save_dashboard` / `save`) and reloaded on next session (`load_dashboard` / `load`), keyed by `user_id` + `goal_key`. Requires `workstreams_table.sql` to be run.

## Function inventory (`netlify/functions/`)

| File | Purpose | Status |
|---|---|---|
| `claude.js` | Main Claude proxy (chat, dashboard gen, workstream exec). Supports `useSearch`. | Active |
| `memory.js` | Unified memory: write/read/search/build_context, embeddings. | Active |
| `workstreams.js` | Workstream + dashboard persistence. | New |
| `auth.js` | Account creation / login via Supabase. | Active |
| `agent.js` | Specialist team-member task execution (726 lines). | Active |
| `events.js` | Event log / recent activity. | Active |
| `approvals.js` | Approval queue for outward actions. | Active |
| `digest.js` | Scheduled daily digest (see `netlify.toml`). | Active |
| `data-ingest.js` / `data-query.js` | External data ingestion + querying. | Active |
| `intelligence.js` | Behavioural/state intelligence. | Active |
| `organisation.js` | Org/usage tracking. | Active |
| `whatsapp.js` | Twilio WhatsApp proactive outreach. | Active |
| `elevenlabs-tts.js` / `elevenlabs-stt.js` | Voice out/in. | Active |
| `credits.js` | Free-tier credit tracking. | Active |
| `pro-content.js` | Pro-tier content. | Active |
| `tools.js` | Tool registry read. | Active (minified) |
| `admin.js` | Admin utilities. | Active |
| `stripe.js` | **STUB** — returns `{success:true}`. | Needs implementation |
| `subscribe.js` | **STUB** — returns `{success:true}`. | Needs implementation |
| `submit-tool.js` | **STUB** — returns `{success:true}`. | Needs implementation |
| `rank-tools.js` | **STUB** — returns `{success:true}`. | Needs implementation |

## Environment variables (set in Netlify)

Core: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`.

Security / config (added):
- `INTERNAL_SECRET` — shared secret for service-to-service calls (claude→memory/events, digest→events/memory, whatsapp→tts). If unset, internal calls degrade gracefully but cross-function context (memory injection, event logging) won't work.
- `CRON_SECRET` — header secret to manually trigger `digest.js`; the native Netlify schedule needs no header.
- `ADMIN_KEY` — required to manually trigger `data-ingest.js`; `ADMIN_SECRET` gates `admin.js`.
- `ALLOWED_ORIGINS` — comma-separated extra origins for the CORS allowlist (in addition to `URL`/`DEPLOY_PRIME_URL` and localhost).
- `CLAUDE_MODEL` — overrides the default model id used by all functions.
- `FREE_DAILY_CREDITS` — free-tier credits per day (default 5).

## Security model

- **Token auth.** All user-facing functions derive `user_id` from the Supabase bearer token (`requireUser`/`resolveUser` in `lib/shared.js`), never from the request body. The frontend obtains a real session via `auth.js` and attaches it with `apiFetch`.
- **Onboarding exception.** `claude.js` accepts an unauthenticated call only when `mode:"onboarding"`, under a tight per-IP daily cap, so the pre-signup flow works without opening the proxy.
- **Credit gating.** Billable Claude/agent calls consume a server-side credit (`consumeCredit`); out-of-credit returns HTTP 402.
- **Rate limiting + CORS.** Per-user/IP limits (`rate_limits` table) and an origin allowlist replace the previous `*` CORS.
- **Webhooks/cron.** `whatsapp.js` verifies the Twilio signature; scheduled jobs reject public HTTP without the internal/cron/admin secret.

## Known issues / suggested review focus

1. **Payments are stubs.** `stripe.js`, `subscribe.js` return success without doing anything — **deferred** until a Stripe account + price IDs + webhook secret exist.
2. **`App.jsx` is a single ~1,500-line file.** Component extraction is **deferred** to a follow-up to keep this security pass reviewable.
3. **Schema drift (needs live-DB confirmation).** Auth/credits use table `profiles`; `src/supabase.js` and some functions read `user_profiles`, `user_state`, `goals`, etc. The live schema could not be verified from this environment (the network policy blocks `api.supabase.com`). Confirm which tables/columns exist and consolidate.
4. **Secrets hygiene:** `ELEVENLABS_API_KEY` (and any Supabase access token shared in chat) should be **rotated**.

## Database

Run in Supabase: `workstreams_table.sql` (`workstreams`, `dashboards`), `supabase_storage_setup.sql`, and `security_setup.sql` (`rate_limits`, supports rate limiting). A larger schema (`aiveree_schema_v3.1.sql`, 17 tables, not in this bundle) defines the full memory/goals/tasks/approvals model; confirm which tables actually exist in the live project.

## Tests / CI

`npm test` (Vitest) covers the shared auth/CORS helpers. GitHub Actions (`.github/workflows/ci.yml`) runs build + tests on push/PR.
