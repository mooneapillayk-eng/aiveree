// ─── AIVEREE CLAUDE SERVICE ───────────────────────────────────────────────────
// Claude reasoning engine with memory injection and schema validation.
// Hardened: origin allowlist, optional auth (+ onboarding path), rate limiting,
// request-size cap, upstream error propagation, and server-side credit gating.

const {
  CLAUDE_MODEL,
  corsHeaders,
  getOptionalUser,
  consumeCredit,
  rateLimit,
  clientIp,
  INTERNAL_HEADERS,
  json,
} = require('./lib/shared');

// Reject obviously abusive payloads early.
const MAX_MESSAGES_CHARS = 100000;

// ─── SCHEMA VALIDATOR ─────────────────────────────────────────────────────────
const SCHEMAS = {
  // Matches the workspace the frontend actually renders (CommandCentre):
  // momentum / next_best_action / active_workstreams / open_loops /
  // quiet_progress / suggested_capabilities.
  dashboard: {
    required: ['momentum', 'next_best_action', 'active_workstreams', 'open_loops', 'quiet_progress', 'suggested_capabilities'],
    validate: (d) => {
      if (!d.momentum || typeof d.momentum.headline !== 'string') return 'momentum.headline must be string';
      if (!d.next_best_action || typeof d.next_best_action.text !== 'string') return 'next_best_action.text must be string';
      if (!Array.isArray(d.active_workstreams) || d.active_workstreams.length === 0) return 'active_workstreams must be non-empty array';
      if (!Array.isArray(d.open_loops)) return 'open_loops must be array';
      if (!Array.isArray(d.quiet_progress)) return 'quiet_progress must be array';
      if (!Array.isArray(d.suggested_capabilities) || d.suggested_capabilities.length === 0) return 'suggested_capabilities must be non-empty array';
      return null;
    },
  },
  task_plan: {
    required: ['intent', 'domain', 'required_actions'],
    validate: (d) => {
      if (typeof d.intent !== 'string') return 'intent must be string';
      if (!Array.isArray(d.required_actions)) return 'required_actions must be array';
      return null;
    },
  },
};

function validateSchema(data, schemaName) {
  const schema = SCHEMAS[schemaName];
  if (!schema) return { valid: true };
  for (const field of schema.required) {
    if (data[field] === undefined || data[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  const validationError = schema.validate(data);
  if (validationError) return { valid: false, error: validationError };
  return { valid: true };
}

function parseJSON(text) {
  let cleaned = text.replace(/```json|```/g, '').trim();
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
  if (s !== -1 && e !== -1) cleaned = cleaned.slice(s, e + 1);
  return JSON.parse(cleaned);
}

// ─── GET MEMORY CONTEXT ───────────────────────────────────────────────────────
async function getMemoryContext(userId, currentMessage) {
  if (!userId) return '';
  try {
    const res = await fetch(`${process.env.URL}/.netlify/functions/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
      body: JSON.stringify({ action: 'build_context', user_id: userId, current_message: currentMessage }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.context_string || '';
  } catch {
    return '';
  }
}

// ─── FIRE EVENT ───────────────────────────────────────────────────────────────
async function fireEvent(eventType, userId, payload = {}, projectId = null) {
  if (!userId) return;
  try {
    await fetch(`${process.env.URL}/.netlify/functions/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
      body: JSON.stringify({ action: 'fire', event_type: eventType, user_id: userId, payload, project_id: projectId }),
    });
  } catch {}
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      messages,
      system,
      useSearch = false,
      projectId,
      schemaValidation,
      maxRetries = 2,
      eventType,
      mode,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return json(400, CORS, { error: 'messages array required' });
    }

    // ── Access control ─────────────────────────────────────────────────────────
    // Authenticated users go through the full path; unauthenticated callers are
    // allowed ONLY for the pre-signup onboarding step, tightly rate-limited.
    const user = await getOptionalUser(event);
    const onboarding = mode === 'onboarding';
    if (!user && !onboarding) {
      return json(401, CORS, { error: 'Authentication required' });
    }

    // ── Request size cap ───────────────────────────────────────────────────────
    if (JSON.stringify(messages).length > MAX_MESSAGES_CHARS) {
      return json(413, CORS, { error: 'Request too large' });
    }

    // ── Rate limiting ──────────────────────────────────────────────────────────
    if (user) {
      const ok = await rateLimit(`claude:user:${user.id}`, 40, 60 * 1000);
      if (!ok) return json(429, CORS, { error: 'Too many requests, please slow down' });
    } else {
      const ip = clientIp(event);
      const ok = await rateLimit(`claude:onboard:${ip}`, 15, 24 * 60 * 60 * 1000);
      if (!ok) return json(429, CORS, { error: 'Onboarding limit reached — please sign up to continue' });
    }

    // ── Credit gating (monetisation) ───────────────────────────────────────────
    // Charge a credit for authenticated, user-initiated, billable actions.
    // Internal/background generation passes billable:false; onboarding is free.
    const billable = !!user && !onboarding && body.billable !== false;
    let creditInfo = null;
    if (billable) {
      const credit = await consumeCredit(user.id);
      if (!credit.ok) return json(402, CORS, { error: 'No credits remaining', credits_remaining: 0 });
      // profiles.credits is the single source of truth; hand the post-charge balance
      // back so the client reflects the server figure instead of guessing locally.
      creditInfo = { credits_remaining: credit.credits, is_pro: credit.is_pro };
    }

    const userId = user?.id || null;

    // Memory context (authenticated users only).
    let memoryContext = '';
    if (userId) {
      const lastUserMsg = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';
      memoryContext = await getMemoryContext(userId, lastUserMsg);
    }

    const fullSystem = memoryContext
      ? `${system || ''}\n\n─── AIVEREE MEMORY CONTEXT ───\n${memoryContext}\n─────────────────────────────`
      : (system || '');

    const tools = useSearch ? [{ type: 'web_search_20250305', name: 'web_search' }] : undefined;

    let attempts = 0;
    let lastError = null;
    let result = null;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        const ALLOWED_MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-sonnet-5'];
        const reqBody = {
          model: (body.model && ALLOWED_MODELS.includes(body.model)) ? body.model : CLAUDE_MODEL,
          max_tokens: schemaValidation ? 2000 : 4000,
          system: fullSystem,
          messages,
        };
        if (tools) reqBody.tools = tools;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(reqBody),
        });

        if (!res.ok) {
          const err = await res.text();
          lastError = `API error ${res.status}: ${err}`;
          // Don't retry on upstream auth errors.
          if (res.status === 401 || res.status === 403) {
            return json(502, CORS, { error: 'Upstream auth error', detail: lastError });
          }
          continue;
        }

        const data = await res.json();
        const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');

        if (schemaValidation) {
          try {
            const parsed = parseJSON(text);
            const validation = validateSchema(parsed, schemaValidation);
            if (!validation.valid) {
              lastError = `Schema validation failed: ${validation.error}`;
              if (attempts <= maxRetries) {
                messages.push({ role: 'assistant', content: text });
                messages.push({ role: 'user', content: `The response failed validation: ${validation.error}. Please fix and return valid JSON.` });
                continue;
              }
            }
            result = { ...data, parsed };
          } catch (parseErr) {
            lastError = `JSON parse failed: ${parseErr.message}`;
            if (attempts <= maxRetries) continue;
          }
        } else {
          result = data;
        }

        break;
      } catch (err) {
        lastError = err.message;
        if (attempts > maxRetries) break;
      }
    }

    if (!result) {
      console.error('All attempts failed:', lastError);
      return json(502, CORS, { error: 'Upstream model error', detail: lastError });
    }

    if (userId && eventType) {
      fireEvent(eventType, userId, { message_count: messages.length }, projectId);
    }

    const payload = creditInfo ? { ...result, ...creditInfo } : result;
    return { statusCode: 200, headers: CORS, body: JSON.stringify(payload) };
  } catch (err) {
    console.error('Claude service error:', err);
    return json(500, CORS, { error: 'Claude service failed', detail: err.message });
  }
};
