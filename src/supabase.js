import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isConfigured = !!(supabaseUrl && supabaseAnonKey)

// Graceful fallback — site loads even without env vars
// All Supabase ops silently no-op until VITE_ variables are added
const mockChain = () => ({ eq: mockChain, single: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }), single: async () => ({ data: null, error: null }) }), limit: async () => ({ data: [], error: null }), select: () => mockChain() })

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : { from: () => ({ upsert: async () => ({ error: null }), insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }), select: () => mockChain(), update: () => ({ eq: async () => ({ error: null }) }) }), rpc: async () => ({ data: null, error: null }), auth: { getUser: async () => ({ data: { user: null } }) } }

// ─── AUTH + AUTHENTICATED FETCH ───────────────────────────────────────────────
// Real Supabase-backed auth via netlify/functions/auth.js. The returned session's
// access_token is attached as a Bearer header on every privileged function call,
// so the backend derives the user id from the token (never from the request body).
const SESSION_KEY = 'aiveree_session_v1'

export function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}
function storeSession(session) {
  try {
    if (session?.access_token) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {}
}
export function getToken() {
  return getStoredSession()?.access_token || null
}
export function signOutUser() { storeSession(null) }

async function authCall(action, payload) {
  const res = await fetch('/.netlify/functions/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Authentication failed')
  return data
}

export async function signUpUser({ name, email, password }) {
  const data = await authCall('signup', { name, email, password })
  storeSession(data.session)
  return data // { user, session }
}
export async function signInUser({ email, password }) {
  const data = await authCall('signin', { email, password })
  storeSession(data.session)
  return data // { user, session, profile }
}

// OAuth: get the provider URL and redirect; the callback is handled on load.
export async function startOAuth(provider) {
  const map = { Google: 'google', Apple: 'apple', Microsoft: 'azure' }
  const { url } = await authCall('oauth', { provider: map[provider] || provider, redirectTo: window.location.origin + '/?auth=callback' })
  if (url) window.location.href = url
}
export async function completeOAuthIfPresent() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null
  try {
    const data = await authCall('oauth_callback', { code })
    storeSession(data.session)
    window.history.replaceState({}, '', window.location.pathname)
    return data
  } catch {
    return null
  }
}

// Restore an existing session on load (validates the token against the backend).
export async function restoreSession() {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'me' })
    })
    if (!res.ok) { signOutUser(); return null }
    return await res.json() // { user, profile }
  } catch {
    return null
  }
}

// POST to a Netlify function with the bearer token attached (when present).
// Pass { onboarding: true } for the single pre-signup call that is allowed anonymously.
export async function apiFetch(path, body, { onboarding = false } = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const finalBody = onboarding ? { ...body, mode: 'onboarding' } : body
  return fetch(path, { method: 'POST', headers, body: JSON.stringify(finalBody) })
}

export async function createUserProfile(userId, data) {
  if (!isConfigured || !userId) return null
  try {
    await supabase.from('profiles').upsert({
      id: userId, name: data.name, email: data.email,
      preferred_channel: 'app', language_code: 'en', timezone: 'Europe/London',
      onboarded_at: new Date().toISOString(), last_active_at: new Date().toISOString(),
      credits: 5, credit_date: new Date().toDateString(), is_pro: false, plan: 'free'
    })
  } catch (e) { console.warn('createUserProfile:', e.message) }
}

export async function createGoal(userId, data) {
  if (!isConfigured || !userId) return null
  try {
    const { data: goal } = await supabase.from('goals').insert({
      user_id: userId, title: data.title || (data.goal||'').slice(0, 100),
      description: data.goal, domain: data.domain_id || 'business',
      status: 'active', emotional_investment: 7, progress_pct: 0
    }).select().single()
    return goal
  } catch (e) { console.warn('createGoal:', e.message); return null }
}

export async function createProject(userId, goalId, data) {
  if (!isConfigured || !userId) return null
  try {
    const { data: project } = await supabase.from('projects').insert({
      user_id: userId, goal_id: goalId,
      name: (data.title || data.goal || 'My project').slice(0, 80),
      description: data.goal, domain: data.domain_id || 'business',
      status: 'active', phase: 'planning',
      context: { onboarding_goal: data.goal, domain: data.domain_id },
      last_activity_at: new Date().toISOString()
    }).select().single()
    return project
  } catch (e) { console.warn('createProject:', e.message); return null }
}

export async function initUserState(userId, domain) {
  if (!isConfigured || !userId) return
  try {
    await supabase.from('user_state').upsert({
      id: userId, primary_focus: domain, current_domain: domain,
      emotional_state: 'motivated', momentum_score: 0.5,
      execution_velocity: 0.5, consistency_score: 0.5,
      active_priorities: [], current_blockers: [],
      raw_summary: 'Just started. Goal set. Team briefed.',
      generated_at: new Date().toISOString()
    })
  } catch (e) { console.warn('initUserState:', e.message) }
}

export async function getPendingApprovals(userId) {
  if (!isConfigured || !userId) return []
  try {
    const { data } = await supabase.from('approvals')
      .select('*').eq('user_id', userId).eq('status', 'pending')
      .order('created_at', { ascending: false })
    return data || []
  } catch { return [] }
}

export async function getLatestDigest(userId) {
  if (!isConfigured || !userId) return null
  try {
    const { data } = await supabase.from('digests')
      .select('*').eq('user_id', userId).eq('digest_type', 'morning')
      .order('created_at', { ascending: false }).limit(1).single()
    return data
  } catch { return null }
}

export async function getUserState(userId) {
  if (!isConfigured || !userId) return null
  try {
    const { data } = await supabase.from('user_state').select('*').eq('id', userId).single()
    return data
  } catch { return null }
}

export async function updateMomentum(userId) {
  if (!isConfigured || !userId) return null
  try {
    const { data } = await supabase.rpc('calculate_momentum', { p_user_id: userId })
    if (data !== null) {
      await supabase.from('user_state').update({ momentum_score: data, updated_at: new Date().toISOString() }).eq('id', userId)
    }
    return data
  } catch { return null }
}

// ─── MEMORY MANAGEMENT (visible + controllable) ───────────────────────────────
// Backs the in-app "what Aiveree remembers" view: list, edit, forget, timeline.
// The user id is derived server-side from the bearer token, never passed here.
async function memoryJSON(action, body = {}) {
  try {
    const res = await apiFetch('/.netlify/functions/memory', { action, ...body })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}
export async function listMemories(limit = 100) {
  const d = await memoryJSON('list', { limit }); return d?.memories || []
}
export async function editMemory(memory_id, { content, summary } = {}) {
  const d = await memoryJSON('update', { memory_id, content, summary }); return d?.memory || null
}
export async function forgetMemory(memory_id) {
  const d = await memoryJSON('delete', { memory_id }); return !!d?.deleted
}
export async function memoryTimeline() {
  const d = await memoryJSON('timeline', {}); return d?.timeline || []
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
async function projectsJSON(action, body = {}) {
  try {
    const res = await apiFetch('/.netlify/functions/projects', { action, ...body })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}
export async function listProjects() {
  const d = await projectsJSON('list'); return d?.projects || []
}
export async function createProjectRecord(name, description) {
  const d = await projectsJSON('create', { name, description }); return d?.project || null
}
export async function updateProjectRecord(project_id, patch = {}) {
  const d = await projectsJSON('update', { project_id, ...patch }); return d?.project || null
}
export async function deleteProjectRecord(project_id) {
  const d = await projectsJSON('delete', { project_id }); return !!d?.deleted
}
