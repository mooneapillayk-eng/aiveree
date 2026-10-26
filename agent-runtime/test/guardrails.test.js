// Guardrail tests: the hard rails that don't depend on the model's judgement.
//  • unit: host matching, allowlist, payment detection
//  • payment: a click on a checkout page is HELD for approval, then runs on yes
//  • cancel: Stop halts a running task

const path = require('path');
const { hostOf, isAllowed, looksLikePayment } = require('../driver');
const { memStore } = require('../store');
const { startRun, resumeRun, cancelRun } = require('../orchestrator');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(c, m) { if (!c) throw new Error('ASSERT FAILED: ' + m); }
async function waitFor(store, id, status, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await store.getRun(id);
    if (r && r.status === status) return r;
    if (r && r.status === 'error') throw new Error('errored: ' + r.result);
    await sleep(150);
  }
  const r = await store.getRun(id);
  throw new Error(`timeout for "${status}" (last: ${r && r.status})`);
}

let seq = 0;
const tu = () => `tu_${++seq}`;
const comp = (input) => ({ content: [{ type: 'tool_use', id: tu(), name: 'computer', input }] });
const complete = (summary) => ({ content: [{ type: 'tool_use', id: tu(), name: 'task_complete', input: { summary, result: summary } }] });

(async () => {
  try {
    // ── unit ──
    assert(hostOf('https://www.Example.com/x') === 'example.com', 'hostOf strips www');
    assert(isAllowed('https://shop.example.com', ['example.com']) === true, 'subdomain allowed');
    assert(isAllowed('https://evil.com', ['example.com']) === false, 'off-list blocked');
    assert(isAllowed('https://evil.com', []) === true, 'empty list allows all');
    assert(looksLikePayment('https://x/checkout', '') === true, 'payment url detected');
    assert(looksLikePayment('https://x/home', 'Proceed to Checkout now') === true, 'payment text detected');
    assert(looksLikePayment('https://x/about', 'our story') === false, 'non-payment is clear');
    console.log('  ✓ unit: host/allowlist/payment detection');

    // ── payment hold ──
    const store = memStore();
    let payCalls = 0;
    const payScript = [() => comp({ action: 'left_click', coordinate: [60, 90] }), () => complete('Payment completed after approval')];
    const payLlm = async () => payScript[Math.min(payCalls++, payScript.length - 1)]();
    await startRun({ store, run_id: 'pay1', user_id: 'u', task: 'buy it', start_url: 'file://' + path.join(__dirname, 'pay.html'), llm: payLlm, headless: true });

    const cp = await waitFor(store, 'pay1', 'needs_approval');
    assert(/payment|checkout/i.test(cp.checkpoint_summary || ''), 'checkout click held for approval');
    console.log('  ✓ payment click held for approval:', cp.checkpoint_summary);

    await sleep(80);
    const r = await resumeRun({ store, run_id: 'pay1', note: 'Approved', llm: payLlm });
    assert(!r.error, 'approval resume accepted');
    const done = await waitFor(store, 'pay1', 'complete');
    assert(/approval/i.test(done.result || ''), 'completed after approval');
    console.log('  ✓ ran only after explicit approval');

    // ── cancel ──
    const store2 = memStore();
    const infLlm = async () => comp({ action: 'left_click', coordinate: [40, 40] });
    await startRun({ store: store2, run_id: 'c1', user_id: 'u', task: 'loop', start_url: 'https://example.com', llm: infLlm, headless: true });
    await waitFor(store2, 'c1', 'running');
    await sleep(300);
    await cancelRun({ store: store2, run_id: 'c1' });
    const stopped = await store2.getRun('c1');
    assert(stopped.status === 'stopped', 'cancel sets stopped');
    console.log('  ✓ Stop halts a running task');

    console.log('\nPASS — guardrails verified (allowlist, payment hold, cancel).');
    process.exit(0);
  } catch (e) {
    console.error('\nFAIL —', e.message);
    process.exit(1);
  }
})();
