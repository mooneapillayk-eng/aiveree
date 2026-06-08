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

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`.

## Known issues / suggested review focus

1. **Payments are stubs.** `stripe.js`, `subscribe.js` return success without doing anything. No real billing yet.
2. **`App.jsx` is a single 1,500-line file.** Candidate for component extraction (`Homepage`, `Onboarding`, `AuthScreen`, `CommandCentre`, `CapabilityRunner`). Review for maintainability.
3. **Embeddings cost/latency.** Every memory write calls OpenAI. Review batching/caching.
4. **Workstream execution runs N sequential Claude calls** on dashboard load (one per task, some with web search). Review latency, cost, and credit accounting (currently the dashboard build and workstream exec may not decrement credits the same way chat does — verify intended behaviour).
5. **`user_id` is `user.id || user.email`.** Confirm this is stable and consistent across all function calls and table keys.
6. **All inline styles, no design system.** Review for consistency and whether a token layer is warranted.
7. **No automated tests.** Review critical paths (auth, persistence) for test coverage needs.
8. **Security:** functions use `SUPABASE_SERVICE_KEY` (bypasses RLS) and permissive `using(true)` policies. Review the trust boundary — is any function callable without auth that shouldn't be?
9. **Secrets hygiene:** confirm no keys are committed; `ELEVENLABS_API_KEY` was previously exposed in chat and should be rotated.

## Database

`workstreams_table.sql` (this build) creates `workstreams` and `dashboards` tables — must be run in Supabase. A larger schema (`aiveree_schema_v3.1.sql`, 17 tables, not in this bundle) defines the full memory/goals/tasks/approvals model; confirm which tables actually exist in the live project.
