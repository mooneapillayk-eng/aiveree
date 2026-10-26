// ─── INTEGRATION TEST ─────────────────────────────────────────────────────────
// Real browser (local Chromium) + stubbed model. Proves the entire execution
// path end to end, without any external account or API key:
//   start -> login checkpoint -> resume -> actions -> approval checkpoint ->
//   resume -> submit -> complete, with every step persisted to the store.

const path = require('path');
const { memStore } = require('../store');
const { startRun, resumeRun } = require('../orchestrator');
const { makeMock } = require('./mock-llm');

const PAGE = 'file://' + path.join(__dirname, 'page.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(store, id, status, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await store.getRun(id);
    if (r && r.status === status) return r;
    if (r && r.status === 'error') throw new Error(`run errored: ${r.result}`);
    await sleep(150);
  }
  const r = await store.getRun(id);
  throw new Error(`timeout waiting for "${status}" (last status: ${r && r.status})`);
}

function assert(cond, msg) { if (!cond) throw new Error('ASSERT FAILED: ' + msg); }

(async () => {
  const store = memStore();
  const llm = makeMock();
  const run_id = 'test-run-1';

  try {
    await startRun({ store, run_id, user_id: 'u1', task: 'Send a supplier an enquiry', start_url: PAGE, llm, headless: true });

    // 1. Should stop at the login checkpoint (agent never types a password).
    const cp1 = await waitFor(store, run_id, 'needs_login');
    assert(cp1.checkpoint_kind === 'login', 'first checkpoint is a login');
    console.log('  ✓ stopped for human login:', cp1.checkpoint_summary);

    // 2. Human logs in -> resume.
    await sleep(80);
    const r1 = await resumeRun({ store, run_id, note: 'I have logged in', llm });
    assert(!r1.error, 'resume after login accepted (' + (r1.error || 'ok') + ')');

    // 3. Should stop again for approval before submitting.
    const cp2 = await waitFor(store, run_id, 'needs_approval');
    assert(cp2.checkpoint_kind === 'approval', 'second checkpoint is an approval');
    console.log('  ✓ stopped for approval before submit:', cp2.checkpoint_summary);

    // 4. Human approves -> resume -> complete.
    await sleep(80);
    const r2 = await resumeRun({ store, run_id, note: 'Approved', llm });
    assert(!r2.error, 'resume after approval accepted');

    const done = await waitFor(store, run_id, 'complete');
    assert((done.result || '').includes('AIV-123'), 'result carries the confirmation reference');
    console.log('  ✓ completed with result:', done.result);

    // 5. Steps were logged for the live view.
    const steps = await store.listSteps(run_id);
    assert(steps.length >= 2, 'browser steps were recorded (' + steps.length + ')');
    assert(store.getRun && (await store.getRun(run_id)).latest_shot, 'a latest screenshot was captured');
    console.log('  ✓ recorded', steps.length, 'steps + live screenshot');

    console.log('\nPASS — full execution path proven (real browser, login + approval gates, resume, completion).');
    process.exit(0);
  } catch (e) {
    console.error('\nFAIL —', e.message);
    process.exit(1);
  }
})();
