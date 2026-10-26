// ─── RUN STORE ────────────────────────────────────────────────────────────────
// Durable, readable state of every agent run, so the Aiveree app can show a live
// view (latest screenshot + action log + checkpoint) by reading the database.
// Uses Supabase when configured; an in-memory store otherwise (tests / local).
// The full message history for resume is held in the orchestrator process, not
// here — these rows are what the UI renders.

function memStore() {
  const runs = new Map();
  const steps = new Map();
  return {
    kind: 'memory',
    async createRun(r) { runs.set(r.id, { ...r, created_at: Date.now() }); steps.set(r.id, []); },
    async updateRun(id, patch) { const r = runs.get(id); if (r) Object.assign(r, patch, { updated_at: Date.now() }); },
    async addStep(id, s) { (steps.get(id) || steps.set(id, []).get(id)).push({ ...s, at: Date.now() }); },
    async getRun(id) { return runs.get(id) || null; },
    async listSteps(id) { return steps.get(id) || []; },
  };
}

function supabaseStore() {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return {
    kind: 'supabase',
    async createRun(r) {
      await sb.from('agent_runs').upsert({
        id: r.id, user_id: r.user_id, task: r.task, start_url: r.start_url,
        status: r.status || 'running', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    },
    async updateRun(id, patch) {
      await sb.from('agent_runs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    },
    async addStep(id, s) {
      await sb.from('agent_run_steps').insert({ run_id: id, action: s.action, url: s.url, created_at: new Date().toISOString() });
    },
    async getRun(id) { const { data } = await sb.from('agent_runs').select('*').eq('id', id).maybeSingle(); return data; },
    async listSteps(id) { const { data } = await sb.from('agent_run_steps').select('*').eq('run_id', id).order('created_at', { ascending: true }); return data || []; },
  };
}

function makeStore() {
  return (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) ? supabaseStore() : memStore();
}

module.exports = { makeStore, memStore };
