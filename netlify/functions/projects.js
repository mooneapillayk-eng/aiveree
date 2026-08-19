// ─── AIVEREE PROJECTS ─────────────────────────────────────────────────────────
// First-class projects: the ongoing threads of a user's work (a seed round, a
// product launch, first hires). Actions: list | create | update | delete.
// Auth: user id always comes from the bearer token (or a trusted internal call).

const { supabase, corsHeaders, resolveUser, HttpError } = require('./lib/shared');

const VALID_STATUS = new Set(['active', 'paused', 'done', 'archived']);
const j = (statusCode, CORS, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

// Confirm the project exists and belongs to the acting user before mutating it.
async function ownedProject(projectId, userId) {
  const { data } = await supabase.from('projects').select('user_id').eq('id', projectId).single();
  return !!data && data.user_id === userId;
}

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const { action, ...p } = JSON.parse(event.body || '{}');

    // Authoritative user id from the token (browser) or trusted internal call.
    const { userId } = await resolveUser(event, p);
    if (!userId) return j(400, CORS, { error: 'user_id required' });

    switch (action) {
      // All of a user's projects, newest first.
      case 'list': {
        const { data, error } = await supabase
          .from('projects').select('*').eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return j(200, CORS, { projects: data || [] });
      }

      // Create a project.
      case 'create': {
        const name = (p.name || '').trim();
        if (!name) return j(400, CORS, { error: 'name required' });
        if (p.status !== undefined && !VALID_STATUS.has(p.status)) return j(400, CORS, { error: 'invalid status' });
        const { data, error } = await supabase.from('projects').insert({
          user_id: userId,
          name: name.slice(0, 120),
          description: (p.description || '').slice(0, 2000) || null,
          status: VALID_STATUS.has(p.status) ? p.status : 'active',
        }).select().single();
        if (error) throw error;
        return j(200, CORS, { project: data });
      }

      // Edit name / description / status.
      case 'update': {
        const { project_id } = p;
        if (!project_id) return j(400, CORS, { error: 'project_id required' });
        if (!(await ownedProject(project_id, userId))) return j(404, CORS, { error: 'project not found' });
        const patch = { updated_at: new Date().toISOString() };
        if (typeof p.name === 'string' && p.name.trim()) patch.name = p.name.trim().slice(0, 120);
        if (p.description !== undefined) patch.description = (p.description || '').slice(0, 2000) || null;
        if (p.status !== undefined) {
          if (!VALID_STATUS.has(p.status)) return j(400, CORS, { error: 'invalid status' });
          patch.status = p.status;
        }
        const { data, error } = await supabase.from('projects').update(patch).eq('id', project_id).select().single();
        if (error) throw error;
        return j(200, CORS, { project: data });
      }

      // Delete a project.
      case 'delete': {
        const { project_id } = p;
        if (!project_id) return j(400, CORS, { error: 'project_id required' });
        if (!(await ownedProject(project_id, userId))) return j(404, CORS, { error: 'project not found' });
        const { error } = await supabase.from('projects').delete().eq('id', project_id);
        if (error) throw error;
        return j(200, CORS, { deleted: true });
      }

      default:
        return j(400, CORS, { error: `Unknown action: ${action}` });
    }
  } catch (err) {
    if (err instanceof HttpError) return j(err.status, CORS, { error: err.message });
    console.error('Projects service error:', err);
    return j(500, CORS, { error: 'Projects service failed', detail: err.message });
  }
};
