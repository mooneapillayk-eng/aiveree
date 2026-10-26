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

// Run until the agent reaches a checkpoint (login/approval) or completes.
// onEvent({type, ...}) streams progress. Returns {status, messages, ...}.
// `llm` is injectable so the loop can be proven against a stubbed model in tests
// (same contract as the real Anthropic call).
async function runTask({ browser, task, startUrl, messages = null, onEvent = () => {}, maxSteps = 40, llm = anthropic }) {
  const { width, height } = await browser.size();
  const tools = computerTools(width, height);

  if (!messages) {
    if (startUrl) await browser.goto(startUrl);
    const first = await browser.screenshot();
    messages = [{ role: 'user', content: [
      { type: 'text', text: `TASK: ${task}\n\nCurrent screen below. Begin.` },
      shotBlock(first),
    ] }];
  }

  for (let step = 0; step < maxSteps; step++) {
    const reply = await llm(messages, tools, SAFETY);
    messages.push({ role: 'assistant', content: reply.content });

    const toolUses = (reply.content || []).filter((b) => b.type === 'tool_use');
    const sayText = (reply.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    if (sayText) onEvent({ type: 'thought', text: sayText });

    if (toolUses.length === 0) { onEvent({ type: 'idle', text: sayText }); return { status: 'stopped', reason: 'no_action', messages }; }

    // Handle control tools first (they end the turn).
    const login = toolUses.find((t) => t.name === 'request_human_login');
    if (login) { onEvent({ type: 'checkpoint', kind: 'login', ...login.input }); return { status: 'needs_login', toolUseId: login.id, messages }; }
    const approval = toolUses.find((t) => t.name === 'request_approval');
    if (approval) { onEvent({ type: 'checkpoint', kind: 'approval', ...approval.input }); return { status: 'needs_approval', toolUseId: approval.id, messages }; }
    const done = toolUses.find((t) => t.name === 'task_complete');
    if (done) { onEvent({ type: 'done', ...done.input }); return { status: 'complete', ...done.input, messages }; }

    // Otherwise, apply every computer action and return fresh screenshots.
    const results = [];
    for (const t of toolUses) {
      let label = 'noop';
      try { label = await applyComputerAction(browser, t.input); } catch (e) { label = `error:${e.message}`; }
      const shot = await browser.screenshot();
      onEvent({ type: 'step', action: label, url: await browser.url(), screenshot: shot });
      results.push({ type: 'tool_result', tool_use_id: t.id, content: [
        { type: 'text', text: `Done: ${label}. Current screen:` }, shotBlock(shot),
      ] });
    }
    messages.push({ role: 'user', content: results });
  }
  onEvent({ type: 'stopped', reason: 'max_steps' });
  return { status: 'stopped', reason: 'max_steps', messages };
}

// Resume after a human acted on a checkpoint. humanNote tells the agent what
// happened ("I've logged in", "Approved" / "No, change the date to Saturday").
async function resumeTask({ browser, toolUseId, humanNote, messages, onEvent = () => {}, maxSteps = 40, llm = anthropic }) {
  const shot = await browser.screenshot();
  messages.push({ role: 'user', content: [
    { type: 'tool_result', tool_use_id: toolUseId, content: [
      { type: 'text', text: `${humanNote}. Current screen:` }, shotBlock(shot),
    ] },
  ] });
  return runTask({ browser, messages, onEvent, maxSteps, llm });
}

module.exports = { runTask, resumeTask, SAFETY, MODEL };
