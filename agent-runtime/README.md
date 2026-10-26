# Aiveree Agent Runtime — the execution engine ("Aiveree's hands")

This is how Aiveree *acts in the real world* the way Grok agents and Meta Muse
do: it drives a **real browser** and operates websites like a person — **no
per-app APIs**. It logs in with the user's own session (the user types the
password, never the agent), reads the screen, clicks and types, and **stops for
human approval before anything irreversible**.

## Status (honest)

| Piece | State |
|---|---|
| Browser action layer (`browser.js`) | ✅ **Working** — proven here on local Chromium (`npm run smoke`) |
| Computer-use driver + safety loop (`driver.js`) | ✅ Built, runs with `ANTHROPIC_API_KEY` (not set in the dev box) |
| CLI runner with human-in-the-loop (`run.js`) | ✅ Built — `node run.js "<task>"` |
| Hosted cloud browser (Browserbase/Steel) | ⬜ Needs an account + key (`CHROMIUM_WS`) |
| Long-running host (not Netlify) | ⬜ Needs Fly.io/Railway/Render |
| Wired into the Aiveree app (dispatch + live view + approvals) | ⬜ Next |

## How it works

1. `browser.js` — the hands. Primitives a computer-use model emits: `goto`,
   `screenshot`, `click(x,y)`, `type`, `press`, `scroll`, `text`. Local Chromium
   now; set `CHROMIUM_WS` to point at a hosted cloud browser in production.
2. `driver.js` — the brain. Shows Claude a screenshot → Claude returns an action
   → we execute it → screenshot again → loop. Three safety tools are always
   present:
   - `request_human_login` — any login/2FA screen: stop, hand the live browser
     to the user. **The agent never types a password.**
   - `request_approval` — before send / submit / pay / delete / post: stop and
     get an explicit human "yes".
   - `task_complete` — done, with a summary and any result (confirmation, link).
   The loop **pauses at checkpoints** and returns its message history so it can
   be **resumed** after the human acts (`resumeTask`).
3. `run.js` — drive one task from the terminal with real human-in-the-loop.

## Run it

```bash
npm install                 # playwright library only (browsers are pre-provided)
npm run smoke               # proves the browser layer works (no key needed)

ANTHROPIC_API_KEY=sk-... \
  node run.js "add a 4kg dumbbell to the basket on a UK retailer" https://google.com
# HEADLESS=0 to watch, SHOTS=1 to save a screenshot per step
```

## Safety model (built in, not optional)

- **No passwords held by the agent** — logins are always handed to the human.
- **Human approval before anything irreversible** — sending, submitting, paying,
  deleting, posting.
- **Scoped to the task** — the system prompt forbids wandering or extra actions.
- **Full action log + screenshot per step** — everything is reviewable.
- Production must add: encrypted, per-user isolated browser sessions; spend
  caps; a site allowlist to start; and a hard kill switch.

## What this needs to go live (the parts only you can set up)

1. **A long-running host** — Netlify functions are too short-lived to hold a
   browser session. A small container service on **Fly.io / Railway / Render**.
2. **A hosted cloud browser** — **Browserbase** or **Steel** (gives each user an
   isolated cloud browser with a live-view URL for takeover). Set `CHROMIUM_WS`.
   (Self-hosting Chromium per user is possible but heavier to scale.)
3. **Computer-use access** — the existing `ANTHROPIC_API_KEY`; confirm the
   computer-use beta + model id (`CU_MODEL`, `CU_BETA`, `CU_TOOL`).
4. **Product/safety calls** — starting site allowlist, spend cap, and whether
   money actions are allowed in v1 at all.

Once (1)–(2) exist, the same `driver.js` runs unchanged against the cloud
browser, and we wire it into Aiveree: a "Aiveree is doing it" live-view panel,
and the dead `approvals` flow becomes the real approve → execute gate.
