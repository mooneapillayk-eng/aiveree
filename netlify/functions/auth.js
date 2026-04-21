const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const supabasePublic = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const h = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'Content-Type,Authorization',
  'Content-Type':'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:200,headers:h,body:''};
  try {
    const { action, email, password, name, provider, redirectTo } = JSON.parse(event.body||'{}');
    const token = event.headers.authorization?.replace('Bearer ','');

    // ── OAuth: get redirect URL for Google/Microsoft/Apple ──────────────────
    if (action === 'oauth') {
      const validProviders = ['google','azure','apple'];
      if (!validProviders.includes(provider)) {
        return {statusCode:400,headers:h,body:JSON.stringify({error:'Invalid provider'})};
      }
      const { data, error } = await supabasePublic.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || process.env.URL + '/?auth=callback',
          skipBrowserRedirect: true,
        }
      });
      if (error) return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      return {statusCode:200,headers:h,body:JSON.stringify({url:data.url})};
    }

    // ── Get current user profile ─────────────────────────────────────────────
    if (action === 'me') {
      if (!token) return {statusCode:401,headers:h,body:JSON.stringify({error:'Unauthorised'})};
      const { data: userData } = await supabase.auth.getUser(token);
      if (!userData?.user) return {statusCode:401,headers:h,body:JSON.stringify({error:'Invalid token'})};
      const { data: profile } = await supabase.from('profiles').select('*').eq('id',userData.user.id).single();
      return {statusCode:200,headers:h,body:JSON.stringify({user:userData.user, profile})};
    }

    // ── Handle OAuth callback — exchange code for session ──────────────────
    if (action === 'oauth_callback') {
      const { code } = JSON.parse(event.body||'{}');
      const { data, error } = await supabasePublic.auth.exchangeCodeForSession(code);
      if (error) return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      // Ensure profile exists
      if (data.user) {
        const { data: existing } = await supabase.from('profiles').select('id').eq('id',data.user.id).single();
        if (!existing) {
          // New social user — create profile with 5 welcome credits
          await supabase.from('profiles').insert({
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
            credits: 5,
            is_pro: false,
            plan: 'free',
            credit_date: new Date().toDateString(),
            created_at: new Date().toISOString()
          });
          const { data: profile } = await supabase.from('profiles').select('*').eq('id',data.user.id).single();
          return {statusCode:200,headers:h,body:JSON.stringify({session:data.session,user:data.user,profile,isNewUser:true})};
        }
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id',data.user.id).single();
      return {statusCode:200,headers:h,body:JSON.stringify({session:data.session,user:data.user,profile,isNewUser:false})};
    }

    // ── Email sign up ────────────────────────────────────────────────────────
    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({email, password, options:{data:{name}}});
      if (error) return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          name: name||'',
          credits: 5,
          is_pro: false,
          plan: 'free',
          credit_date: new Date().toDateString(),
          created_at: new Date().toISOString()
        });
      }
      return {statusCode:200,headers:h,body:JSON.stringify({user:data.user,session:data.session})};
    }

    // ── Email sign in ────────────────────────────────────────────────────────
    if (action === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({email, password});
      if (error) return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      const { data: profile } = await supabase.from('profiles').select('*').eq('id',data.user.id).single();
      return {statusCode:200,headers:h,body:JSON.stringify({session:data.session,user:data.user,profile})};
    }

    return {statusCode:400,headers:h,body:JSON.stringify({error:'Invalid action'})};
  } catch(e) {
    return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})};
  }
};
