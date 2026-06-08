// ─── AIVEREE CREDITS ──────────────────────────────────────────────────────────
// Free-tier credit tracking. Auth is required; the user id always comes from the
// bearer token. There is deliberately no client-settable "set" action.

const { supabase, corsHeaders, requireUser, consumeCredit, FREE_DAILY_CREDITS, HttpError } = require('./lib/shared');

async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('credits,is_pro,plan,credit_date')
    .eq('id', userId)
    .single();
  return data;
}

exports.handler = async (event) => {
  const h = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: h, body: '' };
  try {
    const { action } = JSON.parse(event.body || '{}');
    const user = await requireUser(event);
    const userId = user.id;

    let profile = await getProfile(userId);
    const today = new Date().toDateString();

    // Daily reset: first interaction on a new day tops the free tier back up.
    if (profile && !profile.is_pro && profile.credit_date !== today) {
      await supabase.from('profiles').update({ credits: FREE_DAILY_CREDITS, credit_date: today }).eq('id', userId);
      profile = { ...profile, credits: FREE_DAILY_CREDITS, credit_date: today };
    }

    if (action === 'get') {
      return {
        statusCode: 200,
        headers: h,
        body: JSON.stringify({ credits: profile?.credits ?? FREE_DAILY_CREDITS, is_pro: profile?.is_pro || false }),
      };
    }

    if (action === 'use') {
      const result = await consumeCredit(userId);
      if (!result.ok) {
        return { statusCode: 402, headers: h, body: JSON.stringify({ error: 'No credits remaining', credits: 0 }) };
      }
      return { statusCode: 200, headers: h, body: JSON.stringify({ credits: result.credits, is_pro: result.is_pro }) };
    }

    return { statusCode: 400, headers: h, body: JSON.stringify({ error: 'Invalid action' }) };
  } catch (e) {
    if (e instanceof HttpError) return { statusCode: e.status, headers: h, body: JSON.stringify({ error: e.message }) };
    return { statusCode: 500, headers: h, body: JSON.stringify({ error: e.message }) };
  }
};
