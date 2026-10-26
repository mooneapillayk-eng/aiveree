// ─── AIVEREE AGENT RESUME ─────────────────────────────────────────────────────
// Continues a run after the user handled a checkpoint: "I've logged in" or
// "Approved" (or a correction like "No, use Saturday"). Verifies ownership, then
// forwards to the execution service.

const { supabase, corsHeaders, requireUser, INTERNAL_HEADERS, json, HttpError } = require('./lib/shared');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const base = process.env.AGENT_SERVICE_URL;
  if (!base) return json(503, CORS, { error: 'Execution service not configured yet', configured: false });

  try {
    const { run_id, note } = JSON.parse(event.body || '{}');
    if (!run_id) return json(400, CORS, { error: 'run_id required' });
    const user = await requireUser(event);

    const { data: run } = await supabase.from('agent_runs').select('user_id').eq('id', run_id).maybeSingle();
    if (!run) return json(404, CORS, { error: 'not found' });
    if (run.user_id !== user.id) return json(403, CORS, { error: 'not yours' });

    const res = await fetch(`${base.replace(/\/$/, '')}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
      body: JSON.stringify({ run_id, note: (note || 'Approved').slice(0, 500) }),
    });
    const out = await res.json().catch(() => ({}));
    return json(res.ok ? 200 : 409, CORS, out);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, CORS, { error: e.message });
    return json(500, CORS, { error: e.message });
  }
};
