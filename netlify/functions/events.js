// ─── AIVEREE EVENTS SERVICE ───────────────────────────────────────────────────
// System backbone. Everything that happens is an event.
// Actions: fire | query | get_user_activity | check_inactivity

const { supabase, corsHeaders, resolveUser, internalSecretOk, HttpError } = require('./lib/shared');

// Valid event types — schema validation
const VALID_EVENT_TYPES = new Set([
  'conversation.message_sent',
  'conversation.message_received',
  'conversation.onboarding_completed',
  'task.created', 'task.started', 'task.completed', 'task.failed', 'task.approved', 'task.rejected',
  'goal.created', 'goal.updated', 'goal.achieved', 'goal.paused',
  'project.created', 'project.stalled', 'project.completed', 'project.abandoned',
  'user.signed_up', 'user.signed_in', 'user.inactive_1d', 'user.inactive_3d',
  'user.inactive_7d', 'user.inactive_14d', 'user.returned',
  'approval.created', 'approval.approved', 'approval.rejected', 'approval.expired',
  'whatsapp.sent', 'whatsapp.delivered', 'whatsapp.read', 'whatsapp.replied',
  'digest.morning_sent', 'digest.evening_sent', 'digest.weekly_sent', 'digest.opened',
  'opportunity.detected', 'opportunity.surfaced', 'opportunity.acted', 'opportunity.dismissed',
  'memory.written', 'memory.retrieved',
  'workflow.started', 'workflow.completed', 'workflow.failed',
  'credit.used', 'credit.exhausted',
  'subscription.started', 'subscription.cancelled',
]);

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const { action, ...params } = JSON.parse(event.body || "{}");

    // Authoritative user id: token (browser) or trusted internal call. Single-user
    // actions are scoped to this id; cross-user fire_batch is internal-only.
    const { userId } = await resolveUser(event, params);
    if (action !== 'fire_batch') {
      if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };
      params.user_id = userId;
    }

    switch (action) {

      // Fire a single event
      case 'fire': {
        const { event_type, user_id, payload, project_id, goal_id, task_id, source, platform } = params;

        // Schema validation
        if (!event_type) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "event_type required" }) };
        if (!user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };
        if (!VALID_EVENT_TYPES.has(event_type)) {
          console.warn(`Unknown event type: ${event_type} — firing anyway but consider adding to schema`);
        }

        const { data, error } = await supabase.from('events').insert({
          event_type,
          user_id,
          project_id: project_id || null,
          goal_id: goal_id || null,
          task_id: task_id || null,
          payload: payload || {},
          source: source || 'system',
          platform: platform || 'web'
        }).select().single();

        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ event: data }) };
      }

      // Fire multiple events at once — system operation, internal callers only
      case 'fire_batch': {
        if (!internalSecretOk(event)) {
          return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Forbidden" }) };
        }
        const { events: eventList } = params;
        if (!Array.isArray(eventList) || eventList.length === 0) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "events array required" }) };
        }

        const validated = eventList.filter(e => e.event_type && e.user_id).map(e => ({
          event_type: e.event_type,
          user_id: e.user_id,
          project_id: e.project_id || null,
          goal_id: e.goal_id || null,
          task_id: e.task_id || null,
          payload: e.payload || {},
          source: e.source || 'system',
          platform: e.platform || 'web'
        }));

        const { data, error } = await supabase.from('events').insert(validated).select();
        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ events_fired: data.length }) };
      }

      // Get recent events for a user
      case 'query': {
        const { user_id, event_type, limit = 20, since } = params;
        if (!user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };

        let query = supabase.from('events').select('*').eq('user_id', user_id).order('created_at', { ascending: false }).limit(limit);
        if (event_type) query = query.eq('event_type', event_type);
        if (since) query = query.gte('created_at', since);

        const { data, error } = await query;
        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ events: data }) };
      }

      // Check user activity status — used by proactive system
      case 'check_inactivity': {
        const { user_id } = params;
        if (!user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };

        const { data: profile } = await supabase
          .from('profiles')
          .select('last_active_at, preferred_channel, name')
          .eq('id', user_id)
          .single();

        if (!profile) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "User not found" }) };

        const daysSince = Math.floor((Date.now() - new Date(profile.last_active_at).getTime()) / 86400000);

        let inactivity_tier = null;
        if (daysSince >= 21) inactivity_tier = 'lost'; // 21+ days
        else if (daysSince >= 8) inactivity_tier = 'gone_quiet'; // 8-21 days
        else if (daysSince >= 3) inactivity_tier = 'drifting'; // 3-7 days
        else inactivity_tier = 'active'; // < 3 days

        return {
          statusCode: 200, headers: CORS,
          body: JSON.stringify({
            user_id,
            name: profile.name,
            preferred_channel: profile.preferred_channel,
            days_since_active: daysSince,
            last_active_at: profile.last_active_at,
            inactivity_tier
          })
        };
      }

      // Get activity summary for digest generation
      case 'get_activity_summary': {
        const { user_id, since_hours = 24 } = params;
        if (!user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };

        const since = new Date(Date.now() - since_hours * 3600000).toISOString();

        const { data: recentEvents } = await supabase
          .from('events')
          .select('event_type, payload, created_at')
          .eq('user_id', user_id)
          .gte('created_at', since)
          .order('created_at', { ascending: false });

        const { data: pendingApprovals } = await supabase
          .from('approvals')
          .select('id, title, approval_type, created_at')
          .eq('user_id', user_id)
          .eq('status', 'pending');

        const { data: recentTasks } = await supabase
          .from('tasks')
          .select('title, task_type, status, completed_at')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: activeGoals } = await supabase
          .from('goals')
          .select('title, domain, progress_pct')
          .eq('user_id', user_id)
          .eq('status', 'active');

        return {
          statusCode: 200, headers: CORS,
          body: JSON.stringify({
            recent_events: recentEvents || [],
            pending_approvals: pendingApprovals || [],
            recent_tasks: recentTasks || [],
            active_goals: activeGoals || [],
            event_count: recentEvents?.length || 0
          })
        };
      }

      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return { statusCode: err.status, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
    console.error('Events service error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Events service failed', detail: err.message }) };
  }
};
