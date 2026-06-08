// ─── AIVEREE CLAUDE SERVICE ───────────────────────────────────────────────────
// Claude reasoning engine with memory injection and schema validation
// Claude reasons — the backend stores

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

// ─── SCHEMA VALIDATOR ─────────────────────────────────────────────────────────
const SCHEMAS = {
  dashboard: {
    required: ['journey_stage', 'agent_insight', 'action_prompts', 'milestones', 'quick_wins'],
    validate: (d) => {
      if (typeof d.journey_stage !== 'string') return 'journey_stage must be string';
      if (typeof d.agent_insight !== 'string') return 'agent_insight must be string';
      if (!Array.isArray(d.action_prompts) || d.action_prompts.length === 0) return 'action_prompts must be non-empty array';
      if (!Array.isArray(d.milestones) || d.milestones.length === 0) return 'milestones must be non-empty array';
      if (!Array.isArray(d.quick_wins) || d.quick_wins.length === 0) return 'quick_wins must be non-empty array';
      return null;
    }
  },
  task_plan: {
    required: ['intent', 'domain', 'required_actions'],
    validate: (d) => {
      if (typeof d.intent !== 'string') return 'intent must be string';
      if (!Array.isArray(d.required_actions)) return 'required_actions must be array';
      return null;
    }
  }
};

function validateSchema(data, schemaName) {
  const schema = SCHEMAS[schemaName];
  if (!schema) return { valid: true }; // No schema = pass through

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'build_context', user_id: userId, current_message: currentMessage })
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fire', event_type: eventType, user_id: userId, payload, project_id: projectId })
    });
  } catch {}
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const {
      messages,
      system,
      useSearch = false,
      userId,
      projectId,
      schemaValidation,
      maxRetries = 2,
      eventType
    } = JSON.parse(event.body || "{}");

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "messages array required" }) };
    }

    // Get memory context if we have a userId
    let memoryContext = '';
    if (userId) {
      const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
      memoryContext = await getMemoryContext(userId, lastUserMsg);
    }

    // Build system prompt with memory
    const fullSystem = memoryContext
      ? `${system || ''}\n\n─── AIVEREE MEMORY CONTEXT ───\n${memoryContext}\n─────────────────────────────`
      : (system || '');

    // Tools
    const tools = useSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined;

    let attempts = 0;
    let lastError = null;
    let result = null;

    // Retry loop with schema validation
    while (attempts <= maxRetries) {
      attempts++;
      try {
        const body = {
          model: "claude-sonnet-4-20250514",
          max_tokens: schemaValidation ? 2000 : 4000,
          system: fullSystem,
          messages,
        };
        if (tools) body.tools = tools;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const err = await res.text();
          lastError = `API error ${res.status}: ${err}`;
          continue;
        }

        const data = await res.json();
        const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");

        // Schema validation if requested
        if (schemaValidation) {
          try {
            const parsed = parseJSON(text);
            const validation = validateSchema(parsed, schemaValidation);

            if (!validation.valid) {
              lastError = `Schema validation failed: ${validation.error}`;
              if (attempts <= maxRetries) {
                // Add repair instruction for retry
                messages.push({ role: "assistant", content: text });
                messages.push({ role: "user", content: `The response failed validation: ${validation.error}. Please fix and return valid JSON.` });
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
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: lastError || 'All retry attempts failed' }) };
    }

    // Fire conversation event asynchronously
    if (userId && eventType) {
      fireEvent(eventType, userId, { message_count: messages.length }, projectId);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };

  } catch (err) {
    console.error('Claude service error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Claude service failed', detail: err.message }) };
  }
};
