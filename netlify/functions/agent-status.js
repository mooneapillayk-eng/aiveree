// ─── AIVEREE AGENT STATUS ─────────────────────────────────────────────────────
// The app polls this for the live view: current status, latest screenshot,
// action log, and any checkpoint awaiting the user. Reads straight from the
// shared database (the execution service writes there), scoped to the owner.

const { supabase, corsHeaders, requireUser, json, HttpError } = require('./lib/shared');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const { run_id } = JSON.parse(event.body || '{}');
    if (!run_id) return json(400, CORS, { error: 'run_id required' });
    const user = await requireUser(event);

    const { data: run } = await supabase.from('agent_runs').select('*').eq('id', run_id).maybeSingle();
    if (!run) return json(404, CORS, { error: 'not found' });
    if (run.user_id !== user.id) return json(403, CORS, { error: 'not yours' });

    const { data: steps } = await supabase
      .from('agent_run_steps').select('action,url,created_at')
      .eq('run_id', run_id).order('created_at', { ascending: true }).limit(100);

    return json(200, CORS, { run, steps: steps || [] });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, CORS, { error: e.message });
    return json(500, CORS, { error: e.message });
  }
};
