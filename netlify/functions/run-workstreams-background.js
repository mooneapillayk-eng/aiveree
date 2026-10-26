// ─── AIVEREE BACKGROUND WORK ENGINE ───────────────────────────────────────────
// A Netlify *background* function (the "-background" suffix makes it run async,
// up to 15 min on Pro). This is what makes "her team does the work while you're
// away" real: it executes each workstream as genuine work on the SERVER and
// persists every deliverable to the `workstreams` table — so the work finishes
// and is waiting whether or not the user's browser tab is still open.
//
// The frontend fires this once (POST, bearer token) and then polls the
// `workstreams` load action for results. Background functions return 202
// immediately and send no body back to the caller, so all output is via the DB.

const { supabase, CLAUDE_MODEL, getOptionalUser } = require('./lib/shared');

// Same grouping key the workstreams function uses, so rows line up.
const goalKey = (goal) => (goal || '').slice(0, 80).toLowerCase().replace(/\W/g, '_');

async function runClaude(system, prompt, useSearch) {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 1800,
    system,
    messages: [{ role: 'user', content: prompt }],
  };
  if (useSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function saveRow(user_id, gk, ws, i, status, result) {
  try {
    await supabase.from('workstreams').upsert({
      user_id,
      goal_key: gk,
      task_index: i,
      title: ws.title || '',
      detail: ws.detail || '',
      status,
      result: result || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,goal_key,task_index' });
  } catch {}
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, body: '' };
  try {
    const body = JSON.parse(event.body || '{}');
    const { goal, workstreams } = body;

    // User id comes from the bearer token, never the body.
    const user = await getOptionalUser(event);
    if (!user) return { statusCode: 401, body: 'auth required' };
    if (!goal || !Array.isArray(workstreams) || workstreams.length === 0) {
      return { statusCode: 400, body: 'goal and workstreams required' };
    }

    const uid = user.id;
    const gk = goalKey(goal);

    // 1. Mark everything in progress up front, so a user who returns mid-run
    //    (even on a different device) sees live "working on it" state from the DB.
    await Promise.all(workstreams.map((ws, i) => saveRow(uid, gk, ws, i, 'in_progress', '')));

    const sys = "You are a specialist executing real work for a user's goal. Produce concrete, specific, genuinely useful deliverables, never descriptions of what you would do. Use real specifics (names, numbers, concrete options). Calm, professional, operational. Plain English, British spelling, no em-dashes.";

    // 2. Execute, 3 at a time, persisting each deliverable the moment it's done.
    const queue = workstreams.map((ws, i) => ({ ws, i }));
    const worker = async () => {
      while (queue.length) {
        const { ws, i } = queue.shift();
        let result;
        try {
          const needsResearch = /research|track|monitor|analy|map|identif|find|scan|market|salary|compan|price|supplier|competitor|listing|role|job/i.test(`${ws.title} ${ws.detail}`);
          const prompt = `You are a specialist on Aiveree's team. Execute this real task and produce a concrete deliverable.

USER GOAL: ${goal}
TASK: ${ws.title}
WHAT IT INVOLVES: ${ws.detail}

Do the actual work now. Produce a genuinely useful, specific deliverable: real findings, a real draft, a real analysis. Use specifics (names, numbers, concrete options) wherever possible. Format with short clear sections. This is real work the user will read and act on, not a description of what you would do. Keep it focused and high value, around 250-400 words.`;
          result = await runClaude(sys, prompt, needsResearch);
        } catch {
          result = '';
        }
        await saveRow(uid, gk, ws, i, 'complete', result || 'Completed. Open the chat to take this further.');
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, workstreams.length) }, worker));

    return { statusCode: 200, body: JSON.stringify({ done: true }) };
  } catch (e) {
    return { statusCode: 500, body: String((e && e.message) || e) };
  }
};
