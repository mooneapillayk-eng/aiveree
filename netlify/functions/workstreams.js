// ─── AIVEREE WORKSTREAM PERSISTENCE ───────────────────────────────────────────
// Stores real work Aiveree has done so it persists across sessions.
// Actions: save | load
// A user logs in next week and sees the work completed last week.

const { supabase, corsHeaders, resolveUser, HttpError } = require('./lib/shared');

// A stable key for a user's goal so we can group their workstreams
function goalKey(goal) {
  return (goal || "").slice(0, 80).toLowerCase().replace(/\W/g, "_");
}

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const { action, ...p } = JSON.parse(event.body || "{}");

    // Authoritative user id from the bearer token (or trusted internal call).
    const { userId } = await resolveUser(event, p);
    if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };
    p.user_id = userId;

    switch (action) {

      // Load any previously saved workstreams for this user + goal
      case 'load': {
        if (!p.user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };
        const { data, error } = await supabase
          .from('workstreams')
          .select('*')
          .eq('user_id', p.user_id)
          .eq('goal_key', goalKey(p.goal))
          .order('task_index', { ascending: true });
        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ workstreams: data || [] }) };
      }

      // Save (or update) a single completed workstream
      case 'save': {
        if (!p.user_id || p.task_index === undefined) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id and task_index required" }) };
        }
        const row = {
          user_id: p.user_id,
          goal_key: goalKey(p.goal),
          task_index: p.task_index,
          title: p.title || "",
          detail: p.detail || "",
          status: p.status || "complete",
          result: p.result || "",
          updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
          .from('workstreams')
          .upsert(row, { onConflict: 'user_id,goal_key,task_index' })
          .select()
          .single();
        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ workstream: data }) };
      }

      // Load the remembered dashboard for this user + goal
      case 'load_dashboard': {
        if (!p.user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };
        const { data, error } = await supabase
          .from('dashboards')
          .select('dashboard')
          .eq('user_id', p.user_id)
          .eq('goal_key', goalKey(p.goal))
          .maybeSingle();
        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ dashboard: data?.dashboard || null }) };
      }

      // Save the dashboard so its structure (and workstream titles) stay stable
      case 'save_dashboard': {
        if (!p.user_id || !p.dashboard) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id and dashboard required" }) };
        }
        const { data, error } = await supabase
          .from('dashboards')
          .upsert({
            user_id: p.user_id,
            goal_key: goalKey(p.goal),
            dashboard: p.dashboard,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,goal_key' })
          .select()
          .single();
        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ saved: true }) };
      }

      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "unknown action" }) };
    }
  } catch (e) {
    if (e instanceof HttpError) return { statusCode: e.status, headers: CORS, body: JSON.stringify({ error: e.message }) };
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
