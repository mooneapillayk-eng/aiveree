const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const h = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'Content-Type,Authorization',
  'Content-Type':'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:200,headers:h,body:''};
  try {
    const body = JSON.parse(event.body||'{}');
    const { action } = body;
    const token = event.headers.authorization?.replace('Bearer ','');

    // Get user from token
    let userId = null;
    if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;
    }

    // ── Get intelligence profile ──────────────────────────────────
    if (action === 'get') {
      if (!userId) return {statusCode:401,headers:h,body:JSON.stringify({error:'Unauthorised'})};
      const { data, error } = await supabase
        .from('user_intelligence')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') {
        return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      }
      return {statusCode:200,headers:h,body:JSON.stringify({profile:data||null})};
    }

    // ── Create or update intelligence profile ─────────────────────
    if (action === 'save') {
      if (!userId) return {statusCode:401,headers:h,body:JSON.stringify({error:'Unauthorised'})};
      const { name, goal, context, blockers, experience_level, interests, onboarding_complete, conversation_history, profile_summary } = body;

      // Check if profile exists
      const { data: existing } = await supabase
        .from('user_intelligence')
        .select('id')
        .eq('user_id', userId)
        .single();

      const profileData = {
        user_id: userId,
        ...(name !== undefined && { name }),
        ...(goal !== undefined && { goal }),
        ...(context !== undefined && { context }),
        ...(blockers !== undefined && { blockers }),
        ...(experience_level !== undefined && { experience_level }),
        ...(interests !== undefined && { interests }),
        ...(onboarding_complete !== undefined && { onboarding_complete }),
        ...(conversation_history !== undefined && { conversation_history }),
        ...(profile_summary !== undefined && { profile_summary }),
        updated_at: new Date().toISOString()
      };

      let result;
      if (existing) {
        result = await supabase
          .from('user_intelligence')
          .update(profileData)
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        profileData.created_at = new Date().toISOString();
        result = await supabase
          .from('user_intelligence')
          .insert(profileData)
          .select()
          .single();
      }

      if (result.error) {
        return {statusCode:400,headers:h,body:JSON.stringify({error:result.error.message})};
      }
      return {statusCode:200,headers:h,body:JSON.stringify({profile:result.data})};
    }

    // ── Build profile summary from conversation ───────────────────
    if (action === 'summarise') {
      if (!userId) return {statusCode:401,headers:h,body:JSON.stringify({error:'Unauthorised'})};
      const { conversation } = body;

      // Use Claude to extract a structured profile from the onboarding conversation
      const summaryPrompt = `You are analysing an onboarding conversation from Aiveree to build a user intelligence profile.
Extract the following from the conversation and return as JSON only (no markdown, no backticks):
{
  "name": "their name if mentioned",
  "goal": "what they are working toward",
  "context": "relevant background (job, situation, experience)",
  "blockers": "what is getting in their way",
  "experience_level": "beginner|intermediate|advanced",
  "interests": ["list", "of", "key", "interests"],
  "profile_summary": "A 2-3 sentence summary of who this person is and what they need"
}
If any field is not mentioned, use an empty string or empty array.`;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: summaryPrompt,
          messages: [{role:"user", content: JSON.stringify(conversation)}]
        })
      });
      const claudeData = await claudeRes.json();
      const summaryText = claudeData.content?.[0]?.text || '{}';

      let parsed;
      try {
        parsed = JSON.parse(summaryText.replace(/```json|```/g,'').trim());
      } catch {
        parsed = { profile_summary: summaryText };
      }

      // Save to database
      const profileData = {
        user_id: userId,
        name: parsed.name || '',
        goal: parsed.goal || '',
        context: parsed.context || '',
        blockers: parsed.blockers || '',
        experience_level: parsed.experience_level || 'beginner',
        interests: parsed.interests || [],
        profile_summary: parsed.profile_summary || '',
        onboarding_complete: true,
        conversation_history: conversation,
        updated_at: new Date().toISOString()
      };

      const { data: existing } = await supabase
        .from('user_intelligence')
        .select('id')
        .eq('user_id', userId)
        .single();

      let result;
      if (existing) {
        result = await supabase.from('user_intelligence').update(profileData).eq('user_id', userId).select().single();
      } else {
        profileData.created_at = new Date().toISOString();
        result = await supabase.from('user_intelligence').insert(profileData).select().single();
      }

      return {statusCode:200,headers:h,body:JSON.stringify({profile:result.data||parsed})};
    }

    return {statusCode:400,headers:h,body:JSON.stringify({error:'Invalid action'})};
  } catch(e) {
    return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})};
  }
};
