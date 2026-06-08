// ─── AIVEREE DIGEST ENGINE ────────────────────────────────────────────────────
// Generates morning briefings, evening reviews, and weekly digests
// Scheduled: morning 8am, evening 6pm, weekly Sunday 9am
// Also callable manually for immediate digest

const { supabase, corsHeaders, internalSecretOk, INTERNAL_HEADERS, CLAUDE_MODEL } = require('./lib/shared');

// Background job. Netlify's scheduled trigger has no httpMethod; any public HTTP
// call must carry the internal or cron secret.
function jobAuthorised(event) {
  if (!event.httpMethod) return true; // scheduled invocation
  if (internalSecretOk(event)) return true;
  const cron = process.env.CRON_SECRET;
  const got = event.headers?.['x-cron-secret'];
  return !!cron && got === cron;
}

async function generateDigest(userId, digestType, activitySummary, memoryContext) {
  const typeDescriptions = {
    morning: "morning briefing",
    evening: "evening review",
    weekly: "weekly review"
  };

  const prompts = {
    morning: `Generate a morning briefing for this user. Be warm, energetic, and specific. Reference their actual goals and what's waiting for them today.

Activity context:
${JSON.stringify(activitySummary, null, 2)}

Memory context:
${memoryContext}

Generate a JSON response:
{
  "greeting": "personalised good morning message (2 sentences, references their name and specific goal)",
  "priorities": ["specific priority 1", "specific priority 2", "specific priority 3"],
  "pending_approvals": number,
  "opportunities": ["any new opportunities or insights"],
  "momentum_message": "one sentence of encouragement specific to their situation",
  "spoken_summary": "20-word max spoken version for voice delivery"
}`,
    evening: `Generate an evening review. Reflective, honest, forward-looking.

Activity context:
${JSON.stringify(activitySummary, null, 2)}

Memory context:
${memoryContext}

Generate JSON:
{
  "reflection": "what happened today relevant to their goals (2 sentences)",
  "completed_today": ["tasks completed"],
  "tomorrow_focus": ["what to focus on tomorrow"],
  "encouragement": "specific encouragement based on today's activity",
  "spoken_summary": "20-word max spoken version"
}`,
    weekly: `Generate a weekly review. Strategic, honest, motivating.

Activity context:
${JSON.stringify(activitySummary, null, 2)}

Memory context:
${memoryContext}

Generate JSON:
{
  "week_summary": "honest 2-sentence summary of the week",
  "wins": ["specific wins this week"],
  "blockers": ["what got in the way"],
  "next_week_priorities": ["top 3 priorities for next week"],
  "progress_assessment": "honest 1 sentence on overall progress toward goal",
  "spoken_summary": "20-word max spoken version"
}`
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: "You are Aiveree generating personalised digests. Return ONLY valid JSON. Be specific to the user's actual situation. No generic advice.",
      messages: [{ role: "user", content: prompts[digestType] }]
    })
  });

  const data = await res.json();
  let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
  text = text.replace(/```json|```/g, "").trim();
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1) text = text.slice(s, e + 1);
  return JSON.parse(text);
}

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode:200, headers:CORS, body:"" };
  if (!jobAuthorised(event)) return { statusCode:403, headers:CORS, body:JSON.stringify({ error:"Forbidden" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const digestType = body.digest_type || 'morning';
    const targetUserId = body.user_id; // specific user or all active users

    // Get users to digest
    let users = [];
    if (targetUserId) {
      const { data } = await supabase.from('user_profiles').select('id, name, preferred_channel, whatsapp_number').eq('id', targetUserId);
      users = data || [];
    } else {
      // Get all users active in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30*86400000).toISOString();
      const { data } = await supabase.from('user_profiles')
        .select('id, name, preferred_channel, whatsapp_number')
        .gte('last_active_at', thirtyDaysAgo)
        .limit(100);
      users = data || [];
    }

    const results = [];

    for (const user of users) {
      try {
        // Get activity summary
        const actRes = await fetch(`${process.env.URL}/.netlify/functions/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
          body: JSON.stringify({ action: 'get_activity_summary', user_id: user.id, since_hours: digestType === 'weekly' ? 168 : 24 })
        });
        const activitySummary = actRes.ok ? await actRes.json() : {};

        // Get memory context
        const memRes = await fetch(`${process.env.URL}/.netlify/functions/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
          body: JSON.stringify({ action: 'build_context', user_id: user.id, current_message: `Generate ${digestType} digest` })
        });
        const memData = memRes.ok ? await memRes.json() : {};
        const memoryContext = memData.context_string || '';

        // Generate digest
        const content = await generateDigest(user.id, digestType, activitySummary, memoryContext);

        // Store digest
        const { data: digest } = await supabase.from('digests').insert({
          user_id: user.id,
          digest_type: digestType,
          content,
          summary: content.spoken_summary || '',
          tasks_referenced: activitySummary.recent_tasks?.length || 0,
          opportunities_included: activitySummary.recent_events?.filter(e => e.event_type?.startsWith('opportunity')).length || 0,
          memories_used: memData.memories_used || 0
        }).select().single();

        // Fire event
        await fetch(`${process.env.URL}/.netlify/functions/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
          body: JSON.stringify({ action: 'fire', event_type: `digest.${digestType}_sent`, user_id: user.id, payload: { digest_id: digest?.id } })
        });

        results.push({ user_id: user.id, status: 'success', digest_id: digest?.id });
      } catch (err) {
        console.error(`Digest failed for user ${user.id}:`, err);
        results.push({ user_id: user.id, status: 'error', error: err.message });
      }
    }

    return { statusCode:200, headers:CORS, body:JSON.stringify({ results, total: users.length, successful: results.filter(r => r.status === 'success').length }) };

  } catch (err) {
    console.error('Digest engine error:', err);
    return { statusCode:500, headers:CORS, body:JSON.stringify({ error:'Digest engine failed', detail:err.message }) };
  }
};
