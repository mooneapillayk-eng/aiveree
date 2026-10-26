# GO-LIVE — turn on Aiveree's execution engine

Everything is built and tested. To make the **Act** tab live, connect three
external things. No code changes, no debugging — paste keys and deploy.

Estimated time: ~20 minutes.

---

## 1. Create the database tables (2 min)
In Supabase → SQL editor, paste and run **`agent-runtime/schema.sql`**.
Creates `agent_runs` and `agent_run_steps`. (Same Supabase project the app uses.)

## 2. Create a cloud browser account (5 min)
Sign up at **browserbase.com**, create a project, and copy:
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`

This gives each run its own isolated cloud browser plus a live-view URL for the
user to take over logins. (Without it, the service falls back to a local browser
with no takeover — fine for a smoke test, not for real users.)

## 3. Deploy the service to Fly.io (8 min)
```bash
cd agent-runtime
fly launch --no-deploy            # creates the app (accept "aiveree-agent")
fly secrets set \
  INTERNAL_SECRET="<same value as the Netlify site uses>" \
  ANTHROPIC_API_KEY="<same key the site uses>" \
  SUPABASE_URL="<same as site>" \
  SUPABASE_SERVICE_KEY="<same as site>" \
  BROWSERBASE_API_KEY="<from step 2>" \
  BROWSERBASE_PROJECT_ID="<from step 2>"
fly deploy
```
Note the URL it gives you, e.g. `https://aiveree-agent.fly.dev`.
Check it: `curl https://aiveree-agent.fly.dev/health` → `{"ok":true,...}`.

> Computer-use model: defaults are `CU_MODEL=claude-sonnet-4-5`,
> `CU_BETA=computer-use-2025-01-24`, `CU_TOOL=computer_20250124`. If your
> Anthropic account uses newer ids, set them as fly secrets too — no code change.

## 4. Point Aiveree at the service (3 min)
In **Netlify → site → environment variables**, add:
- `AGENT_SERVICE_URL = https://aiveree-agent.fly.dev`
- `INTERNAL_SECRET = <the exact same value you set on Fly>` (likely already set)

Redeploy the site (push to the production branch, or hit redeploy). Done — the
**Act** tab now runs real tasks. Until step 4 is set, the tab shows an honest
"execution service not connected yet" notice instead of breaking.

---

## What's already proven (so you're not debugging)
- `npm test` in `agent-runtime/` drives a **real browser** through
  login → resume → approval → resume → submit → complete, all persisted.
- Service HTTP contract (auth, validation, health) tested.
- The app builds and the Act UI renders the live view + checkpoints.

## Safety posture in v1
- Aiveree **never types passwords** — logins are handed to the user.
- **Explicit approval** before anything irreversible (send/submit/pay/delete/post).
- Full action log + a screenshot of the current screen on every step.
- **Recommended for v1: don't allow payments.** The approval gate covers it, but
  a hard spend-block + a site allowlist are the first hardening steps (Phase D).
