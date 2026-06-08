// ─── AIVEREE MEMORY SERVICE ───────────────────────────────────────────────────
// Unified memory read/write with embeddings from day 1
// Actions: write | read | search | context | update_importance

const { supabase, CLAUDE_MODEL, corsHeaders, resolveUser, HttpError } = require('./lib/shared');

// ─── GENERATE EMBEDDING ───────────────────────────────────────────────────────
// OpenAI text-embedding-3-small. Returns null on failure (callers handle null).
async function generateEmbedding(text) {
  try {
    const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
        dimensions: 1536
      })
    });

    if (embeddingRes.ok) {
      const data = await embeddingRes.json();
      return data.data?.[0]?.embedding || null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── VALIDATE MEMORY INPUT ────────────────────────────────────────────────────
function validateMemory(data) {
  const required = ['user_id', 'content', 'memory_type', 'source'];
  const validTypes = ['identity', 'operational', 'behavioural', 'relationship', 'insight'];
  const validSources = ['conversation', 'task_output', 'system', 'proactive', 'whatsapp'];

  for (const field of required) {
    if (!data[field]) return { valid: false, error: `Missing required field: ${field}` };
  }
  if (!validTypes.includes(data.memory_type)) {
    return { valid: false, error: `Invalid memory_type. Must be one of: ${validTypes.join(', ')}` };
  }
  if (!validSources.includes(data.source)) {
    return { valid: false, error: `Invalid source. Must be one of: ${validSources.join(', ')}` };
  }
  return { valid: true };
}

// ─── EXTRACT MEMORIES FROM CONVERSATION ──────────────────────────────────────
// Claude extracts meaningful memories from a conversation and validates the output
async function extractMemoriesFromConversation(userId, conversation, projectId) {
  const prompt = `Analyse this conversation and extract meaningful memories about this user.

Conversation:
${conversation.slice(-3000)}

Extract memories as a JSON array. Each memory must have:
- content: specific factual statement about the user (not vague)
- memory_type: one of [identity, operational, behavioural, relationship]
- importance_score: 0.0-1.0 (how important/persistent this memory is)
- emotional_weight: 0.0-1.0 (how emotionally significant)
- summary: 10-word max summary

Rules:
- Extract only concrete, specific facts (not "user seems interested" but "user is building a recruitment business targeting NHS contractors")
- importance_score > 0.7 for goals, fears, major decisions
- emotional_weight > 0.5 for setbacks, wins, fears, confidence signals
- Max 5 memories per conversation
- Return ONLY valid JSON array, no markdown

Example:
[{"content":"User is building a recruitment business targeting NHS contractors in London","memory_type":"identity","importance_score":0.9,"emotional_weight":0.3,"summary":"Building NHS recruitment business London"},{"content":"User has never run a business before and is nervous about it","memory_type":"relationship","importance_score":0.7,"emotional_weight":0.7,"summary":"First-time founder, nervous"}]`;

  try {
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
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    let text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "[]";
    text = text.replace(/```json|```/g, "").trim();

    // Schema validation
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Not an array");

    const validated = parsed.filter(m => {
      return m.content && m.memory_type && typeof m.importance_score === 'number';
    }).slice(0, 5);

    return validated.map(m => ({
      user_id: userId,
      project_id: projectId || null,
      content: m.content,
      summary: m.summary || m.content.slice(0, 50),
      memory_type: m.memory_type,
      importance_score: Math.min(1, Math.max(0, m.importance_score || 0.5)),
      emotional_weight: Math.min(1, Math.max(0, m.emotional_weight || 0)),
      source: 'conversation',
      confidence: 0.8
    }));
  } catch (err) {
    console.error('Memory extraction error:', err);
    return [];
  }
}

// ─── BUILD CONTEXT FOR CLAUDE ─────────────────────────────────────────────────
async function buildClaudeContext(userId, currentMessage) {
  try {
    // 1. Get structured user context
    const { data: context } = await supabase.rpc('get_user_context', { p_user_id: userId });

    // 2. Get top memories by importance
    const { data: topMemories } = await supabase
      .from('memories')
      .select('content, memory_type, importance_score, emotional_weight')
      .eq('user_id', userId)
      .order('importance_score', { ascending: false })
      .limit(8);

    // 3. Semantic search for relevant memories (if we have embedding)
    let semanticMemories = [];
    const queryEmbedding = await generateEmbedding(currentMessage);
    if (queryEmbedding) {
      const { data: similar } = await supabase.rpc('match_memories', {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_threshold: 0.65,
        match_count: 5
      });
      semanticMemories = similar || [];
    }

    // 4. Combine and deduplicate
    const allMemories = [...(topMemories || []), ...semanticMemories]
      .filter((m, i, arr) => arr.findIndex(x => x.content === m.content) === i)
      .slice(0, 10);

    // Build context string for Claude
    const parts = [];

    if (context?.profile) {
      parts.push(`USER: ${context.profile.name || 'Unknown'} | Plan: ${context.profile.plan} | Last active: ${context.profile.last_active_at}`);
    }

    if (context?.active_goals?.length) {
      parts.push(`GOALS: ${context.active_goals.map(g => `${g.title} (${g.domain}, ${g.progress_pct}%)`).join(' | ')}`);
    }

    if (context?.active_projects?.length) {
      parts.push(`PROJECTS: ${context.active_projects.map(p => `${p.name} [${p.status}/${p.phase}]`).join(' | ')}`);
    }

    if (context?.pending_approvals > 0) {
      parts.push(`PENDING APPROVALS: ${context.pending_approvals} items awaiting user sign-off`);
    }

    if (allMemories.length) {
      const memStr = allMemories.map(m =>
        `[${m.memory_type?.toUpperCase() || 'MEMORY'}] ${m.content}`
      ).join('\n');
      parts.push(`MEMORY CONTEXT:\n${memStr}`);
    }

    if (context?.days_since_active > 2) {
      parts.push(`NOTE: User has been inactive for ${context.days_since_active} days.`);
    }

    return {
      context_string: parts.join('\n\n'),
      memories_used: allMemories.length,
      has_goals: (context?.active_goals?.length || 0) > 0
    };
  } catch (err) {
    console.error('Context build error:', err);
    return { context_string: '', memories_used: 0, has_goals: false };
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const { action, ...params } = JSON.parse(event.body || "{}");

    // Authoritative user id: from the bearer token (browser) or, for internal
    // service-to-service calls, from the trusted body. Never trust a raw body id.
    const { userId } = await resolveUser(event, params);
    if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };
    params.user_id = userId;

    switch (action) {

      // Write a single memory with embedding
      case 'write': {
        const validation = validateMemory(params);
        if (!validation.valid) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: validation.error }) };
        }

        const embedding = await generateEmbedding(params.content);

        const { data, error } = await supabase.from('memories').insert({
          user_id: params.user_id,
          project_id: params.project_id || null,
          goal_id: params.goal_id || null,
          memory_type: params.memory_type,
          source: params.source,
          content: params.content,
          summary: params.summary || params.content.slice(0, 60),
          importance_score: params.importance_score || 0.5,
          emotional_weight: params.emotional_weight || 0,
          confidence: params.confidence || 0.8,
          embedding: embedding,
          metadata: params.metadata || {}
        }).select().single();

        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ memory: data }) };
      }

      // Extract and write memories from a conversation
      case 'extract_from_conversation': {
        const { user_id, conversation, project_id } = params;
        if (!user_id || !conversation) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id and conversation required" }) };
        }

        const extracted = await extractMemoriesFromConversation(user_id, conversation, project_id);

        if (extracted.length === 0) {
          return { statusCode: 200, headers: CORS, body: JSON.stringify({ memories_written: 0 }) };
        }

        // Generate embeddings and write all memories
        const memoriesWithEmbeddings = await Promise.all(
          extracted.map(async (m) => ({
            ...m,
            embedding: await generateEmbedding(m.content)
          }))
        );

        const { data, error } = await supabase.from('memories').insert(memoriesWithEmbeddings).select();
        if (error) throw error;

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ memories_written: data.length, memories: data }) };
      }

      // Build context string for Claude injection
      case 'build_context': {
        const { user_id, current_message } = params;
        if (!user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };

        const context = await buildClaudeContext(user_id, current_message || '');
        return { statusCode: 200, headers: CORS, body: JSON.stringify(context) };
      }

      // Get top memories for a user
      case 'read': {
        const { user_id, memory_type, limit = 10 } = params;
        if (!user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };

        let query = supabase.from('memories').select('*').eq('user_id', user_id).order('importance_score', { ascending: false }).limit(limit);
        if (memory_type) query = query.eq('memory_type', memory_type);

        const { data, error } = await query;
        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ memories: data }) };
      }

      // Semantic search
      case 'search': {
        const { user_id, query, limit = 10, memory_types } = params;
        if (!user_id || !query) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id and query required" }) };

        const embedding = await generateEmbedding(query);
        if (!embedding) return { statusCode: 200, headers: CORS, body: JSON.stringify({ memories: [] }) };

        const { data, error } = await supabase.rpc('match_memories', {
          query_embedding: embedding,
          match_user_id: user_id,
          match_threshold: 0.65,
          match_count: limit,
          memory_types: memory_types || null
        });

        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ memories: data }) };
      }

      // Reinforce a memory (increase importance when referenced again)
      case 'reinforce': {
        const { memory_id } = params;
        if (!memory_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "memory_id required" }) };

        // Read-modify-write: supabase-js v2 has no .raw() for in-place SQL expressions.
        // Also scopes the update to the acting user so one user can't reinforce another's memory.
        const { data: existing, error: readErr } = await supabase
          .from('memories')
          .select('reinforcement_count, importance_score, user_id')
          .eq('id', memory_id)
          .single();
        if (readErr) throw readErr;
        if (!existing || existing.user_id !== userId) {
          return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "memory not found" }) };
        }

        const { error } = await supabase.from('memories').update({
          reinforcement_count: (existing.reinforcement_count || 0) + 1,
          importance_score: Math.min(1.0, (existing.importance_score || 0) + 0.05),
          last_accessed_at: new Date().toISOString()
        }).eq('id', memory_id);

        if (error) throw error;
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ reinforced: true }) };
      }

      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return { statusCode: err.status, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
    console.error('Memory service error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Memory service failed', detail: err.message }) };
  }
};
