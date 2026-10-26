// ─── AIVEREE COMPUTER-USE DRIVER ──────────────────────────────────────────────
// The "brain" that pilots the browser. It shows Claude a screenshot, Claude
// decides the next action (click / type / scroll / navigate), we execute it on
// the real page, screenshot again, and loop — exactly how Grok Bot and Muse
// operate software, with no per-app APIs.
//
// Safety is built in, not bolted on. The model has two non-negotiable tools:
//   • request_human_login  → stop, hand the live browser to the user to sign in
//   • request_approval     → stop, get explicit human OK before anything
//                            irreversible (sending, submitting, paying)
// The loop STOPS at a checkpoint and returns its full message history so an
// orchestrator can resume it after the human acts. Nothing irreversible happens
// without a person saying yes.

const BETA = process.env.CU_BETA || 'computer-use-2025-01-24';
const TOOL_TYPE = process.env.CU_TOOL || 'computer_20250124';
const MODEL = process.env.CU_MODEL || 'claude-sonnet-4-5';

const SAFETY = `You are Aiveree's hands. You complete a task for the user by operating a real web browser, the way a careful person would.

Non-negotiable rules:
- You can read, navigate, click, type and scroll freely to make progress.
- The moment you reach a sign-in / login / password / 2FA screen, STOP and call request_human_login. Never type someone's password yourself.
- Before ANYTHING irreversible or consequential — sending a message or email, submitting a form, placing an order, spending money, deleting something, posting publicly — STOP and call request_approval with a plain-English summary of exactly what you are about to do. Wait for a yes.
- Stay strictly within the task you were given. Do not wander, buy extras, or change unrelated settings.
- When the task is fully done, call task_complete with a short summary of what you achieved and any result the user needs (confirmation numbers, links).
- Work in plain English, British spelling, no em-dashes in anything you write.`;

function computerTools(width, height) {
  return [
    { type: TOOL_TYPE, name: 'computer', display_width_px: width, display_height_px: height },
    { name: 'request_human_login', description: 'Stop and hand the live browser to the user to sign in. Use for any login, password, or 2FA screen.',
      input_schema: { type: 'object', properties: { reason: { type: 'string' }, url: { type: 'string' } }, required: ['reason'] } },
    { name: 'request_approval', description: 'Stop and get explicit human approval before an irreversible or consequential action (send, submit, pay, delete, post).',
      input_schema: { type: 'object', properties: { summary: { type: 'string' }, details: { type: 'string' } }, required: ['summary'] } },
    { name: 'task_complete', description: 'The task is fully done. Summarise what was achieved and any result the user needs.',
      input_schema: { type: 'object', properties: { summary: { type: 'string' }, result: { type: 'string' } }, required: ['summary'] } },
  ];
}

async function anthropic(messages, tools, system) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': BETA,
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 2048, system, tools, messages }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function shotBlock(b64) {
  return { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } };
}

// Execute one computer action against the browser, return a short label.
async function applyComputerAction(browser, input) {
  const a = input.action;
  const [x, y] = input.coordinate || [];
  switch (a) {
    case 'screenshot': return 'screenshot';
    case 'left_click': await browser.click(x, y); return `click ${x},${y}`;
    case 'double_click': await browser.doubleClick(x, y); return `double-click ${x},${y}`;
    case 'mouse_move': await browser.move(x, y); return `move ${x},${y}`;
    case 'type': await browser.type(input.text || ''); return `type "${(input.text || '').slice(0, 40)}"`;
    case 'key': await browser.press((input.text || '').replace(/\s+/g, '+')); return `key ${input.text}`;
    case 'scroll': {
      const amt = (input.scroll_amount || 3) * 100;
      const dir = input.scroll_direction;
      await browser.scroll(dir === 'left' ? -amt : dir === 'right' ? amt : 0, dir === 'up' ? -amt : dir === 'down' ? amt : 0);
      return `scroll ${dir}`;
    }
    case 'wait': await browser.page.waitForTimeout(Math.min((input.duration || 1) * 1000, 5000)); return 'wait';
    case 'cursor_position': return 'cursor_position';
    default: return `unsupported:${a}`;
  }
}

// ── Guardrails (hard limits, independent of the model's judgement) ──
function hostOf(u) { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } }
function isAllowed(u, allow) {
  if (!allow || !allow.length) return true;      // empty list = allow all (dev)
  const h = hostOf(u);
  if (!h) return true;                           // about:blank / data: etc.
  return allow.some((a) => h === a || h.endsWith('.' + a));
}
const PAY_RE = /checkout|payment|\/pay(\b|ment)|billing|basket|stripe|paypal|klarna|worldpay|card-?details|place-?order|buy-?now/i;
function looksLikePayment(url, text) { return PAY_RE.test(url || '') || PAY_RE.test((text || '').slice(0, 2000)); }
async function safeText(browser) { try { return await browser.text(); } catch { return ''; } }
const tr = (id, text, shot) => ({ type: 'tool_result', tool_use_id: id, content: shot ? [{ type: 'text', text }, shotBlock(shot)] : [{ type: 'text', text }] });

// Run until the agent reaches a checkpoint, is cancelled, or completes.
//  guard        {allowlist:[], disallowPayments:true} — hard rails
//  shouldStop() lets a human cancel mid-run
//  timeBudgetMs caps wall-clock
//  llm          injectable (stubbed in tests)
async function runTask({ browser, task, startUrl, messages = null, onEvent = () => {}, maxSteps = 40, llm = anthropic, guard = {}, shouldStop = () => false, timeBudgetMs = 10 * 60 * 1000 }) {
  const { width, height } = await browser.size();
  const tools = computerTools(width, height);
  const allowlist = guard.allowlist || [];
  const disallowPayments = guard.disallowPayments !== false; // default ON
  const started = Date.now();

  if (!messages) {
    if (startUrl) await browser.goto(startUrl);
    const first = await browser.screenshot();
    messages = [{ role: 'user', content: [
      { type: 'text', text: `TASK: ${task}\n\nCurrent screen below. Begin.` },
      shotBlock(first),
    ] }];
  }

  for (let step = 0; step < maxSteps; step++) {
    if (shouldStop()) { onEvent({ type: 'stopped', reason: 'cancelled' }); return { status: 'stopped', reason: 'cancelled', messages }; }
    if (Date.now() - started > timeBudgetMs) { onEvent({ type: 'stopped', reason: 'time_budget' }); return { status: 'stopped', reason: 'time_budget', messages }; }

    const reply = await llm(messages, tools, SAFETY);
    messages.push({ role: 'assistant', content: reply.content });

    const toolUses = (reply.content || []).filter((b) => b.type === 'tool_use');
    const sayText = (reply.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    if (sayText) onEvent({ type: 'thought', text: sayText });

    if (toolUses.length === 0) { onEvent({ type: 'idle', text: sayText }); return { status: 'stopped', reason: 'no_action', messages }; }

    // Control tools end the turn; the pending tool_use is answered on resume.
    const login = toolUses.find((t) => t.name === 'request_human_login');
    if (login) { onEvent({ type: 'checkpoint', kind: 'login', ...login.input }); return { status: 'needs_login', toolUseId: login.id, messages }; }
    const approval = toolUses.find((t) => t.name === 'request_approval');
    if (approval) { onEvent({ type: 'checkpoint', kind: 'approval', ...approval.input }); return { status: 'needs_approval', toolUseId: approval.id, messages }; }
    const done = toolUses.find((t) => t.name === 'task_complete');
    if (done) { onEvent({ type: 'done', ...done.input }); return { status: 'complete', ...done.input, messages }; }

    // Computer actions, with the rails applied.
    const results = [];
    let payBlock = null;
    for (const t of toolUses) {
      const act = t.input && t.input.action;
      const clickish = ['left_click', 'double_click', 'key'].includes(act);
      const curUrl = await browser.url();

      // HARD RAIL 1 — payment/checkout: never click without explicit approval.
      // Detected before the click; leave the action unexecuted and park for a
      // human yes (executed on resume).
      if (clickish && disallowPayments && looksLikePayment(curUrl, await safeText(browser))) {
        payBlock = { toolUseId: t.id, pendingAction: t.input,
          summary: `This looks like a payment or checkout step on ${hostOf(curUrl) || 'this site'}. Approve before Aiveree continues.`,
          details: 'Payment and checkout actions are always held for your explicit approval.' };
        break; // single-action turns in practice; park the whole turn
      }

      let label = 'noop';
      try { label = await applyComputerAction(browser, t.input); } catch (e) { label = `error:${e.message}`; }
      let shot = await browser.screenshot();
      onEvent({ type: 'step', action: label, url: await browser.url(), screenshot: shot });

      // HARD RAIL 2 — site allowlist: if the action left the allowed set, go
      // back and tell the model (no human pause; the model must stay on-list or
      // ask for approval itself).
      const after = await browser.url();
      if (!isAllowed(after, allowlist)) {
        try { await browser.page.goBack({ waitUntil: 'domcontentloaded' }); } catch {}
        shot = await browser.screenshot();
        results.push(tr(t.id, `${hostOf(after) || 'That site'} is outside the allowed list, so I did not continue there. Back on the previous page.`, shot));
      } else {
        results.push(tr(t.id, `Done: ${label}. Current screen:`, shot));
      }
    }

    if (payBlock) {
      onEvent({ type: 'checkpoint', kind: 'approval', summary: payBlock.summary, details: payBlock.details });
      return { status: 'needs_approval', toolUseId: payBlock.toolUseId, pendingAction: payBlock.pendingAction, messages };
    }
    messages.push({ role: 'user', content: results });
  }
  onEvent({ type: 'stopped', reason: 'max_steps' });
  return { status: 'stopped', reason: 'max_steps', messages };
}

// Resume after a human handled a checkpoint. If pendingAction is set (a payment
// step the human approved), execute exactly that action now; otherwise just feed
// the human's note back in. Either way we answer the dangling tool_use, keeping
// the user/assistant turns strictly alternating.
async function resumeTask({ browser, toolUseId, humanNote, messages, pendingAction = null, onEvent = () => {}, llm = anthropic, guard = {}, shouldStop = () => false, timeBudgetMs }) {
  if (pendingAction) {
    let label = 'noop';
    try { label = await applyComputerAction(browser, pendingAction); } catch (e) { label = `error:${e.message}`; }
    const shot = await browser.screenshot();
    onEvent({ type: 'step', action: label, url: await browser.url(), screenshot: shot });
    messages.push({ role: 'user', content: [tr(toolUseId, `Approved. Done: ${label}. Current screen:`, shot)] });
  } else {
    const shot = await browser.screenshot();
    messages.push({ role: 'user', content: [tr(toolUseId, `${humanNote}. Current screen:`, shot)] });
  }
  return runTask({ browser, messages, onEvent, llm, guard, shouldStop, timeBudgetMs });
}

module.exports = { runTask, resumeTask, SAFETY, MODEL, hostOf, isAllowed, looksLikePayment };
