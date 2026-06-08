// ─── SHARED HELPERS FOR NETLIFY FUNCTIONS ─────────────────────────────────────
// CORS (origin allowlist), auth (token → user), rate limiting, and config.
// Lives in lib/ so Netlify does not register it as its own endpoint.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Single source of truth for the free tier and the model id.
const FREE_DAILY_CREDITS = Number(process.env.FREE_DAILY_CREDITS || 5);
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// ─── CORS ─────────────────────────────────────────────────────────────────────
function allowedOrigins() {
  const list = [];
  if (process.env.URL) list.push(process.env.URL);
  if (process.env.DEPLOY_PRIME_URL) list.push(process.env.DEPLOY_PRIME_URL);
  if (process.env.ALLOWED_ORIGINS) {
    list.push(...process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()));
  }
  // Local dev origins.
  list.push('http://localhost:8888', 'http://localhost:5173', 'http://localhost:3000');
  return list.filter(Boolean);
}

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allow = allowedOrigins();
  const ok = allow.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allow[0] || ''),
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// Returns the Supabase user for a valid bearer token, else null.
async function getOptionalUser(event) {
  const token = getToken(event);
  if (!token) return null;
  try {
    const { data } = await supabase.auth.getUser(token);
    return data?.user || null;
  } catch {
    return null;
  }
}

// Returns the user or throws HttpError(401). Derive user_id from this — never the body.
async function requireUser(event) {
  const user = await getOptionalUser(event);
  if (!user) throw new HttpError(401, 'Unauthorised');
  return user;
}

// Service-to-service calls (e.g. claude.js → memory.js) carry a shared secret so
// they can act on a given user_id without a browser token. Returns false when the
// secret is unset, so this can never be a bypass in a misconfigured environment.
function internalSecretOk(event) {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return false;
  const got = event.headers?.['x-internal-secret'] || event.headers?.['X-Internal-Secret'];
  return !!got && got === secret;
}

// Resolve the acting user: trust body user_id only for internal calls; otherwise
// require a real bearer token and derive the id from it.
async function resolveUser(event, body) {
  if (internalSecretOk(event)) {
    return { userId: body.user_id || body.userId || null, internal: true };
  }
  const user = await requireUser(event);
  return { userId: user.id, internal: false };
}

const INTERNAL_HEADERS = process.env.INTERNAL_SECRET
  ? { 'x-internal-secret': process.env.INTERNAL_SECRET }
  : {};

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
// Best-effort, backed by a `rate_limits` table. Fails open if the table is absent
// so a missing migration never takes the app down.
async function rateLimit(key, max, windowMs) {
  try {
    const windowStart = new Date(Date.now() - windowMs).toISOString();
    const { count } = await supabase
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', key)
      .gte('created_at', windowStart);
    if ((count || 0) >= max) return false;
    await supabase.from('rate_limits').insert({ bucket: key, created_at: new Date().toISOString() });
    return true;
  } catch {
    return true; // fail-open
  }
}

// ─── CREDITS ──────────────────────────────────────────────────────────────────
// Single source of truth for spending a free credit. Pro users are unmetered.
// Applies the daily free-tier reset. Returns { ok, credits, is_pro, reason }.
async function consumeCredit(userId) {
  const today = new Date().toDateString();
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits,is_pro,credit_date')
    .eq('id', userId)
    .single();
  if (!profile) return { ok: false, credits: 0, is_pro: false, reason: 'no_profile' };
  if (profile.is_pro) return { ok: true, credits: profile.credits ?? 0, is_pro: true };

  let credits = profile.credit_date !== today ? FREE_DAILY_CREDITS : (profile.credits ?? FREE_DAILY_CREDITS);
  if (credits <= 0) return { ok: false, credits: 0, is_pro: false, reason: 'no_credits' };

  credits -= 1;
  await supabase.from('profiles').update({ credits, credit_date: today }).eq('id', userId);
  return { ok: true, credits, is_pro: false };
}

function clientIp(event) {
  const h = event.headers || {};
  return (
    h['x-nf-client-connection-ip'] ||
    h['x-forwarded-for']?.split(',')[0]?.trim() ||
    h['client-ip'] ||
    'unknown'
  );
}

function json(statusCode, headers, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

module.exports = {
  supabase,
  FREE_DAILY_CREDITS,
  CLAUDE_MODEL,
  corsHeaders,
  getToken,
  getOptionalUser,
  requireUser,
  internalSecretOk,
  resolveUser,
  INTERNAL_HEADERS,
  consumeCredit,
  rateLimit,
  clientIp,
  json,
  HttpError,
};
