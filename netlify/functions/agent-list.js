// ─── AIVEREE AGENT LIST ───────────────────────────────────────────────────────
// The user's recent execution runs, for the "recent tasks" list in the Act tab.
// Light payload (no screenshots) so it's cheap to load.

const { supabase, corsHeaders, requireUser, json, HttpError } = require('./lib/shared');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const user = await requireUser(event);
    const { data } = await supabase
      .from('agent_runs')
      .select('id,task,status,result,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10);
    return json(200, CORS, { runs: data || [] });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, CORS, { error: e.message });
    return json(500, CORS, { error: e.message });
  }
};
