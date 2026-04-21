exports.handler = async (e) => {
  const h = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
  if (e.httpMethod === "OPTIONS") return {statusCode:200,headers:h,body:""};
  try {
    const {messages, system, useSearch} = JSON.parse(e.body);
    const body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: useSearch ? 4000 : 2000,
      system,
      messages
    };
    if (useSearch) {
      body.tools = [{type:"web_search_20250305", name:"web_search"}];
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-api-key":process.env.ANTHROPIC_API_KEY,
        "anthropic-version":"2023-06-01"
      },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    return {statusCode:200,headers:h,body:JSON.stringify(d)};
  } catch(err) {
    return {statusCode:500,headers:h,body:JSON.stringify({error:err.message})};
  }
};
