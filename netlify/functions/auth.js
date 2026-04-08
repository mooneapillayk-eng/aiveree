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

    if (action === 'oauth') {
      const validProviders = ['google','azure','apple'];
      if (!validProviders.includes(provider)) return {statusCode:400,headers:h,body:JSON.stringify({error:'Invalid provider'})};
      const { data, error } = await supabasePublic.auth.signInWithOAuth({provider, options:{redirectTo: redirectTo||process.env.URL+'/?auth=callback',skipBrowserRedirect:true}});
      if (error) return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      return {statusCode:200,headers:h,body:JSON.stringify({url:data.url})};
    }
    if (action === 'me') {
      if (!token) return {statusCode:401,headers:h,body:JSON.stringify({error:'Unauthorised'})};
      const { data: userData } = await supabase.auth.getUser(token);
      if (!userData?.user) return {statusCode:401,headers:h,body:JSON.stringify({error:'Invalid token'})};
      const { data: profile } = await supabase.from('profiles').select('*').eq('id',userData.user.id).single();
      return {statusCode:200,headers:h,body:JSON.stringify({user:userData.user,profile})};
    }
    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUr({email,password,options:{data:{name}}});
      if (error) return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      if (data.user) await supabase.from('profiles').upsert({id:data.user.id,email:data.user.email,name:name||'',credits:5,is_pro:false,plan:'free',credit_date:new Date().toDateString(),created_at:new Date().toISOString()});
      return {statusCode:200,headers:h,body:JSON.stringify({user:data.user,session:data.session})};
    }
    if (action === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({email,password});
      if (error) return {statusCode:400,headers:h,body:JSON.stringify({error:error.message})};
      const { data: profile } = await supabase.from('profiles').select('*').eq('id',data.user.id).single();
      return {statusCode:200,headers:h,body:JSON.stringify({session:data.session,user:data.user,profile})};
    }
    return {statusCode:400,headers:h,body:JSON.stringify({error:'Invalid action'})};
  } catch(e) { return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})}; }
};