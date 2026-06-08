// ─── ORGANISATION / B2B FUNCTION ─────────────────────────────────────────────
// Handles team accounts, seat management, and org-level analytics
// Actions: create_org, invite_member, get_org, get_usage, get_insights

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json"
};

async function verifyUser(event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const userId = await verifyUser(event);
    if (!userId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorised" }) };

    const { action, ...params } = JSON.parse(event.body || "{}");

    switch (action) {

      // Create a new organisation (team account)
      case 'create_org': {
        const { name, plan = 'team' } = params;
        if (!name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Organisation name required" }) };

        const { data: org, error } = await supabase
          .from('organisations')
          .insert({
            name,
            owner_id: userId,
            plan, // team | professional | enterprise
            seats: plan === 'team' ? 10 : plan === 'professional' ? 25 : 100,
            credits_monthly: plan === 'team' ? 500 : plan === 'professional' ? 2000 : -1, // -1 = unlimited
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        // Add owner as first member
        await supabase.from('org_members').insert({
          org_id: org.id,
          user_id: userId,
          role: 'owner',
          joined_at: new Date().toISOString()
        });

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ org }) };
      }

      // Get organisation details and members
      case 'get_org': {
        const { data: member } = await supabase
          .from('org_members')
          .select('org_id, role')
          .eq('user_id', userId)
          .single();

        if (!member) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Not in an organisation" }) };

        const { data: org } = await supabase
          .from('organisations')
          .select('*')
          .eq('id', member.org_id)
          .single();

        const { data: members } = await supabase
          .from('org_members')
          .select('user_id, role, joined_at, profiles(name, email)')
          .eq('org_id', member.org_id);

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ org, members, user_role: member.role }) };
      }

      // Invite a member to the organisation
      case 'invite_member': {
        const { email, role = 'member' } = params;
        if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Email required" }) };

        const { data: myMembership } = await supabase
          .from('org_members')
          .select('org_id, role')
          .eq('user_id', userId)
          .single();

        if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
          return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Admin access required" }) };
        }

        // Check seat availability
        const { data: org } = await supabase.from('organisations').select('seats').eq('id', myMembership.org_id).single();
        const { count } = await supabase.from('org_members').select('*', { count: 'exact' }).eq('org_id', myMembership.org_id);
        if (count >= org.seats) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No seats available. Upgrade your plan." }) };
        }

        const { data: invite, error } = await supabase
          .from('org_invites')
          .insert({
            org_id: myMembership.org_id,
            invited_email: email,
            invited_by: userId,
            role,
            token: crypto.randomUUID(),
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ invite, message: `Invite sent to ${email}` }) };
      }

      // Get usage analytics for the org
      case 'get_usage': {
        const { data: member } = await supabase.from('org_members').select('org_id, role').eq('user_id', userId).single();
        if (!member) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Not in an organisation" }) };

        // Get task usage across all org members
        const { data: usage } = await supabase
          .from('agent_task_log')
          .select('agent_id, member_name, user_id, created_at, success')
          .in('user_id', supabase.from('org_members').select('user_id').eq('org_id', member.org_id))
          .order('created_at', { ascending: false })
          .limit(500);

        // Aggregate by agent
        const byAgent = (usage || []).reduce((acc, t) => {
          acc[t.agent_id] = (acc[t.agent_id] || 0) + 1;
          return acc;
        }, {});

        // Aggregate by team member
        const byMember = (usage || []).reduce((acc, t) => {
          acc[t.member_name] = (acc[t.member_name] || 0) + 1;
          return acc;
        }, {});

        return {
          statusCode: 200, headers: CORS,
          body: JSON.stringify({ total_tasks: (usage || []).length, by_agent: byAgent, by_member: byMember, recent: (usage || []).slice(0, 20) })
        };
      }

      // Get aggregated intelligence insights (anonymised)
      case 'get_insights': {
        const { data: member } = await supabase.from('org_members').select('org_id, role').eq('user_id', userId).single();
        if (!member || member.role !== 'owner') {
          return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Owner access required" }) };
        }

        // Anonymised platform-wide insights
        const { data: goalTypes } = await supabase
          .from('user_intelligence')
          .select('dashboard_type')
          .not('dashboard_type', 'is', null);

        const goalDistribution = (goalTypes || []).reduce((acc, r) => {
          acc[r.dashboard_type] = (acc[r.dashboard_type] || 0) + 1;
          return acc;
        }, {});

        return {
          statusCode: 200, headers: CORS,
          body: JSON.stringify({
            platform_insights: { goal_distribution: goalDistribution, note: "Anonymised platform-wide data" }
          })
        };
      }

      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
    }
  } catch (err) {
    console.error('organisation error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Organisation action failed" }) };
  }
};
