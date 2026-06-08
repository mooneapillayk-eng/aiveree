// ─── AIVEREE APPROVALS SERVICE ───────────────────────────────────────────────
// Human approval queue. Aiveree prepares, user approves, then it executes.
// Actions: create | get_pending | approve | reject | expire

const { supabase, corsHeaders, resolveUser, HttpError } = require('./lib/shared');

const VALID_TYPES = ['email','message','application','schedule','payment','post','outreach','document','other'];

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode:200, headers:CORS, body:"" };
  try {
    const { action, ...params } = JSON.parse(event.body || "{}");

    // Authoritative user id from token (or trusted internal call).
    const { userId } = await resolveUser(event, params);
    if (!userId) return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"user_id required" }) };
    params.user_id = userId;

    switch (action) {

      case 'create': {
        const { user_id, task_id, project_id, approval_type, title, summary, content } = params;
        if (!user_id || !approval_type || !title || !content) {
          return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"user_id, approval_type, title, content required" }) };
        }
        if (!VALID_TYPES.includes(approval_type)) {
          return { statusCode:400, headers:CORS, body:JSON.stringify({ error:`Invalid approval_type. Use: ${VALID_TYPES.join(', ')}` }) };
        }
        const { data, error } = await supabase.from('approvals').insert({
          user_id, task_id: task_id||null, project_id: project_id||null,
          approval_type, title, summary: summary||null, content,
          expires_at: new Date(Date.now() + 7*86400000).toISOString()
        }).select().single();
        if (error) throw error;
        return { statusCode:200, headers:CORS, body:JSON.stringify({ approval:data }) };
      }

      case 'get_pending': {
        const { user_id } = params;
        if (!user_id) return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"user_id required" }) };
        const { data, error } = await supabase.from('approvals').select('*').eq('user_id',user_id).eq('status','pending').order('created_at',{ascending:false});
        if (error) throw error;
        return { statusCode:200, headers:CORS, body:JSON.stringify({ approvals:data||[] }) };
      }

      case 'approve': {
        const { approval_id, user_id } = params;
        if (!approval_id || !user_id) return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"approval_id and user_id required" }) };
        const { data, error } = await supabase.from('approvals')
          .update({ status:'approved', approved_at: new Date().toISOString() })
          .eq('id', approval_id).eq('user_id', user_id).select().single();
        if (error) throw error;
        return { statusCode:200, headers:CORS, body:JSON.stringify({ approval:data, message:"Approved. Aiveree will proceed." }) };
      }

      case 'reject': {
        const { approval_id, user_id, reason } = params;
        if (!approval_id || !user_id) return { statusCode:400, headers:CORS, body:JSON.stringify({ error:"approval_id and user_id required" }) };
        const { data, error } = await supabase.from('approvals')
          .update({ status:'rejected', rejected_at: new Date().toISOString(), rejection_reason: reason||null })
          .eq('id', approval_id).eq('user_id', user_id).select().single();
        if (error) throw error;
        return { statusCode:200, headers:CORS, body:JSON.stringify({ approval:data }) };
      }

      default:
        return { statusCode:400, headers:CORS, body:JSON.stringify({ error:`Unknown action: ${action}` }) };
    }
  } catch (err) {
    if (err instanceof HttpError) return { statusCode: err.status, headers: CORS, body: JSON.stringify({ error: err.message }) };
    console.error('Approvals error:', err);
    return { statusCode:500, headers:CORS, body:JSON.stringify({ error:'Approvals service failed' }) };
  }
};
