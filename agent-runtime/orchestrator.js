// ─── ORCHESTRATOR ─────────────────────────────────────────────────────────────
// Owns the lifecycle of a run: spins up a browser, runs the driver in the
// background, persists visible state to the store as events stream in, and
// parks the run in memory at a checkpoint so a human can resume it.

const { Browser } = require('./browser');
const { runTask, resumeTask } = require('./driver');
const { createCloudBrowser } = require('./cloudbrowser');

const active = new Map(); // run_id -> { browser, messages, toolUseId, pendingAction, cancelled, status }

// Hard rails from the environment (safe defaults: payments blocked).
function envGuard() {
  const allowlist = (process.env.ALLOWED_DOMAINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const disallowPayments = process.env.ALLOW_PAYMENTS !== 'true';
  return { allowlist, disallowPayments };
}

function persister(store, runId) {
  return async (e) => {
    try {
      if (e.type === 'step') {
        await store.addStep(runId, { action: e.action, url: e.url });
        await store.updateRun(runId, { latest_shot: e.screenshot, status: 'running' });
      } else if (e.type === 'thought') {
        await store.updateRun(runId, { thought: e.text });
      } else if (e.type === 'checkpoint') {
        await store.updateRun(runId, {
          status: e.kind === 'login' ? 'needs_login' : 'needs_approval',
          checkpoint_kind: e.kind,
          checkpoint_summary: e.summary || e.reason || '',
          checkpoint_details: e.details || e.url || '',
        });
      } else if (e.type === 'done') {
        await store.updateRun(runId, { status: 'complete', result: e.result || e.summary || '', checkpoint_kind: null });
      } else if (e.type === 'stopped' || e.type === 'idle') {
        await store.updateRun(runId, { status: 'stopped', result: e.reason || e.text || '' });
      }
    } catch { /* store failures must never crash the run */ }
  };
}

async function startRun({ store, run_id, user_id, task, start_url, llm, headless = true }) {
  await store.createRun({ id: run_id, user_id, task, start_url, status: 'running' });
  const rec = { browser: null, messages: null, toolUseId: null, pendingAction: null, cancelled: false, status: 'running' };
  active.set(run_id, rec);

  // Everything heavy (cloud-browser session, launch, the run loop) happens in
  // the background so the HTTP caller gets run_id back immediately and polls.
  (async () => {
    try {
      let cloud = null;
      try { cloud = await createCloudBrowser(); } catch (e) { await store.updateRun(run_id, { thought: `cloud browser unavailable, using local: ${e.message}` }); }
      const browser = new Browser();
      await browser.start({ headless, wsEndpoint: cloud?.wsUrl });
      rec.browser = browser;
      if (cloud?.liveUrl) await store.updateRun(run_id, { live_url: cloud.liveUrl });

      const onEvent = persister(store, run_id);
      const state = await runTask({ browser, task, startUrl: start_url, onEvent, llm, guard: envGuard(), shouldStop: () => rec.cancelled });
      rec.messages = state.messages; rec.status = state.status; rec.toolUseId = state.toolUseId; rec.pendingAction = state.pendingAction || null;
      if (state.status === 'complete' || state.status === 'stopped') { await browser.close(); active.delete(run_id); }
    } catch (err) {
      await store.updateRun(run_id, { status: 'error', result: String((err && err.message) || err) });
      try { await rec.browser?.close(); } catch {}
      active.delete(run_id);
    }
  })();

  return { run_id, status: 'running' };
}

async function resumeRun({ store, run_id, note, llm }) {
  const rec = active.get(run_id);
  if (!rec) return { error: 'run not active (it ended, or the host restarted mid-run)' };
  if (!rec.toolUseId || !rec.messages) return { error: 'run is not at a checkpoint yet' };
  const onEvent = persister(store, run_id);
  await store.updateRun(run_id, { status: 'running', checkpoint_kind: null });
  const pendingAction = rec.pendingAction;
  rec.pendingAction = null;

  (async () => {
    try {
      const state = await resumeTask({ browser: rec.browser, toolUseId: rec.toolUseId, humanNote: note, pendingAction, messages: rec.messages, onEvent, llm, guard: envGuard(), shouldStop: () => rec.cancelled });
      rec.messages = state.messages; rec.status = state.status; rec.toolUseId = state.toolUseId; rec.pendingAction = state.pendingAction || null;
      if (state.status === 'complete' || state.status === 'stopped') { await rec.browser.close(); active.delete(run_id); }
    } catch (err) {
      await store.updateRun(run_id, { status: 'error', result: String((err && err.message) || err) });
      try { await rec.browser.close(); } catch {}
      active.delete(run_id);
    }
  })();

  return { run_id, status: 'running' };
}

// Cancel a run (the human hit Stop). Takes effect at the next loop checkpoint.
async function cancelRun({ store, run_id }) {
  const rec = active.get(run_id);
  if (rec) rec.cancelled = true;
  await store.updateRun(run_id, { status: 'stopped', result: 'Stopped by you.', checkpoint_kind: null });
  return { run_id, status: 'stopped' };
}

module.exports = { startRun, resumeRun, cancelRun, active };
