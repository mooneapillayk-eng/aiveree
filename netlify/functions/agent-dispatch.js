// ─── AIVEREE AGENT DISPATCH ───────────────────────────────────────────────────
// Hands a real-world task to the execution service (the computer-use engine on
// its own host). The app never talks to that service directly — this function
// authenticates the user, spends a credit, and forwards with the internal
// secret. If the service isn't configured yet, it says so honestly.

const { corsHeaders, requireUser, consumeCredit, rateLimit, INTERNAL_HEADERS, json, HttpError } = require('./lib/shared');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const base = process.env.AGENT_SERVICE_URL;
  if (!base) return json(503, CORS, { error: 'Execution service not configured yet', configured: false });

  try {
    const { task, start_url } = JSON.parse(event.body || '{}');
    if (!task || !task.trim()) return json(400, CORS, { error: 'task required' });

    const user = await requireUser(event);
    if (!(await rateLimit(`agent:${user.id}`, 10, 60 * 60 * 1000))) {
      return json(429, CORS, { error: 'Too many tasks this hour — please slow down' });
    }
    const credit = await consumeCredit(user.id);
    if (!credit.ok) return json(402, CORS, { error: 'No credits remaining', credits_remaining: 0 });

    const run_id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch(`${base.replace(/\/$/, '')}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
      body: JSON.stringify({ run_id, user_id: user.id, task: task.trim(), start_url: start_url || 'https://www.google.com' }),
    });
    if (!res.ok) return json(502, CORS, { error: 'Execution service error', detail: (await res.text()).slice(0, 200) });
    const out = await res.json();
    return json(200, CORS, { ...out, credits_remaining: credit.credits, is_pro: credit.is_pro });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, CORS, { error: e.message });
    return json(500, CORS, { error: e.message });
  }
};
