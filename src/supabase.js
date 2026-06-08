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

export async function createUserProfile(userId, data) {
  if (!isConfigured || !userId) return null
  try {
    await supabase.from('user_profiles').upsert({
      id: userId, name: data.name, email: data.email,
      preferred_channel: 'app', language_code: 'en', timezone: 'Europe/London',
      onboarded_at: new Date().toISOString(), last_active_at: new Date().toISOString(),
      credits_remaining: 5, plan: 'free'
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
