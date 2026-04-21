const {createClient} = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const h = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization','Content-Type':'application/json'};

async function getUserId(token) {
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id;
}

async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('credits,is_pro,plan,credit_date').eq('id',userId).single();
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:200,headers:h,body:''};
  try {
    const { action, credits: setAmount, feature } = JSON.parse(event.body||'{}');
    const token = event.headers.authorization?.replace('Bearer ','');
    if (!token) return {statusCode:401,headers:h,body:JSON.stringify({error:'Unauthorised'})};
    
    const userId = await getUserId(token);
    if (!userId) return {statusCode:401,headers:h,body:JSON.stringify({error:'Invalid token'})};

    const profile = await getProfile(userId);
    const today = new Date().toDateString();
    
    // Daily reset: if last reset wasn't today, give 3 fresh credits
    if (profile && profile.credit_date !== today && action !== 'set') {
      await supabase.from('profiles').update({credits:3, credit_date:today}).eq('id',userId);
      if (action === 'get') return {statusCode:200,headers:h,body:JSON.stringify({credits:3,is_pro:profile?.is_pro||false})};
    }
    
    if (action === 'get') {
      return {statusCode:200,headers:h,body:JSON.stringify({credits:profile?.credits??3,is_pro:profile?.is_pro||false})};
    }
    
    if (action === 'set') {
      const c = typeof setAmount === 'number' ? setAmount : 5;
      await supabase.from('profiles').upsert({id:userId,credits:c,credit_date:today}).eq('id',userId);
      return {statusCode:200,headers:h,body:JSON.stringify({credits:c})};
    }
    
    if (action === 'use') {
      const current = profile?.credits ?? 3;
      if (current <= 0) return {statusCode:403,headers:h,body:JSON.stringify({error:'No credits remaining'})};
      const newC = current - 1;
      await supabase.from('profiles').update({credits:newC}).eq('id',userId);
      return {statusCode:200,headers:h,body:JSON.stringify({credits:newC})};
    }

    return {statusCode:400,headers:h,body:JSON.stringify({error:'Invalid action'})};
  } catch(e) {
    return {statusCode:500,headers:h,body:JSON.stringify({error:e.message})};
  }
};
