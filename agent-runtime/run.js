// ─── AIVEREE AGENT RUNNER (CLI) ───────────────────────────────────────────────
// Drive one real task from the terminal, end to end, with human-in-the-loop at
// checkpoints. This is the local proving ground for the execution engine before
// it is wired into Aiveree and onto hosted cloud browsers.
//
//   ANTHROPIC_API_KEY=... node run.js "find the cheapest next-day delivery
//        4kg dumbbell on a UK retailer and get it to the basket" https://google.com
//
// Use HEADLESS=0 to watch it, SHOTS=1 to save a screenshot per step.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Browser } = require('./browser');
const { runTask, resumeTask } = require('./driver');

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

const shotsDir = path.join(__dirname, 'run-shots');
let stepN = 0;
function onEvent(e) {
  if (e.type === 'thought') console.log(`\n  💭 ${e.text}`);
  else if (e.type === 'step') {
    stepN++;
    console.log(`  → ${e.action}  [${e.url}]`);
    if (process.env.SHOTS === '1') {
      fs.mkdirSync(shotsDir, { recursive: true });
      fs.writeFileSync(path.join(shotsDir, `step-${String(stepN).padStart(3, '0')}.png`), Buffer.from(e.screenshot, 'base64'));
    }
  } else if (e.type === 'checkpoint') console.log(`\n  ⏸  CHECKPOINT (${e.kind}): ${e.summary || e.reason}`);
  else if (e.type === 'done') console.log(`\n  ✅ DONE: ${e.summary}${e.result ? `\n     Result: ${e.result}` : ''}`);
  else if (e.type === 'stopped') console.log(`\n  ⏹  stopped: ${e.reason}`);
}

(async () => {
  const task = process.argv[2];
  const startUrl = process.argv[3] || 'https://www.google.com';
  if (!task) { console.error('Usage: node run.js "<task>" [startUrl]'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error('Set ANTHROPIC_API_KEY first.'); process.exit(1); }

  const b = new Browser();
  await b.start({ headless: process.env.HEADLESS !== '0' });
  console.log(`\nTask: ${task}\nStart: ${startUrl}\n`);

  try {
    let state = await runTask({ browser: b, task, startUrl, onEvent });
    // Human-in-the-loop checkpoints.
    while (state.status === 'needs_login' || state.status === 'needs_approval') {
      const prompt = state.status === 'needs_login'
        ? '\n  👉 Log in yourself in the browser window, then press Enter to hand control back: '
        : '\n  👉 Approve this action? Type "yes" to proceed, or say what to change: ';
      const note = (await ask(prompt)) || (state.status === 'needs_login' ? 'I have logged in' : 'Approved');
      state = await resumeTask({ browser: b, toolUseId: state.toolUseId, humanNote: note, messages: state.messages, onEvent });
    }
    console.log(`\nFinal status: ${state.status}`);
  } catch (e) {
    console.error('Run failed:', e.message);
  } finally {
    await b.close();
  }
})();
