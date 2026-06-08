import { useState, useEffect, useRef, useCallback } from "react";
import { createUserProfile, createGoal, createProject, initUserState, getPendingApprovals, supabase,
  signUpUser, signInUser, startOAuth, completeOAuthIfPresent, restoreSession, signOutUser, apiFetch } from "./supabase.js";

// ─── BACKEND HELPERS ──────────────────────────────────────────────────────────
async function fireEvent(eventType, userId, payload = {}, projectId = null) {
  if (!userId) return;
  try {
    await apiFetch("/.netlify/functions/events", { action: "fire", event_type: eventType, user_id: userId, payload, project_id: projectId });
  } catch {}
}

async function extractMemories(userId, conversation, projectId) {
  if (!userId || !conversation?.length) return;
  try {
    const convText = conversation.map(m => `${m.role === "user" ? "User" : "Aiveree"}: ${m.content}`).join("\n");
    await apiFetch("/.netlify/functions/memory", { action: "extract_from_conversation", user_id: userId, conversation: convText, project_id: projectId });
  } catch {}
}

async function requestPhoneNumber(userName) {
  const phone = window.prompt(`${userName}, would you like Aiveree to check in with you via WhatsApp?\n\nEnter your WhatsApp number (e.g. +447700900123) or cancel to skip:`);
  if (!phone?.trim()) return null;

  const format = window.confirm(
    `Would you prefer Aiveree to send voice notes on WhatsApp?\n\nOK = Voice notes (hear Aiveree's voice)\nCancel = Text messages`
  ) ? 'voice' : 'text';

  return { phone: phone.trim(), format };
}

// ─── DOMAIN WORKSPACES ────────────────────────────────────────────────────────
const DOMAINS = [
  { id:"career",    label:"Career growth",        emoji:"💼", desc:"Get a better role, negotiate more, or change direction completely.", color:"#7c3aed", live:true },
  { id:"business",  label:"Start a business",     emoji:"🚀", desc:"Turn your idea into a real plan with research, financials, and legal setup.", color:"#059669", live:true },
  { id:"grow",      label:"Grow my business",     emoji:"📈", desc:"More customers, better margins, sharper positioning.", color:"#0891b2", live:true },
  { id:"side",      label:"Side hustle",          emoji:"⚡", desc:"Build income alongside your job without burning out.", color:"#d97706", live:true },
  { id:"housing",   label:"Housing issue",        emoji:"🏠", desc:"Tenant rights, disputes, documents — fully on your side.", color:"#dc2626", live:false },
  { id:"finance",   label:"Sort my finances",     emoji:"💰", desc:"Benefits, budgets, debt, and tax — in plain English.", color:"#ea580c", live:false },
  { id:"health",    label:"Health navigation",    emoji:"🏥", desc:"Understand the NHS, know your rights, get the right support.", color:"#16a34a", live:false },
  { id:"tech",      label:"Tech career",          emoji:"💻", desc:"Break into tech or level up your career in it.", color:"#4f46e5", live:false },
];

// ─── SPECIALIST CAPABILITIES BY DOMAIN ───────────────────────────────────────
const CAPABILITIES = {
  career: [
    { id:"jobs",       icon:"🔍", label:"Find live job matches",       auto:true,  prompt:"Search the web for real current UK job listings that specifically match this person's goal and background. Find 6-8 actual roles with job titles, companies, locations, salary where listed, and real application URLs. For each role explain in one sentence exactly why it fits. Lead with the most exciting opportunities." },
    { id:"apply",      icon:"✍️", label:"Write my application",       auto:false, inputLabel:"Paste the job description you want to apply for", prompt:"Based on the user's goal and this job description, write a strong professional summary (3-4 sentences) and a tailored cover letter opening paragraph. Reference their actual situation and target role directly." },
    { id:"interview",  icon:"🎯", label:"Prepare me for interviews",  auto:false, inputLabel:"Which company and role are you preparing for?", prompt:"Research this company and role using web search. Generate 8-10 highly relevant interview questions they will likely face, with specific talking points for each based on their background." },
    { id:"salary",     icon:"💷", label:"Research my salary",         auto:true,  prompt:"Search for real current UK salary data for their target role and location. Give ranges at different experience levels. Write a specific negotiation strategy — what to say, when to say it, what number to anchor on." },
    { id:"skills",     icon:"📚", label:"Identify my skill gaps",     auto:true,  prompt:"Analyse their goal against the current job market. Identify 4-5 specific skill gaps. For each gap, find a real free or affordable course with an actual URL. Give a clear learning order and realistic time estimate." },
  ],
  business: [
    { id:"plan",      icon:"📋", label:"Build my business plan",      auto:true,  prompt:"Write a complete lean business plan specifically for this person's idea. Include: the problem, solution, target market with specific demographics, revenue model with realistic numbers, key risks, and a first 90-day action plan." },
    { id:"market",    icon:"🔭", label:"Research my market",          auto:true,  prompt:"Search Companies House and the web for real competitors in this specific market. Find 4-6 actual businesses with names, pricing, weaknesses, and strengths. Then identify the specific gap this person could fill." },
    { id:"legal",     icon:"⚖️", label:"What legal setup do I need",  auto:true,  prompt:"Based on their specific business idea and UK context, identify exactly what legal and administrative setup they need. Cover business structure, HMRC registration, specific insurances, key contracts, and licencing." },
    { id:"financials",icon:"📊", label:"Model my financials",         auto:false, inputLabel:"What's your intended pricing and how many customers do you expect in month 1?", prompt:"Build a realistic 12-month financial projection. Show conservative and optimistic scenarios with monthly targets and break-even point." },
    { id:"marketing", icon:"📣", label:"Create my marketing strategy", auto:true, prompt:"Create a specific marketing strategy. Write a one-sentence positioning statement. Describe the ideal customer profile in detail. Identify the top 3 acquisition channels that work for this specific business type. Give a 90-day marketing calendar with weekly specific actions." },
  ],
  grow: [
    { id:"audit",     icon:"🔍", label:"Audit what I have",           auto:true,  prompt:"Based on their business description, identify what is working, what isn't, and where the biggest growth lever is. Be specific and direct." },
    { id:"customers", icon:"👥", label:"Find more customers",         auto:true,  prompt:"Identify the top 3 channels for acquiring more customers for this specific business. Give specific actionable steps for each, not generic advice." },
    { id:"pricing",   icon:"💷", label:"Review my pricing",           auto:true,  prompt:"Research comparable pricing in their market. Assess whether they're under or over priced. Recommend a specific pricing strategy with the numbers." },
    { id:"positioning",icon:"🎯",label:"Sharpen my positioning",      auto:true,  prompt:"Write a new positioning statement and ideal customer profile. Identify who they should stop selling to and who they should focus on." },
  ],
  side: [
    { id:"idea",      icon:"💡", label:"Validate my idea",            auto:true,  prompt:"Assess the viability of this side hustle idea. Research if there's a market, who the competition is, and what a realistic first month of income looks like." },
    { id:"start",     icon:"🚀", label:"How to start without quitting",auto:true, prompt:"Build a realistic plan for starting this side hustle around a full-time job. Be specific about time requirements, what to do in the first 30 days, and how to avoid burnout." },
    { id:"income",    icon:"💷", label:"How fast can I earn",         auto:true,  prompt:"Research realistic income timelines for this type of side hustle. What does month 1, 3, and 6 look like? What are the fastest ways to get first paying customers?" },
  ],
  housing: [
    { id:"rights",    icon:"⚖️", label:"Check my rights",             auto:true,  prompt:"Search GOV.UK for the specific rights that apply to this housing situation. Be precise about what the landlord must do and what the tenant can do." },
    { id:"document",  icon:"📄", label:"Analyse my tenancy document", auto:false, inputLabel:"Paste your tenancy agreement or the letter you received", prompt:"Read this document and identify every illegal clause, unusual term, and flag worth raising. Explain each in plain English with the specific legislation." },
    { id:"letter",    icon:"✉️", label:"Draft a formal letter",       auto:false, inputLabel:"What do you want to achieve with this letter?", prompt:"Draft a formal legal letter citing specific housing legislation. Make it professional and legally precise." },
  ],
  finance: [
    { id:"benefits",  icon:"💷", label:"Find my entitlements",        auto:true,  prompt:"Search GOV.UK for every benefit and entitlement this person may be eligible for. Provide specific amounts and application links." },
    { id:"budget",    icon:"📊", label:"Build my budget",             auto:false, inputLabel:"Tell me your monthly income and main expenses", prompt:"Build a realistic monthly budget from their income and outgoings. Identify where money is going and where to save." },
    { id:"debt",      icon:"📉", label:"Plan my debt repayment",      auto:false, inputLabel:"List your debts with amounts and interest rates", prompt:"Prioritise the debts by interest rate and urgency. Build a clear repayment roadmap with a realistic end date." },
  ],
  health: [
    { id:"letter",    icon:"📋", label:"Explain my medical letter",   auto:false, inputLabel:"Paste the medical letter or describe the diagnosis", prompt:"Translate every term in this medical letter into plain English with clear next steps." },
    { id:"rights",    icon:"⚖️", label:"Know my NHS rights",          auto:true,  prompt:"Search for NHS patient rights that apply to their specific situation. Be precise and practical." },
    { id:"services",  icon:"🏥", label:"Find local services",         auto:false, inputLabel:"What's your postcode or area?", prompt:"Find the nearest relevant NHS services, specialists, and support groups for their situation." },
  ],
  tech: [
    { id:"jobs",      icon:"💻", label:"Find tech roles",             auto:true,  prompt:"Search LinkedIn, Indeed, Stack Overflow Jobs, and Wellfound for real current tech listings matching their profile. Mix of companies, scale-ups, and remote roles." },
    { id:"salary",    icon:"💷", label:"Research tech salaries",      auto:true,  prompt:"Search for real 2025-2026 UK tech salary data from Glassdoor, Levels.fyi, and LinkedIn for their specific role and stack." },
    { id:"learning",  icon:"📚", label:"Build my learning roadmap",   auto:true,  prompt:"Identify the skills needed for their target role and build a 12-week learning plan with free resources first." },
    { id:"interview", icon:"🎯", label:"Prep for technical interviews", auto:false, inputLabel:"Which company and role are you preparing for?", prompt:"Research what this company actually asks. Provide coding challenges, system design questions, and behavioural prep." },
  ],
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const INTEL_KEY="aiveree_intel_v5",PROJECT_KEY="aiveree_projects_v5",CREDITS_KEY="aiveree_credits_v5",FREE_CREDITS=5;
const gl=k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch{return null}};
const sl=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const getLocalIntel=()=>gl(INTEL_KEY);
const saveLocalIntel=d=>sl(INTEL_KEY,d);
const getProjects=()=>gl(PROJECT_KEY)||[];
const saveProjects=p=>sl(PROJECT_KEY,p);
const getCredits=()=>{try{const v=localStorage.getItem(CREDITS_KEY);return v!==null?parseInt(v):FREE_CREDITS}catch{return FREE_CREDITS}};
const saveCredits=n=>{try{localStorage.setItem(CREDITS_KEY,String(n))}catch{}};

// ─── UTILS ────────────────────────────────────────────────────────────────────
function useIsMobile(){
  const[m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{const h=()=>setM(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h)},[]);
  return m;
}

function MD({text,dark}){
  if(!text)return null;
  const col=dark?"rgba(255,255,255,0.85)":"#333";
  return<div>{text.split(/\n\n+/).filter(Boolean).map((para,pi,arr)=>(
    <p key={pi} style={{margin:0,marginBottom:pi<arr.length-1?14:0,lineHeight:1.85,fontSize:14,fontFamily:"Inter,sans-serif",fontWeight:300,color:col}}>
      {para.split(/(\*\*[^*\n]+\*\*)/).map((p,i)=>
        p.startsWith("**")&&p.endsWith("**")?<strong key={i} style={{fontWeight:600,color:dark?"#fff":"#000"}}>{p.slice(2,-2)}</strong>
        :p.split(/\n/).map((line,li,a)=><span key={`${i}-${li}`}>{line}{li<a.length-1&&<br/>}</span>)
      )}
    </p>
  ))}</div>;
}

// ─── TTS HOOK ─────────────────────────────────────────────────────────────────
function useTTS(){
  const[muted,setMuted]=useState(false);
  const audioRef=useRef(null);

  const speak=useCallback(async(text,priority=false)=>{
    if(muted||!text)return;
    try{
      // Stop current audio if priority (new message)
      if(priority&&audioRef.current){audioRef.current.pause();}
      const clean=text.replace(/\*\*/g,"").replace(/→/g,"").replace(/\n\n/g," ").trim().slice(0,600);
      const res=await apiFetch("/.netlify/functions/elevenlabs-tts",{text:clean});
      if(!res.ok)return;
      const{audio,mimeType}=await res.json();
      if(!audio)return;
      const blob=new Blob([Uint8Array.from(atob(audio),c=>c.charCodeAt(0))],{type:mimeType});
      const url=URL.createObjectURL(blob);
      if(audioRef.current&&!priority){audioRef.current.pause();URL.revokeObjectURL(audioRef.current.src);}
      const a=new Audio(url);
      audioRef.current=a;
      // Register with global ref so page changes can stop it
      if(window.globalAudioRef){window.globalAudioRef.current=a;}
      a.play().catch(()=>{});
      a.onended=()=>URL.revokeObjectURL(url);
    }catch{}
  },[muted]);

  const stop=()=>{if(audioRef.current)audioRef.current.pause();};
  return{speak,stop,muted,toggleMute:()=>setMuted(m=>!m)};
}

// ─── VOICE INPUT HOOK ─────────────────────────────────────────────────────────
function useVoiceInput(onResult){
  const[listening,setListening]=useState(false);
  const[interim,setInterim]=useState("");
  const recRef=useRef(null);
  const supported=typeof window!=="undefined"&&("SpeechRecognition" in window||"webkitSpeechRecognition" in window);

  const start=useCallback(()=>{
    if(!supported||listening)return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const rec=new SR();
    rec.continuous=false;
    rec.interimResults=true;
    rec.lang="en-GB";
    rec.onstart=()=>setListening(true);
    rec.onresult=(e)=>{
      let final="",inter="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal)final+=e.results[i][0].transcript;
        else inter+=e.results[i][0].transcript;
      }
      setInterim(inter);
      if(final){setInterim("");setListening(false);onResult(final.trim());}
    };
    rec.onerror=()=>{setListening(false);setInterim("");};
    rec.onend=()=>{setListening(false);setInterim("");};
    recRef.current=rec;
    rec.start();
  },[listening,onResult,supported]);

  const stop=useCallback(()=>{
    recRef.current?.stop();
    setListening(false);setInterim("");
  },[]);

  return{listening,interim,start,stop,supported};
}

// ─── ONBOARDING PROMPT ────────────────────────────────────────────────────────
const ONBOARDING_PROMPT=`You are Aiveree. One entity. Warm, direct, genuinely curious. You speak like a brilliant friend who gets things done. Short sentences. No jargon. Never corporate.

You have a team of specialists working for you. You brief them, they do the work, you deliver results.

Understand what this person is working toward — 2-3 exchanges is enough. Ask one question at a time. Maximum 2-3 sentences per response.

When you have enough to work with, tell them you're putting their team together. End with exactly: [ONBOARDING_COMPLETE]

Never mention specific tool names, agents, or platform features. You are simply Aiveree.`;

const DOMAIN_PROMPT=`You are Aiveree — a warm, direct, action-oriented AI with a specialist team working for you. You speak like a brilliant friend who gets things done.

Domain: {DOMAIN}. User goal: {GOAL}

BEHAVIOUR RULES:
1. When the user asks you to do something — DO IT immediately and confirm what you did. "Done. My team has found X for you. Here's what we got:" then deliver the output.
2. When something is unclear — ask ONE specific clarifying question before proceeding. "Before I do that — quick question: [specific question]?"
3. Proactively suggest improvements. After delivering results say "One thing I'd also suggest:" or "While my team was on this, they noticed:"
4. When the user gives vague instructions — make a smart assumption, do the task, and confirm your assumption. "I've assumed you mean X — here's what we found. Tell me if you meant something different."
5. Never just describe what you could do. Do it. Deliver the result in the same message.
6. Keep conversational responses to 2-3 sentences. For task outputs, be as detailed as needed.
7. Always end with a specific suggested next action. "Next, want me to [specific thing]?"

LANGUAGE:
- "I've had my team on this" / "my specialist found" / "leave that with me"
- Never say "I'm just an AI" or "I can't"
- Always speak as if work is already being done on their behalf`;

// ─── CLASSIFY GOAL ────────────────────────────────────────────────────────────
function classifyGoal(msgs,selectedDomain){
  if(selectedDomain)return selectedDomain;
  const text=msgs.filter(m=>m.role==="user").map(m=>m.content).join(" ").toLowerCase();
  if(text.match(/youtube|channel|tiktok|instagram|content|subscriber|views|social media|influencer|creator|video|podcast/))return"business";
  if(text.match(/start|launch|found|startup|entrepreneur|side hustle|freelance|self.employ|my own/))return"business";
  if(text.match(/grow|scale|more customer|revenue|profit|existing business/))return"grow";
  if(text.match(/job|career|role|salary|cv|resume|interview|promotion|redundan|fired|new job/))return"career";
  if(text.match(/house|rent|landlord|tenant|flat|evict|deposit|housing|section 21/))return"housing";
  if(text.match(/money|debt|budget|savings|benefits|tax|pension|broke|credit/))return"finance";
  if(text.match(/health|nhs|doctor|hospital|diagnosis|medication|carer/))return"health";
  if(text.match(/tech|coding|developer|software|programming|engineer|data/))return"tech";
  return"business";
}

// ─── DOMAIN LABEL ─────────────────────────────────────────────────────────────
function getDomainLabel(id){return DOMAINS.find(d=>d.id===id)?.label||id;}
function getDomainColor(id){return DOMAINS.find(d=>d.id===id)?.color||"#5b21b6";}
function getDomainEmoji(id){return DOMAINS.find(d=>d.id===id)?.emoji||"✨";}

// ─── HOMEPAGE ─────────────────────────────────────────────────────────────────
function Homepage({onStart,mobile}){
  const live=DOMAINS.filter(d=>d.live);
  const coming=DOMAINS.filter(d=>!d.live);

  const COMPARE=[
    {tool:"ChatGPT",price:"£16/mo",desc:"Powerful when you ask. Silent when you don't. Forgets everything when you close the tab.",badge:"Reactive"},
    {tool:"Lindy",price:"£40/mo",desc:"Email and calendar automation for corporate teams. Technical to set up. No goal intelligence.",badge:"Admin only"},
    {tool:"Aiveree",price:"From £10/mo",desc:"Knows your goal. Works while you're away. Reaches out when you go quiet. Builds your plan.",badge:"✦ You",highlight:true},
  ];

  const PROOF=[
    {q:"She found me 11 job matches overnight without me asking. I woke up to results.",n:"Career changer, Leeds"},
    {q:"Had a business plan draft waiting before I'd even had my coffee. Genuinely different.",n:"First-time founder, Manchester"},
    {q:"The WhatsApp check-in made me come back when I would have quietly given up.",n:"Freelancer, London"},
  ];

  return(
    <div style={{background:"#fafaf8",minHeight:"100vh",fontFamily:"'Syne',Inter,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap');`}</style>

      {/* ── HERO ── */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:mobile?"96px 20px 0":"136px 52px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:mobile?36:64,alignItems:"center"}}>

          {/* Left — copy */}
          <div>
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"#f0edff",border:"1px solid #d4caff",borderRadius:20,padding:"5px 13px",marginBottom:24}}>
              <div style={{width:5,height:5,borderRadius:3,background:"#6d28d9"}}/>
              <span style={{fontFamily:"'Poppins',sans-serif",fontSize:10,fontWeight:600,color:"#6d28d9",letterSpacing:1,textTransform:"uppercase"}}>Your AI executive assistant</span>
            </div>
            <h1 style={{fontFamily:"'Poppins',sans-serif",fontSize:mobile?"clamp(32px,8vw,46px)":"clamp(40px,4.5vw,58px)",fontWeight:700,lineHeight:1.08,letterSpacing:"0px",color:"#0a0a0a",marginBottom:20}}>
              Bring the<br/>ambition.<br/>
              <span style={{WebkitTextFillColor:"transparent",WebkitTextStroke:"2px #5b21b6",fontWeight:700}}>We'll build</span><br/>
              <span style={{color:"#5b21b6"}}>the team.</span>
            </h1>
            <p style={{fontSize:mobile?14:16,color:"#555",lineHeight:1.85,fontWeight:400,marginBottom:10,fontFamily:"Inter,sans-serif",maxWidth:420}}>
              Tell Aiveree your goal. She briefs her specialist team and they get to work — on your career, your business, whatever's in the way.
            </p>
            <p style={{fontSize:12,color:"#aaa",lineHeight:1.7,fontFamily:"Inter,sans-serif",marginBottom:28,maxWidth:380}}>
              Unlike ChatGPT, she doesn't wait. Unlike Lindy, she knows what you're building. Unlike anything else, she reaches out when you go quiet.
            </p>
            <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
              <button onClick={()=>onStart(null)} style={{background:"#0a0a0a",border:"none",borderRadius:9999,padding:mobile?"12px 24px":"13px 30px",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:14,fontFamily:"'Poppins',sans-serif",letterSpacing:0.3}}>Tell Aiveree your goal →</button>
              <button onClick={()=>document.getElementById("video")?.scrollIntoView({behavior:"smooth"})} style={{background:"transparent",border:"1px solid #ddd",borderRadius:9999,padding:mobile?"12px 24px":"13px 30px",color:"#444",fontWeight:400,cursor:"pointer",fontSize:14,fontFamily:"Inter,sans-serif"}}>Watch how it works</button>
            </div>
            <p style={{fontSize:10,color:"#ccc",marginTop:12,fontFamily:"Inter,sans-serif"}}>Free to start · No credit card · 5 tasks included</p>
          </div>

          {/* Right — product preview */}
          {!mobile&&(
            <div style={{position:"relative"}}>
              <div style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:20,padding:20,boxShadow:"0 24px 80px rgba(0,0,0,0.08)",overflow:"hidden"}}>
                {/* Mini dashboard header */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:12,borderBottom:"1px solid #f5f5f5"}}>
                  <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700,fontFamily:"'Poppins',sans-serif"}}>Ai</div>
                  <div>
                    <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:12,color:"#000"}}>Aiveree</div>
                    <div style={{fontSize:9,color:"#22c55e",display:"flex",alignItems:"center",gap:3}}><div style={{width:4,height:4,borderRadius:2,background:"#22c55e"}}/>Online · Business workspace</div>
                  </div>
                  <div style={{marginLeft:"auto",fontSize:9,color:"#bbb",background:"#f9f9f9",padding:"2px 8px",borderRadius:10,fontFamily:"Inter,sans-serif"}}>5 tasks left</div>
                </div>
                {/* Aiveree message */}
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <div style={{width:24,height:24,borderRadius:6,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>Ai</div>
                  <div style={{background:"#f7f7f7",borderRadius:"12px 12px 12px 2px",padding:"10px 12px",fontSize:12,color:"#333",lineHeight:1.65,fontFamily:"Inter,sans-serif",maxWidth:260}}>
                    Morning. I've had my team working since you signed up. <strong style={{color:"#000"}}>11 job matches found</strong>, your business plan is drafted, and your market research is ready. Want me to walk you through it?
                  </div>
                </div>
                {/* Task cards */}
                {[
                  {icon:"🔍",label:"Job search",status:"Complete",color:"#22c55e",note:"11 matches found overnight"},
                  {icon:"📋",label:"Business plan",status:"Ready for review",color:"#5b21b6",note:"Tap to read"},
                  {icon:"📊",label:"Market research",status:"In progress",color:"#f59e0b",note:"3 competitors mapped"},
                ].map((t,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"#fafafa",borderRadius:9,marginBottom:6,border:"1px solid #f0f0f0"}}>
                    <span style={{fontSize:14}}>{t.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"Inter,sans-serif",fontWeight:500,fontSize:11,color:"#000"}}>{t.label}</div>
                      <div style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:10,color:"#888"}}>{t.note}</div>
                    </div>
                    <div style={{fontSize:9,color:t.color,background:`${t.color}12`,padding:"2px 7px",borderRadius:10,fontFamily:"Inter,sans-serif",fontWeight:500,whiteSpace:"nowrap"}}>{t.status}</div>
                  </div>
                ))}
                {/* WhatsApp preview */}
                <div style={{marginTop:10,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:9,padding:"8px 10px",display:"flex",gap:8,alignItems:"flex-start"}}>
                  <span style={{fontSize:12}}>💬</span>
                  <div>
                    <div style={{fontFamily:"Inter,sans-serif",fontSize:9,color:"#16a34a",fontWeight:600,marginBottom:2}}>WhatsApp · Just now</div>
                    <div style={{fontFamily:"Inter,sans-serif",fontSize:10,color:"#555",lineHeight:1.5}}>"I noticed you haven't been back in 3 days. Your team found something worth seeing."</div>
                  </div>
                </div>
              </div>
              {/* Floating badge */}
              <div style={{position:"absolute",top:-14,right:-14,background:"#5b21b6",color:"#fff",borderRadius:20,padding:"5px 12px",fontSize:10,fontFamily:"'Poppins',sans-serif",fontWeight:600,letterSpacing:0.5,boxShadow:"0 8px 24px rgba(91,33,182,0.3)"}}>Working while you sleep ✦</div>
            </div>
          )}
        </div>
      </div>

      {/* ── SOCIAL PROOF ── */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:mobile?"40px 20px":"52px 52px 0"}}>
        <p style={{textAlign:"center",fontSize:10,color:"#ccc",fontFamily:"Inter,sans-serif",letterSpacing:1.5,textTransform:"uppercase",marginBottom:20}}>What people are saying</p>
        <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr 1fr",gap:10}}>
          {PROOF.map((p,i)=>(
            <div key={i} style={{background:"#fff",border:"1px solid #efefef",borderRadius:14,padding:"18px 20px"}}>
              <p style={{fontFamily:"Inter,sans-serif",fontSize:13,color:"#222",lineHeight:1.75,marginBottom:12,fontWeight:300,fontStyle:"italic"}}>"{p.q}"</p>
              <p style={{fontFamily:"'Poppins',sans-serif",fontSize:11,color:"#aaa",fontWeight:500}}>— {p.n}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── VIDEO SECTION ── */}
      <div id="video" style={{maxWidth:1100,margin:"0 auto",padding:mobile?"52px 20px":"72px 52px"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <h2 style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:mobile?24:36,color:"#0a0a0a",marginBottom:8,letterSpacing:-0.5}}>See Aiveree in action</h2>
          <p style={{fontFamily:"Inter,sans-serif",fontSize:14,color:"#888",fontWeight:300,maxWidth:420,margin:"0 auto"}}>60 seconds. Your goal in. Results out. A team that keeps working.</p>
        </div>
        <div style={{background:"#0a0a0a",borderRadius:20,overflow:"hidden",aspectRatio:"16/9",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 32px 80px rgba(0,0,0,0.15)"}}>
          {/* Placeholder — replace src with YouTube/Vimeo embed URL when video is ready */}
          <div style={{textAlign:"center",padding:40}}>
            <div style={{width:64,height:64,borderRadius:32,background:"rgba(255,255,255,0.1)",border:"2px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}>
              <div style={{width:0,height:0,borderTop:"12px solid transparent",borderBottom:"12px solid transparent",borderLeft:"20px solid white",marginLeft:4}}/>
            </div>
            <p style={{fontFamily:"'Poppins',sans-serif",fontSize:14,color:"rgba(255,255,255,0.6)",fontWeight:500}}>Video coming soon</p>
            <p style={{fontFamily:"Inter,sans-serif",fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:4}}>Add your YouTube/Vimeo embed URL here once ready</p>
          </div>
          {/* Background gradient */}
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 50%, rgba(91,33,182,0.3) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(167,139,250,0.15) 0%, transparent 60%)",pointerEvents:"none"}}/>
        </div>
        <div style={{textAlign:"center",marginTop:16}}>
          <button onClick={()=>onStart(null)} style={{background:"#5b21b6",border:"none",borderRadius:9999,padding:"11px 28px",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"'Poppins',sans-serif"}}>Start for free →</button>
        </div>
      </div>

      {/* ── COMPARISON ── */}
      <div style={{background:"#0a0a0a",padding:mobile?"52px 20px":"72px 52px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:36}}>
            <h2 style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:mobile?24:32,color:"#fff",marginBottom:8,letterSpacing:-0.3}}>How Aiveree compares</h2>
            <p style={{fontFamily:"Inter,sans-serif",fontSize:13,color:"rgba(255,255,255,0.4)",fontWeight:300}}>The tools you know vs the one you've been waiting for.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr 1fr",gap:12}}>
            {COMPARE.map((c,i)=>(
              <div key={i} style={{background:c.highlight?"linear-gradient(145deg,#5b21b6,#3b0f8c)":"rgba(255,255,255,0.04)",border:`1px solid ${c.highlight?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.08)"}`,borderRadius:16,padding:mobile?"20px":"24px 26px",position:"relative",overflow:"hidden"}}>
                {c.highlight&&<div style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,0.2)",borderRadius:10,padding:"2px 8px",fontSize:9,color:"#fff",fontFamily:"'Poppins',sans-serif",fontWeight:600,letterSpacing:0.5}}>RECOMMENDED</div>}
                <div style={{fontSize:10,fontFamily:"'Poppins',sans-serif",fontWeight:600,letterSpacing:1,textTransform:"uppercase",color:c.highlight?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.3)",marginBottom:8}}>{c.badge}</div>
                <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:20,color:"#fff",marginBottom:4}}>{c.tool}</div>
                <div style={{fontFamily:"Inter,sans-serif",fontWeight:400,fontSize:16,color:c.highlight?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.35)",marginBottom:12}}>{c.price}</div>
                <p style={{fontFamily:"Inter,sans-serif",fontSize:13,color:c.highlight?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.4)",lineHeight:1.75,fontWeight:300,margin:0}}>{c.desc}</p>
                {c.highlight&&(
                  <button onClick={()=>onStart(null)} style={{marginTop:20,width:"100%",background:"#fff",border:"none",borderRadius:9999,padding:"11px",color:"#5b21b6",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"'Poppins',sans-serif"}}>Get started free →</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHAT ARE YOU WORKING TOWARD ── */}
      <div style={{padding:mobile?"52px 20px":"72px 52px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <h2 style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:mobile?24:32,color:"#0a0a0a",marginBottom:8,letterSpacing:-0.3}}>What are you working toward?</h2>
            <p style={{fontFamily:"Inter,sans-serif",fontSize:13,color:"#aaa",fontWeight:300}}>Tell Aiveree and she'll build a team around it.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            {live.map(d=>(
              <button key={d.id} onClick={()=>onStart(d.id)}
                style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:14,padding:mobile?"14px 12px":"18px 16px",cursor:"pointer",textAlign:"left",fontFamily:"Inter,sans-serif",transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=d.color;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 24px ${d.color}20`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#e8e8e8";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
                <div style={{fontSize:mobile?20:24,marginBottom:8}}>{d.emoji}</div>
                <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:mobile?12:13,color:"#000",marginBottom:4}}>{d.label}</div>
                <div style={{fontWeight:300,fontSize:11,color:"#999",lineHeight:1.5,fontFamily:"Inter,sans-serif"}}>{d.desc}</div>
              </button>
            ))}
          </div>
          <div style={{marginTop:10,display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:10}}>
            {coming.map(d=>(
              <div key={d.id} style={{background:"#fafafa",border:"1px dashed #efefef",borderRadius:14,padding:mobile?"14px 12px":"18px 16px",textAlign:"left",opacity:0.6}}>
                <div style={{fontSize:mobile?20:24,marginBottom:8}}>{d.emoji}</div>
                <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:mobile?12:13,color:"#555",marginBottom:4}}>{d.label}</div>
                <div style={{fontWeight:300,fontSize:10,color:"#bbb",fontFamily:"Inter,sans-serif"}}>Coming soon</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div id="how" style={{background:"#f5f3ff",padding:mobile?"52px 20px":"72px 52px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <h2 style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:mobile?24:32,color:"#0a0a0a",marginBottom:8,letterSpacing:-0.3}}>How Aiveree works</h2>
            <p style={{fontFamily:"Inter,sans-serif",fontSize:13,color:"#888",fontWeight:300}}>She's not a chatbot. She has a team.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr 1fr",gap:16}}>
            {[
              {n:"01",t:"Tell Aiveree your goal",d:"Have a quick conversation. Tell us what you're building, where you're headed, or what's in your way. No forms. Just talk."},
              {n:"02",t:"She briefs her team",d:"Aiveree configures a specialist team around your exact situation. She briefs them, manages them, and holds them accountable. You do nothing."},
              {n:"03",t:"Results come to you",d:"Jobs found. Plans built. Markets researched. She reaches out via WhatsApp when something needs your attention. Real work. Done."},
            ].map((s,i)=>(
              <div key={i} style={{background:"#fff",border:"1px solid #e0d9ff",borderRadius:16,padding:mobile?"20px":"26px 28px",position:"relative"}}>
                <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:800,fontSize:52,color:"#f0edff",lineHeight:1,marginBottom:16,letterSpacing:-2}}>{s.n}</div>
                <h3 style={{fontFamily:"'Poppins',sans-serif",fontWeight:600,fontSize:15,color:"#0a0a0a",marginBottom:8}}>{s.t}</h3>
                <p style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:13,color:"#777",lineHeight:1.75,margin:0}}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{borderTop:"1px solid #efefef",padding:mobile?"20px":"20px 52px",display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:1100,margin:"0 auto",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:24,height:24,borderRadius:7,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:10,color:"#fff",fontFamily:"'Poppins',sans-serif"}}>Ai</div>
          <span style={{fontFamily:"'Poppins',sans-serif",fontSize:12,color:"#999",fontWeight:500}}>Aiveree</span>
        </div>
        <span style={{fontFamily:"Inter,sans-serif",fontSize:11,color:"#ccc",fontWeight:300}}>© 2026 Aiveree · For career builders and entrepreneurs</span>
      </div>
    </div>
  );
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({onAuth,prefilledIntel,mobile}){
  const[mode,setMode]=useState("signup");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[name,setName]=useState("");
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const is={padding:"12px 14px",background:"#fafafa",border:"1px solid #e8e8e8",borderRadius:10,color:"#000",fontSize:13,outline:"none",fontFamily:"Inter,sans-serif",width:"100%",fontWeight:300};
  const domColor=getDomainColor(prefilledIntel?.domain_id||"career");

  const submit=async()=>{
    if(!email||!password){setError("Please fill in all fields.");return;}
    if(mode==="signup"&&!name){setError("Please enter your name.");return;}
    setLoading(true);setError("");
    try{
      const data = mode==="signup"
        ? await signUpUser({name,email,password})
        : await signInUser({email,password});
      const authUser = data.user;
      if(!authUser?.id){
        setError(mode==="signup"?"Check your email to confirm your account, then sign in.":"Could not sign in.");
        setLoading(false);return;
      }
      const user={ id:authUser.id, email:authUser.email||email, name:(name||authUser.user_metadata?.name||email.split("@")[0]) };
      const intel={...prefilledIntel,name:user.name,onboarding_complete:true};
      saveLocalIntel(intel);saveCredits(FREE_CREDITS);
      onAuth(user,intel);
    }catch(err){
      setError(err.message||"Authentication failed.");
    }finally{ setLoading(false); }
  };

  const oauth=async(p)=>{
    setLoading(true);setError("");
    try{ await startOAuth(p); }
    catch(err){ setError(err.message||"Could not start sign-in."); setLoading(false); }
  };

  return(
    <div style={{minHeight:"100vh",background:"#fdfdfd",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:14,color:"#fff",marginBottom:16,fontFamily:"Inter,sans-serif"}}>Ai</div>
          <h2 style={{fontFamily:"Inter,sans-serif",fontSize:22,fontWeight:300,color:"#000",marginBottom:6,letterSpacing:-0.3}}>{mode==="signup"?"Your team is ready.":"Welcome back."}</h2>
          <p style={{color:"#aaa",fontSize:13,fontWeight:300,fontFamily:"Inter,sans-serif"}}>{mode==="signup"?"Create your free account. 5 tasks included.":"Sign in to continue."}</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {[{p:"Google",icon:"G"},{p:"Apple",icon:"🍎"},{p:"Microsoft",icon:"⊞"}].map(({p,icon})=>(
            <button key={p} onClick={()=>oauth(p)} disabled={loading} style={{width:"100%",padding:"12px",background:"#fff",border:"1px solid #e8e8e8",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontWeight:300,fontSize:13,color:"#000",cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1,fontFamily:"Inter,sans-serif"}}>
              <span style={{fontSize:16}}>{icon}</span>Continue with {p}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{flex:1,height:1,background:"#efefef"}}/><span style={{color:"#ccc",fontSize:12,fontFamily:"Inter,sans-serif"}}>or</span><div style={{flex:1,height:1,background:"#efefef"}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={is} onFocus={e=>e.target.style.borderColor=domColor} onBlur={e=>e.target.style.borderColor="#e8e8e8"}/>}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" style={is} onFocus={e=>e.target.style.borderColor=domColor} onBlur={e=>e.target.style.borderColor="#e8e8e8"}/>
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={e=>e.key==="Enter"&&submit()} style={is} onFocus={e=>e.target.style.borderColor=domColor} onBlur={e=>e.target.style.borderColor="#e8e8e8"}/>
          {error&&<div style={{color:"#dc2626",fontSize:12,fontFamily:"Inter,sans-serif"}}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{padding:"12px",background:"#000",border:"none",borderRadius:9999,color:"#fff",fontWeight:500,fontSize:13,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,fontFamily:"Inter,sans-serif"}}>
            {loading?"Setting up your workspace...":mode==="signup"?"Create free account":"Sign in"}
          </button>
        </div>
        <div style={{textAlign:"center",marginTop:14}}>
          <span style={{color:"#bbb",fontSize:12,fontFamily:"Inter,sans-serif"}}>{mode==="signup"?"Already have an account? ":"Don't have an account? "}
            <button onClick={()=>setMode(mode==="signup"?"login":"signup")} style={{background:"none",border:"none",color:"#5b21b6",cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:"Inter,sans-serif"}}>{mode==="signup"?"Log in":"Sign up free"}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({selectedDomain,onComplete,mobile}){
  const domInfo=DOMAINS.find(d=>d.id===selectedDomain);
  const initMsg=selectedDomain
    ?`Hey — I'm Aiveree. You want to work on ${domInfo?.label?.toLowerCase()}. Tell me more about your specific situation — what are you starting from and what does success look like for you?`
    :"Hey — I'm Aiveree. What are you working toward right now? Tell me what's on your mind.";

  const[msgs,setMsgs]=useState([{role:"assistant",content:initMsg}]);
  const[inp,setInp]=useState("");
  const[busy,setBusy]=useState(false);
  const[complete,setComplete]=useState(false);
  const[pending,setPending]=useState(null);
  const[assembling,setAssembling]=useState(false);
  const ref=useRef(null);
  const{speak,muted,toggleMute}=useTTS();

  const OPTS=[[
    {emoji:"💼",text:"I want a better job or a career change"},
    {emoji:"🚀",text:"I want to start a business or side hustle"},
    {emoji:"🎬",text:"I want to build a YouTube channel or brand"},
    {emoji:"🏠",text:"I have a housing or tenant issue"},
    {emoji:"💰",text:"I need to sort my finances"},
    {emoji:"💻",text:"I want to break into tech"},
  ],[
    {emoji:"⏰",text:"I don't have enough time"},
    {emoji:"💸",text:"I don't have the budget yet"},
    {emoji:"🤷",text:"I don't know where to start"},
    {emoji:"🔄",text:"I've tried before and it didn't work"},
    {emoji:"📚",text:"I need more skills or knowledge first"},
  ]];

  const uc=msgs.filter(m=>m.role==="user").length;
  const opts=!selectedDomain&&uc<OPTS.length?OPTS[uc]:[];

  useEffect(()=>{
    speak(initMsg);
  },[]);

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"})},[msgs]);

  const send=async(ot)=>{
    const text=(ot||inp).trim();
    if(!text||busy)return;
    const next=[...msgs,{role:"user",content:text}];
    setMsgs(next);setInp("");setBusy(true);
    try{
      const res=await apiFetch("/.netlify/functions/claude",{messages:next.map(m=>({role:m.role,content:m.content})),system:ONBOARDING_PROMPT},{onboarding:true});
      const data=await res.json();
      let reply=data.content?data.content.filter(b=>b.type==="text").map(b=>b.text).join(""):"Sorry, something went wrong.";
      if(reply.includes("[ONBOARDING_COMPLETE]")){
        reply=reply.replace("[ONBOARDING_COMPLETE]","").trim();
        const final=[...next,{role:"assistant",content:reply}];
        setMsgs(final);speak(reply);setBusy(false);
        setTimeout(()=>{
          setAssembling(true);
          setTimeout(()=>{
            const domainId=classifyGoal(final,selectedDomain);
            const goal=next.filter(m=>m.role==="user").map(m=>m.content).join(" | ");
            setPending({goal,domain_id:domainId,onboarding_complete:true,conversation:final,created_at:new Date().toISOString()});
            setComplete(true);setAssembling(false);
          },3000);
        },1500);
        return;
      }
      setMsgs([...next,{role:"assistant",content:reply}]);
      speak(reply);
    }catch{setMsgs([...next,{role:"assistant",content:"Something went wrong. Please try again."}]);}
    setBusy(false);
  };

  // Assembling team animation
  if(assembling){
    const domainId=classifyGoal(msgs,selectedDomain);
    const dc=getDomainColor(domainId);
    const steps=["Reading your situation carefully...","Identifying what you need...","Briefing my team on your goal...","Your team is ready."];
    return(
      <div style={{minHeight:"100vh",background:"#fdfdfd",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{maxWidth:420,width:"100%",textAlign:"center"}}>
          <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:18,color:"#fff",marginBottom:20,fontFamily:"Inter,sans-serif"}}>Ai</div>
          <h2 style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:mobile?20:26,color:"#000",marginBottom:8,letterSpacing:-0.3}}>Putting your team together.</h2>
          <p style={{color:"#aaa",fontSize:13,fontWeight:300,fontFamily:"Inter,sans-serif",marginBottom:28}}>Give me a moment.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:300,margin:"0 auto"}}>
            {steps.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",background:"#fafafa",border:"1px solid #efefef",borderRadius:10,animation:`fadeIn .4s ease ${i*.6}s both`}}>
                <div style={{width:6,height:6,borderRadius:3,background:dc,animation:`pulse 1.4s ease ${i*.3}s infinite`,flexShrink:0}}/>
                <span style={{fontSize:12,color:"#777",fontFamily:"Inter,sans-serif",fontWeight:300}}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Completion screen
  if(complete&&pending){
    const dc=getDomainColor(pending.domain_id);
    const de=getDomainEmoji(pending.domain_id);
    const dl=getDomainLabel(pending.domain_id);
    return(
      <div style={{minHeight:"100vh",background:"#fdfdfd",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{maxWidth:460,width:"100%",textAlign:"center"}}>
          <div style={{width:56,height:56,borderRadius:14,background:`${dc}15`,border:`1px solid ${dc}30`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:18}}>{de}</div>
          <h2 style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:mobile?20:26,color:"#000",marginBottom:8,letterSpacing:-0.3}}>I've got everything I need.</h2>
          <p style={{color:"#666",fontSize:14,lineHeight:1.75,marginBottom:22,fontWeight:300,fontFamily:"Inter,sans-serif"}}>
            My team is briefed and ready to work on your <strong style={{color:dc,fontWeight:500}}>{dl.toLowerCase()}</strong> goals. Create your account and I'll have your first results waiting.
          </p>
          <button onClick={()=>onComplete(pending)} style={{width:"100%",background:"#000",border:"none",borderRadius:9999,padding:13,color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:8}}>
            Create my account →
          </button>
          <p style={{color:"#ccc",fontSize:11,fontFamily:"Inter,sans-serif",fontWeight:300}}>Free · 5 tasks included · No credit card needed</p>
        </div>
      </div>
    );
  }

  const dc=domInfo?.color||"#5b21b6";

  return(
    <div style={{minHeight:"100vh",background:"#fdfdfd",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:mobile?"18px 14px":"36px 20px"}}>
      <div style={{width:"100%",maxWidth:600}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:14,color:"#fff",marginBottom:12,fontFamily:"Inter,sans-serif"}}>Ai</div>
          <h2 style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:mobile?18:24,color:"#000",letterSpacing:-0.3,marginBottom:4}}>Aiveree</h2>
          <p style={{color:"#bbb",fontSize:12,fontWeight:300,fontFamily:"Inter,sans-serif"}}>Tell me what you're working toward.</p>
        </div>

        {/* Mute button */}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button onClick={toggleMute} style={{background:"#f5f5f5",border:"1px solid #e5e5e5",borderRadius:9999,padding:"4px 12px",fontSize:11,color:"#666",cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:5}}>
            {muted?"🔇 Voice off":"🔊 Voice on"}
          </button>
        </div>

        {/* Chat */}
        <div style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:16,padding:mobile?14:20,marginBottom:10,boxShadow:"0 2px 16px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",flexDirection:"column",gap:11,maxHeight:mobile?260:340,overflowY:"auto",marginBottom:12}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
                {m.role==="assistant"&&<div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0,color:"#fff",fontWeight:600,fontFamily:"Inter,sans-serif"}}>Ai</div>}
                <div style={{maxWidth:"76%",background:m.role==="user"?"#000":"#f7f7f7",borderRadius:m.role==="user"?"16px 16px 3px 16px":"16px 16px 16px 3px",padding:"10px 13px",color:m.role==="user"?"#fff":"#000",fontSize:14,lineHeight:1.75,fontFamily:"Inter,sans-serif",fontWeight:300}}>
                  <MD text={m.content} dark={m.role==="user"}/>
                </div>
              </div>
            ))}
            {busy&&(
              <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{display:"flex",gap:2}}>{[0,1,2].map(i=><div key={i} style={{width:3,height:3,borderRadius:2,background:"#fff",animation:`pulse 1.2s ease ${i*.25}s infinite`}}/>)}</div>
                </div>
                <div style={{background:"#f7f7f7",borderRadius:"16px 16px 16px 3px",padding:"10px 13px",display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:3,background:"#ccc",animation:`pulse 1.2s ease ${i*.25}s infinite`}}/>)}</div>
              </div>
            )}
            <div ref={ref}/>
          </div>
          <div style={{borderTop:"1px solid #f0f0f0",paddingTop:11,display:"flex",gap:7}}>
            <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Type your answer..."  autoFocus
              style={{flex:1,background:"#fafafa",border:"1px solid #e8e8e8",borderRadius:9,padding:"10px 13px",fontSize:14,color:"#000",outline:"none",fontFamily:"Inter,sans-serif",fontWeight:300}}
              onFocus={e=>e.target.style.borderColor=dc} onBlur={e=>e.target.style.borderColor="#e8e8e8"}/>
            <button onClick={()=>send()} disabled={busy||!inp.trim()} style={{background:"#000",border:"none",borderRadius:9,padding:"10px 16px",color:"#fff",fontWeight:500,cursor:busy||!inp.trim()?"not-allowed":"pointer",fontSize:13,opacity:busy||!inp.trim()?0.4:1,fontFamily:"Inter,sans-serif"}}>→</button>
          </div>
        </div>

        {/* Quick options */}
        {!busy&&opts.length>0&&(
          <div>
            <div style={{fontSize:10,color:"#ccc",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8,textAlign:"center",fontFamily:"Inter,sans-serif"}}>Or pick one</div>
            <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:6}}>
              {opts.map(s=>(
                <button key={s.text} onClick={()=>send(s.text)} style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:10,padding:"10px 13px",fontSize:12,color:"#444",cursor:"pointer",textAlign:"left",lineHeight:1.55,display:"flex",gap:8,alignItems:"flex-start",fontFamily:"Inter,sans-serif",fontWeight:300}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=dc;e.currentTarget.style.background="#fafafa";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e8e8e8";e.currentTarget.style.background="#fff";}}>
                  <span style={{fontSize:14,flexShrink:0}}>{s.emoji}</span><span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CREDIT GATE ──────────────────────────────────────────────────────────────
function CreditGate({onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(8px)"}}>
      <div style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:18,padding:28,maxWidth:400,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:34,marginBottom:12}}>⚡</div>
        <h2 style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:22,color:"#000",marginBottom:7,letterSpacing:-0.3}}>Free tasks used</h2>
        <p style={{color:"#777",fontSize:13,lineHeight:1.75,marginBottom:20,fontWeight:300,fontFamily:"Inter,sans-serif"}}>Upgrade to keep your team working. Unlimited tasks from £10 a month.</p>
        <div style={{background:"#fafafa",border:"1px solid #efefef",borderRadius:10,padding:"12px 16px",marginBottom:18,textAlign:"left"}}>
          {["Unlimited tasks every month","All workspaces — Finance, Health, Tech, and more","Workspace saved across all your devices","Aiveree checks in proactively via WhatsApp"].map((f,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:i<3?8:0}}>
              <span style={{color:"#5b21b6",fontWeight:500,fontFamily:"Inter,sans-serif",fontSize:13}}>✓</span>
              <span style={{color:"#555",fontSize:12,fontWeight:300,fontFamily:"Inter,sans-serif"}}>{f}</span>
            </div>
          ))}
        </div>
        <button style={{width:"100%",background:"#000",border:"none",borderRadius:9999,padding:12,color:"#fff",fontWeight:500,fontSize:13,cursor:"pointer",marginBottom:8,fontFamily:"Inter,sans-serif"}}>Upgrade — from £10/month</button>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:12,fontFamily:"Inter,sans-serif"}}>Maybe later</button>
      </div>
    </div>
  );
}

// ─── CAPABILITY RUNNER ────────────────────────────────────────────────────────
function CapabilityRunner({cap,intel,domainColor,onClose,onCreditUsed,credits}){
  const[taskInput,setTaskInput]=useState("");
  const[output,setOutput]=useState("");
  const[loading,setLoading]=useState(false);
  const[started,setStarted]=useState(cap.auto);
  const{speak}=useTTS();

  useEffect(()=>{if(cap.auto)runTask("");},[]);

  const runTask=async(input)=>{
    if(credits<=0)return;
    setLoading(true);setOutput("");setStarted(true);
    const nc=credits-1;saveCredits(nc);onCreditUsed(nc);
    try{
      const system=DOMAIN_PROMPT.replace("{DOMAIN}",getDomainLabel(intel.domain_id)).replace("{GOAL}",intel.goal||"");
      const userPrompt=`User goal: ${intel.goal||""}\n\n${cap.prompt}${input?`\n\nAdditional context provided: ${input}`:""}`;
      const res=await apiFetch("/.netlify/functions/claude",{messages:[{role:"user",content:userPrompt}],system,useSearch:true});
      if(res.status===402){setOutput("You've used all your free tasks for now. They refresh daily.");saveCredits(0);onCreditUsed(0);setLoading(false);return;}
      const data=await res.json();
      // Reconcile with the server's authoritative balance (profiles.credits).
      if(typeof data.credits_remaining==="number"){saveCredits(data.credits_remaining);onCreditUsed(data.credits_remaining);}
      const text=data.content?data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n\n"):"";
      setOutput(text||"Something went wrong. Please try again.");
      // Speak a brief summary
      speak(`Here's what my team found for you.`);
    }catch{setOutput("Something went wrong. Please try again.");}
    setLoading(false);
  };

  return(
    <div style={{background:"#fff",border:`1px solid ${domainColor}20`,borderRadius:14,padding:16,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:18}}>{cap.icon}</span>
          <div style={{fontFamily:"Inter,sans-serif",fontWeight:500,fontSize:13,color:"#000"}}>{cap.label}</div>
        </div>
        <button onClick={onClose} style={{background:"#f5f5f5",border:"1px solid #e5e5e5",borderRadius:7,width:26,height:26,cursor:"pointer",fontSize:13,color:"#777"}}>×</button>
      </div>

      {!cap.auto&&!started&&(
        <div>
          <div style={{fontSize:12,color:"#777",marginBottom:7,fontFamily:"Inter,sans-serif",fontWeight:300}}>{cap.inputLabel}</div>
          <textarea value={taskInput} onChange={e=>setTaskInput(e.target.value)} placeholder={cap.inputLabel} rows={3}
            style={{width:"100%",background:"#fafafa",border:"1px solid #e8e8e8",borderRadius:9,padding:"10px 12px",fontSize:12,color:"#000",outline:"none",fontFamily:"Inter,sans-serif",fontWeight:300,resize:"vertical",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor=domainColor} onBlur={e=>e.target.style.borderColor="#e8e8e8"}/>
          <button onClick={()=>runTask(taskInput)} disabled={!taskInput.trim()} style={{marginTop:8,background:"#000",border:"none",borderRadius:9999,padding:"9px 20px",color:"#fff",fontWeight:500,fontSize:12,cursor:!taskInput.trim()?"not-allowed":"pointer",opacity:!taskInput.trim()?0.4:1,fontFamily:"Inter,sans-serif"}}>
            Get results →
          </button>
        </div>
      )}

      {loading&&(
        <div style={{padding:"20px 0",textAlign:"center"}}>
          <div style={{display:"flex",justifyContent:"center",gap:5,marginBottom:9}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:4,background:domainColor,animation:`pulse 1.2s ease ${i*.3}s infinite`}}/>)}</div>
          <div style={{color:"#bbb",fontSize:12,fontFamily:"Inter,sans-serif",fontWeight:300}}>My team is working on this for you...</div>
        </div>
      )}

      {!loading&&output&&(
        <div>
          <div style={{fontSize:14,color:"#333",lineHeight:1.85,fontWeight:300,fontFamily:"Inter,sans-serif"}}><MD text={output}/></div>
          <div style={{display:"flex",gap:7,marginTop:12}}>
            <button onClick={()=>navigator.clipboard.writeText(output)} style={{background:"#f5f5f5",border:"1px solid #e5e5e5",borderRadius:9999,padding:"5px 12px",fontSize:11,color:"#444",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Copy</button>
            {!cap.auto&&<button onClick={()=>{setOutput("");setStarted(false);setTaskInput("");}} style={{background:"#f5f5f5",border:"1px solid #e5e5e5",borderRadius:9999,padding:"5px 12px",fontSize:11,color:"#444",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Run again</button>}
            <button onClick={onClose} style={{background:`${domainColor}10`,border:`1px solid ${domainColor}20`,borderRadius:9999,padding:"5px 12px",fontSize:11,color:domainColor,cursor:"pointer",fontWeight:500,fontFamily:"Inter,sans-serif"}}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMMAND CENTRE ───────────────────────────────────────────────────────────
function CommandCentre({intel,user,mobile,onNewProject,credits,onCreditUsed}){
  const domainId=intel.domain_id||"business";
  const dc=getDomainColor(domainId);
  const de=getDomainEmoji(domainId);
  const dl=getDomainLabel(domainId);
  const caps=CAPABILITIES[domainId]||CAPABILITIES.business;

  const[dash,setDash]=useState(null);
  const[dashLoading,setDashLoading]=useState(false);
  const[activeCap,setActiveCap]=useState(null);
  const[showCreditGate,setShowCreditGate]=useState(false);
  const[wsState,setWsState]=useState({});// {idx:{status,result}}
  const[viewingWs,setViewingWs]=useState(null);// idx being viewed
  const wsStartedRef=useRef(false);
  const initGreet=`Hi ${user?.name||"there"}! I've read everything you shared and briefed my team. ${de} Let's get to work — tap anything below or ask me directly.`;
  const[chatMsgs,setChatMsgs]=useState([{role:"assistant",content:initGreet}]);
  const[chatInp,setChatInp]=useState("");
  const[chatBusy,setChatBusy]=useState(false);
  const chatRef=useRef(null);
  const{speak,muted,toggleMute,stop}=useTTS();

  const handleVoiceResult=useCallback((text)=>{setChatInp(text);},[]);
  const{listening,interim,start:startListening,stop:stopListening,supported:voiceSupported}=useVoiceInput(handleVoiceResult);

  const timeOfDay=new Date().getHours();
  const gr=timeOfDay<12?"Good morning":timeOfDay<17?"Good afternoon":"Good evening";

  // Speak greeting on mount
  useEffect(()=>{speak(initGreet);},[]);

  // Auto-send when voice result arrives
  useEffect(()=>{
    if(chatInp&&!chatBusy&&listening===false&&interim===""){
      // Small delay to let user see what was transcribed
    }
  },[chatInp,interim,listening]);

  // Build adaptive operational environment
  useEffect(()=>{
    if(!intel?.goal||dash||dashLoading)return;
    const ck=`dash3_${domainId}_${(intel.goal||"").slice(0,20).replace(/\W/g,"_")}`;
    const cached=sessionStorage.getItem(ck);
    if(cached){try{setDash(JSON.parse(cached));return}catch{}}
    (async()=>{
      setDashLoading(true);
      const uid=user?.id;
      // First: try to load a remembered dashboard so structure stays stable
      if(uid){
        try{
          const lr=await apiFetch("/.netlify/functions/workstreams",{action:"load_dashboard",user_id:uid,goal:intel.goal});
          const ld=await lr.json();
          if(ld.dashboard){
            setDash(ld.dashboard);
            sessionStorage.setItem(ck,JSON.stringify(ld.dashboard));
            setDashLoading(false);
            return;
          }
        }catch{}
      }
      try{
        const emphasis={
          career:"opportunities, application momentum, interview prep, salary trajectory, response tracking. Confidence rebuilding.",
          business:"validation, positioning, outreach, execution bottlenecks, momentum maintenance.",
          grow:"channels, content cadence, audience growth, conversion, consistency.",
          side:"validation, first customers, time-efficient execution, momentum despite limited hours.",
          housing:"deadlines, rights, risks, documents, legal clarity. Calmer and more protective tone.",
          finance:"clarity, prioritisation, protective framing, concrete next steps.",
          health:"sustainable habits, gentle accountability, non-judgmental tone.",
          tech:"learning path, building momentum, portfolio, practical application."
        }[domainId]||"momentum, clarity, operational support";

        const prompt=`You are Aiveree building this user's adaptive operational workspace. This is NOT a generic dashboard. It must feel like the environment reorganised itself around THEIR specific situation.

USER GOAL: ${intel.goal}
DOMAIN: ${dl}
DOMAIN EMPHASIS (surface these themes): ${emphasis}
STATUS: New user, just onboarded. This is their first session — so Active Workstreams and Quiet Progress reflect what your team has STARTED on their behalf since they signed up (you are proactive — work began immediately).

Generate ONLY valid JSON, no markdown:

{
  "momentum": {
    "headline": "A calm chief-of-staff briefing. 2 sentences. Reference their ACTUAL goal specifically. State where things stand and what is moving. Warm, composed, never hype. Like a trusted operator updating them.",
    "score": 0.5,
    "label": "Just getting started",
    "focus": "their single primary focus right now, 4-6 words"
  },
  "next_best_action": {
    "text": "ONE specific sentence. The single highest-leverage thing they could do right now, specific to their goal. Not a category — a concrete action. If something can be prepared for them, say you have already started it.",
    "cta": "short button label, 2-4 words",
    "why": "one short phrase on why this matters most right now"
  },
  "active_workstreams": [
    {"title": "short title of work in motion", "status": "in_progress", "detail": "what specifically is happening, referencing their goal", "meta": "Started just now"}
  ],
  "open_loops": [
    {"title": "a decision or input needed from them", "detail": "calm, low-pressure framing of what would help", "type": "decision"}
  ],
  "quiet_progress": [
    {"icon": "single relevant emoji", "text": "something your team has quietly done or is monitoring in the background, specific to their goal"}
  ],
  "suggested_capabilities": [
    {"id": "cap1", "label": "specific action button text", "icon": "emoji", "description": "one sentence explaining what this does for their goal"}
  ]
}

Requirements:
- 3 active_workstreams, specific to their goal and domain
- 2 open_loops, framed calmly as things that would help — never as pressure
- 3 quiet_progress items — these create the feeling that work happens even when they are away. Be specific.
- suggested_capabilities: 5 specific actions THEY SHOULD TAKE based on their goal, NOT generic domain buttons. Example: if goal is "AI governance consultancy" → ["Research target clients", "Build case studies", "Draft service offering", ...]. Make these CONCRETE and relevant.
- next_best_action is ONE action, deeply relevant. This is the most important field.
- Everything references what they ACTUALLY said. No generic filler. No hype. Calm operational tone throughout.`;

        const res=await apiFetch("/.netlify/functions/claude",{
          messages:[{role:"user",content:prompt}],
          system:"You build calm, adaptive operational workspaces for Aiveree. Return only valid JSON. The workspace must feel personally reorganised around the user's situation — not a template. Tone is composed, intelligent, operational. Never hype, never overwhelming. The Next Best Action is the centrepiece — make it one specific, behaviourally-relevant action. CRITICAL: suggested_capabilities must be 5 concrete, specific actions UNIQUE to their goal, not generic domain actions.",
          useSearch:false,
          billable:false
        });
        const data=await res.json();
        let t=data.content?data.content.filter(b=>b.type==="text").map(b=>b.text).join(""):"";
        t=t.replace(/```json|```/g,"").trim();
        const s=t.indexOf("{"),e=t.lastIndexOf("}");
        if(s!==-1&&e!==-1)t=t.slice(s,e+1);
        const p=JSON.parse(t);
        setDash(p);sessionStorage.setItem(ck,JSON.stringify(p));
        // Remember this dashboard so its structure stays stable next session
        if(uid){
          try{apiFetch("/.netlify/functions/workstreams",{action:"save_dashboard",user_id:uid,goal:intel.goal,dashboard:p});}catch{}
        }
      }catch{setDash({error:true});}
      setDashLoading(false);
    })();
  },[intel?.goal]);

  // ── REAL WORKSTREAM EXECUTION + PERSISTENCE ──
  // Once the dashboard loads, actually execute each workstream as real work,
  // and remember it so it persists across sessions.
  useEffect(()=>{
    if(!dash?.active_workstreams?.length||wsStartedRef.current)return;
    wsStartedRef.current=true;
    const uid=user?.id;
    const cacheKey=`ws_${domainId}_${(intel.goal||"").slice(0,20).replace(/\W/g,"_")}`;

    (async()=>{
      // 1. Try to load remembered work from the database first
      if(uid){
        try{
          const lr=await apiFetch("/.netlify/functions/workstreams",{action:"load",user_id:uid,goal:intel.goal});
          const ld=await lr.json();
          if(ld.workstreams?.length>0){
            const remembered={};
            ld.workstreams.forEach(w=>{remembered[w.task_index]={status:w.status,result:w.result};});
            // Only use remembered if it covers the current workstreams
            if(Object.keys(remembered).length>=dash.active_workstreams.length){
              setWsState(remembered);
              sessionStorage.setItem(cacheKey,JSON.stringify(remembered));
              return;
            }
          }
        }catch{}
      }
      // Session cache fallback
      const cached=sessionStorage.getItem(cacheKey);
      if(cached){try{const c=JSON.parse(cached);if(Object.keys(c).length>=dash.active_workstreams.length){setWsState(c);return;}}catch{}}

      // 2. No remembered work — execute fresh
      const init={};
      dash.active_workstreams.forEach((_,i)=>{init[i]={status:"in_progress"};});
      setWsState(init);
      const results={...init};
      // Execute one workstream and persist its result.
      const runOne=async(i)=>{
        const ws=dash.active_workstreams[i];
        try{
          const needsResearch=/research|track|monitor|analy|map|identif|find|scan|market|salary|compan/i.test(ws.title+" "+ws.detail);
          const execPrompt=`You are a specialist on Aiveree's team. Execute this real task and produce a concrete deliverable.

USER GOAL: ${intel.goal}
TASK: ${ws.title}
WHAT IT INVOLVES: ${ws.detail}

Do the actual work now. Produce a genuinely useful, specific deliverable — real findings, a real draft, a real analysis. Use specifics (names, numbers, concrete options) wherever possible. Format with short clear sections. This is real work the user will read and act on, not a description of what you would do. Keep it focused and high-value — around 200-350 words.`;
          const res=await apiFetch("/.netlify/functions/claude",{
            messages:[{role:"user",content:execPrompt}],
            system:"You are a specialist executing real work for a user's goal. Produce concrete, specific, genuinely useful deliverables — never descriptions of what you would do. Use real specifics. Calm, professional, operational.",
            useSearch:needsResearch,
            billable:false
          });
          const data=await res.json();
          const txt=data.content?data.content.filter(b=>b.type==="text").map(b=>b.text).join(""):"";
          results[i]={status:"complete",result:txt||"Completed."};
        }catch{
          results[i]={status:"complete",result:"I've made progress on this — open to discuss the details."};
        }
        setWsState({...results});
        sessionStorage.setItem(cacheKey,JSON.stringify(results));
        // 3. Remember this completed work in the database
        if(uid){
          try{
            apiFetch("/.netlify/functions/workstreams",{
              action:"save",user_id:uid,goal:intel.goal,task_index:i,
              title:ws.title,detail:ws.detail,status:"complete",result:results[i].result
            });
          }catch{}
        }
      };
      // Run with bounded concurrency (3 at a time) rather than serially.
      const queue=dash.active_workstreams.map((_,i)=>i);
      const workers=Array.from({length:Math.min(3,queue.length)},async()=>{
        while(queue.length){ await runOne(queue.shift()); }
      });
      await Promise.all(workers);
    })();
  },[dash]);

  const sendChat=async(ot)=>{
    const text=(ot||chatInp).trim();
    if(!text||chatBusy)return;
    if(credits<=0){setShowCreditGate(true);return;}
    stop();
    const next=[...chatMsgs,{role:"user",content:text}];
    setChatMsgs(next);setChatInp("");setChatBusy(true);

    // Speak "thinking" immediately so user knows she heard them
    const thinkingPhrases=["On it.","Got it, give me a moment.","Leave it with me.","I'm on this.","One moment."];
    speak(thinkingPhrases[Math.floor(Math.random()*thinkingPhrases.length)],true);

    const nc=credits-1;saveCredits(nc);onCreditUsed(nc);
    try{
      const system=DOMAIN_PROMPT.replace("{DOMAIN}",dl).replace("{GOAL}",intel.goal||"")
        +`\n\nUser name: ${user?.name||""}. Available capabilities: ${(caps||[]).map(c=>c.label).join(", ")}.`;
      const res=await apiFetch("/.netlify/functions/claude",{messages:next.map(m=>({role:m.role,content:m.content})),system,useSearch:true});
      if(res.status===402){setShowCreditGate(true);saveCredits(0);onCreditUsed(0);setChatBusy(false);return;}
      const data=await res.json();
      // Reconcile with the server's authoritative balance (profiles.credits).
      if(typeof data.credits_remaining==="number"){saveCredits(data.credits_remaining);onCreditUsed(data.credits_remaining);}
      const reply=data.content?data.content.filter(b=>b.type==="text").map(b=>b.text).join(""):"Something went wrong.";
      setChatMsgs([...next,{role:"assistant",content:reply}]);
      // Speak first 2 sentences as summary, rest is shown as text
      const sentences=reply.split(/(?<=[.!?])\s+/).slice(0,2).join(" ");
      speak(sentences,true);
    }catch{setChatMsgs([...next,{role:"assistant",content:"Something went wrong. Please try again."}]);}
    setChatBusy(false);
  };

  useEffect(()=>{chatRef.current?.scrollIntoView({behavior:"smooth"})},[chatMsgs]);

  if(dashLoading){
    return(
      <div style={{minHeight:"100vh",background:"#fdfdfd",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{textAlign:"center",maxWidth:420}}>
          <div style={{width:48,height:48,borderRadius:13,background:`${dc}15`,border:`1px solid ${dc}30`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16}}>{de}</div>
          <h2 style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:mobile?18:24,color:"#000",marginBottom:7}}>{gr}, {user?.name||"there"}.</h2>
          <p style={{color:"#aaa",fontSize:13,lineHeight:1.7,marginBottom:22,fontWeight:300,fontFamily:"Inter,sans-serif"}}>Setting up your workspace and getting my team started on it.</p>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxWidth:280,margin:"0 auto"}}>
            {["Reading your goal...","Briefing my team...","Starting the first workstreams...","Working out your next best move..."].map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#fafafa",border:"1px solid #efefef",borderRadius:8}}>
                <div style={{width:5,height:5,borderRadius:3,background:dc,animation:`pulse 1.5s ease ${i*.4}s infinite`}}/>
                <span style={{fontSize:12,color:"#bbb",fontFamily:"Inter,sans-serif",fontWeight:300}}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const d=dash||{};

  return(
    <div style={{minHeight:"100vh",background:"#fdfdfd"}}>
      {showCreditGate&&<CreditGate onClose={()=>setShowCreditGate(false)}/>}
      <div style={{maxWidth:1200,margin:"0 auto",padding:mobile?"18px 14px 80px":"28px 28px 60px",display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 360px",gap:22,alignItems:"start"}}>

        {/* ── MAIN ── */}
        <div>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:8}}>
            <div>
              <h1 style={{fontFamily:"Inter,sans-serif",fontSize:mobile?18:26,fontWeight:300,letterSpacing:-0.5,color:"#000",marginBottom:3}}>{gr}, {user?.name||"there"}.</h1>
              <div style={{fontSize:12,color:dc,fontFamily:"Inter,sans-serif"}}>{de} {dl} workspace</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{background:"#fafafa",border:"1px solid #efefef",borderRadius:20,padding:"3px 11px",fontSize:11,color:"#bbb",fontFamily:"Inter,sans-serif"}}>{credits} tasks left</div>
              <button onClick={onNewProject} style={{background:"#f5f5f5",border:"1px solid #e5e5e5",borderRadius:9999,padding:"6px 12px",fontSize:11,color:"#333",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ New workspace</button>
            </div>
          </div>

          {/* Goal */}
          {intel?.goal&&(
            <div style={{background:"#fff",border:"1px solid #e8e8e8",borderLeft:`2px solid ${dc}`,borderRadius:10,padding:mobile?"11px 13px":"14px 18px",marginBottom:16}}>
              <div style={{fontSize:9,fontWeight:500,color:dc,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4,fontFamily:"Inter,sans-serif"}}>Your goal</div>
              <p style={{fontSize:mobile?13:15,fontWeight:400,color:"#000",lineHeight:1.6,margin:0,fontFamily:"Inter,sans-serif"}}>{intel.goal.split(" | ")[0]}</p>
            </div>
          )}

          {/* ── 1. MOMENTUM OVERVIEW ── */}
          {d.momentum&&(
            <div style={{background:"linear-gradient(135deg,#faf9ff,#fff)",border:"1px solid #ece8fb",borderRadius:14,padding:mobile?"15px 16px":"20px 22px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:11}}>
                <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:600,fontFamily:"Inter,sans-serif"}}>Ai</div>
                <span style={{fontWeight:500,fontSize:12,color:"#000",fontFamily:"Inter,sans-serif"}}>Where things stand</span>
                {d.momentum.label&&<span style={{marginLeft:"auto",fontSize:10,color:dc,background:`${dc}12`,padding:"3px 10px",borderRadius:20,fontFamily:"Inter,sans-serif",fontWeight:500}}>{d.momentum.label}</span>}
              </div>
              <p style={{fontSize:mobile?13:14,color:"#333",lineHeight:1.8,fontWeight:300,fontFamily:"Inter,sans-serif",margin:"0 0 12px"}}>{d.momentum.headline}</p>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,height:5,background:"#efeafc",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${Math.round((d.momentum.score||0.5)*100)}%`,height:"100%",background:"linear-gradient(90deg,#5b21b6,#a78bfa)",borderRadius:3,transition:"width 1s ease"}}/>
                </div>
                {d.momentum.focus&&<span style={{fontSize:10,color:"#999",fontFamily:"Inter,sans-serif",fontWeight:300,whiteSpace:"nowrap"}}>Focus: {d.momentum.focus}</span>}
              </div>
            </div>
          )}

          {/* ── 2. NEXT BEST ACTION ── */}
          {d.next_best_action&&(
            <div style={{background:"#0a0a0a",borderRadius:14,padding:mobile?"16px 17px":"20px 22px",marginBottom:14,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,right:0,width:160,height:160,background:"radial-gradient(circle at 70% 30%, rgba(167,139,250,0.2), transparent 70%)",pointerEvents:"none"}}/>
              <div style={{fontSize:9,fontWeight:600,color:"#a78bfa",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8,fontFamily:"Inter,sans-serif"}}>Your next best move</div>
              <p style={{fontSize:mobile?15:17,color:"#fff",lineHeight:1.6,fontWeight:400,fontFamily:"Inter,sans-serif",margin:"0 0 14px"}}>{d.next_best_action.text}</p>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <button onClick={()=>sendChat(d.next_best_action.cta||"Let's do this")} style={{background:"#fff",border:"none",borderRadius:9999,padding:"10px 20px",fontSize:13,color:"#0a0a0a",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{d.next_best_action.cta||"Let's do this"} →</button>
                {d.next_best_action.why&&<span style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:"Inter,sans-serif",fontWeight:300}}>{d.next_best_action.why}</span>}
              </div>
            </div>
          )}

          {/* Active capability runner */}
          {activeCap&&<div style={{marginBottom:14}}><CapabilityRunner cap={activeCap} intel={intel} domainColor={dc} onClose={()=>setActiveCap(null)} onCreditUsed={onCreditUsed} credits={credits}/></div>}

          {/* ── 3. ACTIVE WORKSTREAMS ── */}
          {d.active_workstreams?.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:"Inter,sans-serif",fontWeight:500,fontSize:12,color:"#000",marginBottom:9,display:"flex",alignItems:"center",gap:6}}><span>⚙️</span> In motion</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {d.active_workstreams.map((w,i)=>{
                  const liveStatus=wsState[i]?.status||"in_progress";
                  const done=liveStatus==="complete";
                  const stColor=done?"#16a34a":"#d97706";
                  const stLabel=done?"Done — tap to view":"Working on it...";
                  return(
                    <div key={i} onClick={()=>{if(done)setViewingWs(i);}}
                      style={{background:"#fff",border:`1px solid ${done?"#d1fae5":"#e8e8e8"}`,borderRadius:11,padding:mobile?"12px 13px":"13px 16px",display:"flex",gap:12,alignItems:"flex-start",cursor:done?"pointer":"default",transition:"all .2s"}}
                      onMouseEnter={e=>{if(done)e.currentTarget.style.background="#f0fdf4";}}
                      onMouseLeave={e=>{if(done)e.currentTarget.style.background="#fff";}}>
                      <div style={{width:8,height:8,borderRadius:4,background:stColor,marginTop:5,flexShrink:0,animation:done?"none":"pulse 1.6s ease infinite"}}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:3}}>
                          <span style={{fontWeight:500,fontSize:12.5,color:"#000",fontFamily:"Inter,sans-serif"}}>{w.title}</span>
                          <span style={{fontSize:9.5,color:stColor,background:`${stColor}12`,padding:"2px 8px",borderRadius:20,fontFamily:"Inter,sans-serif",fontWeight:500,whiteSpace:"nowrap",flexShrink:0}}>{done?"Complete":"In progress"}</span>
                        </div>
                        <p style={{fontSize:11.5,color:"#777",lineHeight:1.6,fontWeight:300,fontFamily:"Inter,sans-serif",margin:0}}>{w.detail}</p>
                        <div style={{fontSize:10,color:done?"#16a34a":"#bbb",marginTop:5,fontFamily:"Inter,sans-serif",fontWeight:done?500:300,display:"flex",alignItems:"center",gap:4}}>{done&&<span>✓</span>}{stLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workstream result viewer */}
          {viewingWs!==null&&wsState[viewingWs]?.result&&(
            <div onClick={()=>setViewingWs(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,maxWidth:560,width:"100%",maxHeight:"82vh",overflow:"auto",padding:mobile?"20px 18px":"26px 28px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,gap:12}}>
                  <div>
                    <div style={{fontSize:9,fontWeight:600,color:"#16a34a",textTransform:"uppercase",letterSpacing:1.5,marginBottom:4,fontFamily:"Inter,sans-serif"}}>Complete</div>
                    <h3 style={{fontSize:mobile?16:18,fontWeight:600,color:"#000",margin:0,fontFamily:"Inter,sans-serif"}}>{d.active_workstreams[viewingWs].title}</h3>
                  </div>
                  <button onClick={()=>setViewingWs(null)} style={{background:"#f5f5f5",border:"none",borderRadius:8,width:30,height:30,fontSize:16,color:"#888",cursor:"pointer",flexShrink:0}}>×</button>
                </div>
                <div style={{fontSize:13,color:"#333",lineHeight:1.75,fontWeight:300,fontFamily:"Inter,sans-serif",marginTop:14}}><MD text={wsState[viewingWs].result}/></div>
                <button onClick={()=>{setViewingWs(null);sendChat(`Let's go deeper on: ${d.active_workstreams[viewingWs].title}`);}}
                  style={{marginTop:18,background:"#0a0a0a",border:"none",borderRadius:9999,padding:"11px 22px",fontSize:13,color:"#fff",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Take this further →</button>
              </div>
            </div>
          )}

          {/* ── 4. OPEN LOOPS ── */}
          {d.open_loops?.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontFamily:"Inter,sans-serif",fontWeight:500,fontSize:12,color:"#000",marginBottom:9,display:"flex",alignItems:"center",gap:6}}><span>🔵</span> Open loops <span style={{fontSize:10,color:"#bbb",fontWeight:300}}>· things I'm holding for you</span></div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {d.open_loops.map((l,i)=>(
                  <div key={i} style={{background:"#fafafa",border:"1px solid #efefef",borderRadius:11,padding:mobile?"12px 13px":"13px 16px",display:"flex",gap:11,alignItems:"flex-start",cursor:"pointer"}}
                    onClick={()=>sendChat(`Help me with: ${l.title}`)}
                    onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fafafa"}>
                    <span style={{fontSize:13,flexShrink:0,marginTop:1}}>{l.type==="approval"?"✓":l.type==="follow_up"?"↩":"◇"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:500,fontSize:12,color:"#000",fontFamily:"Inter,sans-serif",marginBottom:2}}>{l.title}</div>
                      <p style={{fontSize:11,color:"#888",lineHeight:1.55,fontWeight:300,fontFamily:"Inter,sans-serif",margin:0}}>{l.detail}</p>
                    </div>
                    <span style={{fontSize:11,color:"#ccc",flexShrink:0}}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 5. QUIET PROGRESS ── */}
          {d.quiet_progress?.length>0&&(
            <div style={{marginBottom:18,background:"#fafafa",border:"1px solid #efefef",borderRadius:12,padding:mobile?"14px 15px":"16px 18px"}}>
              <div style={{fontFamily:"Inter,sans-serif",fontWeight:500,fontSize:12,color:"#000",marginBottom:4,display:"flex",alignItems:"center",gap:6}}><span>🌙</span> Quiet progress</div>
              <p style={{fontSize:10.5,color:"#bbb",marginBottom:12,fontFamily:"Inter,sans-serif",fontWeight:300}}>What I've been doing in the background, even when you weren't here.</p>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {d.quiet_progress.map((q,i)=>(
                  <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:14,flexShrink:0}}>{q.icon||"✦"}</span>
                    <span style={{fontSize:12,color:"#666",lineHeight:1.6,fontWeight:300,fontFamily:"Inter,sans-serif"}}>{q.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CAPABILITIES (secondary) ── */}
          <div style={{borderTop:"1px solid #f0f0f0",paddingTop:16}}>
            <div style={{fontFamily:"Inter,sans-serif",fontWeight:500,fontSize:12,color:"#000",marginBottom:4,display:"flex",alignItems:"center",gap:6}}><span>🛠️</span> Put my team on something specific</div>
            <p style={{fontSize:10.5,color:"#ccc",marginBottom:11,fontFamily:"Inter,sans-serif",fontWeight:300}}>Tap anything and I'll get to work on it for your goal.</p>
            <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:7}}>
              {(d.suggested_capabilities?.length>0?d.suggested_capabilities:caps).map((cap,i)=>{
                // Handle both dashboard suggested caps and hardcoded caps
                const capIcon=cap.icon||cap.icon||"⚙️";
                const capLabel=cap.label||cap.label||"Action";
                const capId=cap.id||cap.id;
                return(
                  <button key={capId||i}
                    onClick={()=>{if(credits<=0){setShowCreditGate(true);return;}setActiveCap(activeCap?.id===capId?null:cap);}}
                    style={{background:activeCap?.id===capId?`${dc}08`:"#fff",border:`1px solid ${activeCap?.id===capId?dc+"30":"#e8e8e8"}`,borderRadius:10,padding:"11px 13px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,fontFamily:"Inter,sans-serif",transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=`${dc}40`;e.currentTarget.style.background=`${dc}06`;}}
                    onMouseLeave={e=>{if(activeCap?.id!==capId){e.currentTarget.style.borderColor="#e8e8e8";e.currentTarget.style.background="#fff";}}}>
                    <span style={{fontSize:17,flexShrink:0}}>{capIcon}</span>
                    <div style={{fontWeight:500,fontSize:11.5,color:activeCap?.id===capId?dc:"#000"}}>{capLabel}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── PERSISTENT CHAT ── */}
        <div style={{position:mobile?"relative":"sticky",top:mobile?0:80,background:"#fff",border:"1px solid #e8e8e8",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 16px rgba(0,0,0,0.06)"}}>
          {/* Header */}
          <div style={{padding:"11px 13px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:9,background:"#fafafa"}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:600,fontFamily:"Inter,sans-serif"}}>Ai</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Inter,sans-serif",fontWeight:500,fontSize:12,color:"#000"}}>Aiveree</div>
              <div style={{fontSize:10,color:"#bbb",fontFamily:"Inter,sans-serif",fontWeight:300}}>Online · {dl}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:6,height:6,borderRadius:3,background:"#22c55e"}}/>
              <button onClick={toggleMute} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#bbb",padding:0}}>{muted?"🔇":"🔊"}</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{height:mobile?260:400,overflowY:"auto",padding:"12px 12px 8px",display:"flex",flexDirection:"column",gap:9}}>
            {chatMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:6}}>
                {m.role==="assistant"&&<div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0,color:"#fff",fontWeight:600,fontFamily:"Inter,sans-serif"}}>Ai</div>}
                <div style={{maxWidth:"82%",background:m.role==="user"?"#000":"#f5f5f5",borderRadius:m.role==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",padding:"8px 11px",color:m.role==="user"?"#fff":"#000",fontSize:12,lineHeight:1.7,fontFamily:"Inter,sans-serif",fontWeight:300}}>
                  <MD text={m.content} dark={m.role==="user"}/>
                </div>
              </div>
            ))}
            {chatBusy&&(
              <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
                <div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:9,color:"#fff",fontWeight:600,fontFamily:"Inter,sans-serif"}}>Ai</div>
                <div style={{background:"#f5f5f5",borderRadius:"12px 12px 12px 2px",padding:"8px 11px",display:"flex",gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:3,background:"#ccc",animation:`pulse 1.2s ease ${i*.25}s infinite`}}/>)}</div>
              </div>
            )}
            <div ref={chatRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"10px 12px",borderTop:"1px solid #f0f0f0",background:"#fafafa"}}>
            {listening&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"8px 0",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:3}}>
                  {[0,1,2,3,4].map(i=>(
                    <div key={i} style={{width:3,borderRadius:3,background:"#5b21b6",animation:`voiceBar 0.6s ease ${i*0.08}s infinite alternate`,minHeight:4,height:8+i*3}}/>
                  ))}
                </div>
                <span style={{fontSize:11,color:"#5b21b6",fontFamily:"Inter,sans-serif",fontWeight:500}}>Listening...</span>
                {interim&&<span style={{fontSize:11,color:"#999",fontFamily:"Inter,sans-serif",fontStyle:"italic",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{interim}</span>}
              </div>
            )}
            <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
              <textarea value={chatInp} onChange={e=>setChatInp(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}}
                placeholder={listening?"Listening...":"Ask Aiveree anything..."} rows={2}
                style={{flex:1,background:"#fff",border:`1px solid ${listening?"#a78bfa":"#e8e8e8"}`,borderRadius:8,padding:"8px 10px",fontSize:12,color:"#000",outline:"none",fontFamily:"Inter,sans-serif",fontWeight:300,resize:"none",lineHeight:1.5,transition:"border-color .2s"}}
                onFocus={e=>e.target.style.borderColor="#5b21b6"} onBlur={e=>{if(!listening)e.target.style.borderColor="#e8e8e8";}}/>
              <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                {voiceSupported&&(
                  <button onClick={()=>listening?stopListening():startListening()}
                    style={{background:listening?"#5b21b6":"#f5f5f5",border:`1px solid ${listening?"#5b21b6":"#e5e5e5"}`,borderRadius:8,width:34,height:34,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,transition:"all .2s",position:"relative",flexShrink:0}}>
                    <span>{listening?"⏹":"🎤"}</span>
                    {listening&&<div style={{position:"absolute",inset:-4,borderRadius:12,border:"2px solid #a78bfa",animation:"ping 1.2s ease infinite",opacity:0.6}}/>}
                  </button>
                )}
                <button onClick={()=>sendChat()} disabled={chatBusy||(!chatInp.trim()&&!listening)}
                  style={{background:"#000",border:"none",borderRadius:8,width:34,height:34,color:"#fff",fontWeight:500,cursor:chatBusy||(!chatInp.trim()&&!listening)?"not-allowed":"pointer",fontSize:13,opacity:chatBusy||(!chatInp.trim()&&!listening)?0.35:1,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>
              </div>
            </div>
            <div style={{fontSize:9,color:"#ccc",marginTop:4,fontFamily:"Inter,sans-serif",textAlign:"center"}}>
              {voiceSupported?"🎤 tap to speak · Enter to send":"Enter to send · Shift+Enter for new line"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
function Projects({projects,onSelectProject,onNewProject,mobile}){
  return(
    <div style={{minHeight:"100vh",background:"#fdfdfd"}}>
      <div style={{maxWidth:760,margin:"0 auto",padding:mobile?"22px 14px 80px":"36px 28px 80px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <h2 style={{fontFamily:"Inter,sans-serif",fontWeight:300,fontSize:mobile?20:26,letterSpacing:-0.3,color:"#000",marginBottom:4}}>Your workspaces</h2>
            <p style={{fontSize:12,color:"#bbb",fontWeight:300,fontFamily:"Inter,sans-serif"}}>Every goal you've brought to Aiveree.</p>
          </div>
          <button onClick={onNewProject} style={{background:"#000",border:"none",borderRadius:9999,padding:"8px 16px",fontSize:12,color:"#fff",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ New workspace</button>
        </div>
        {projects.length===0?(
          <div style={{background:"#fff",border:"1.5px dashed #e8e8e8",borderRadius:16,padding:"44px 24px",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:11}}>✨</div>
            <div style={{fontWeight:400,fontSize:15,color:"#000",marginBottom:6,fontFamily:"Inter,sans-serif"}}>No workspaces yet</div>
            <div style={{color:"#bbb",fontSize:13,marginBottom:18,fontWeight:300,fontFamily:"Inter,sans-serif"}}>Tell Aiveree your goal and your team gets to work.</div>
            <button onClick={onNewProject} style={{background:"#000",border:"none",borderRadius:9999,padding:"10px 22px",fontSize:13,color:"#fff",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Tell Aiveree your goal</button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {projects.map(p=>{
              const dc=getDomainColor(p.domain_id);
              return(
                <div key={p.id} onClick={()=>onSelectProject(p)} style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:12,padding:mobile?13:"15px 18px",cursor:"pointer",display:"flex",gap:11,alignItems:"flex-start"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=`${dc}40`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e8e8e8";}}>
                  <div style={{width:36,height:36,borderRadius:9,background:`${dc}12`,border:`1px solid ${dc}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{getDomainEmoji(p.domain_id)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:13,color:"#000",marginBottom:3,fontFamily:"Inter,sans-serif"}}>{p.name||p.goal}</div>
                    <div style={{fontSize:11,color:"#bbb",fontFamily:"Inter,sans-serif",fontWeight:300}}>{getDomainLabel(p.domain_id)} · {new Date(p.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
                  </div>
                  <span style={{fontSize:13,color:"#ddd",flexShrink:0}}>→</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const mobile=useIsMobile();
  const[screen,setScreen]=useState("home");
  const[intel,setIntel]=useState(()=>getLocalIntel());
  const[user,setUser]=useState(null);
  const[projects,setProjects]=useState(()=>getProjects());
  const[selectedDomain,setSelectedDomain]=useState(null);
  const[pendingIntel,setPendingIntel]=useState(null);
  const[credits,setCredits]=useState(()=>getCredits());
  const globalAudioRef=useRef(null);

  useEffect(()=>{if(intel?.onboarding_complete&&user)setScreen("dashboard")},[]);

  // Restore an existing session (or complete an OAuth redirect) on load.
  useEffect(()=>{(async()=>{
    await completeOAuthIfPresent();
    const restored=await restoreSession();
    if(restored?.user?.id){
      const u={ id:restored.user.id, email:restored.user.email, name:restored.profile?.name||restored.user.user_metadata?.name||restored.user.email?.split("@")[0] };
      setUser(u);
      const li=getLocalIntel();
      if(li?.onboarding_complete){setIntel(li);setScreen("dashboard");}
      // Sync credits from the server (authoritative).
      try{ const cr=await apiFetch("/.netlify/functions/credits",{action:"get"}); const cd=await cr.json(); if(typeof cd.credits==="number"){saveCredits(cd.credits);setCredits(cd.credits);} }catch{}
    }
  })()},[]);

  // Stop all audio when screen changes to prevent overlap
  useEffect(()=>{
    if(globalAudioRef.current){globalAudioRef.current.pause();globalAudioRef.current.currentTime=0;}
  },[screen]);

  const startOnboarding=domain=>{setSelectedDomain(domain||null);setScreen("onboarding");};
  const handleOnboardingComplete=pi=>{setPendingIntel(pi);setScreen("auth");};

  const handleAuth=async(u,i)=>{
    setUser(u);setIntel(i);setScreen("dashboard");

    // Local project for immediate display
    const localProj={id:Date.now(),goal:i.goal?.split(" | ")[0]||"",domain_id:i.domain_id,created_at:new Date().toISOString(),name:(i.goal||"").slice(0,60)};
    const updated=[localProj,...getProjects()];
    saveProjects(updated);setProjects(updated);

    // Wire into backend asynchronously — don't block the dashboard
    setTimeout(async()=>{
      try {
        // 1. Create user profile
        await createUserProfile(u.id, { name:u.name, email:u.email });

        // 2. Create goal
        const goal = await createGoal(u.id, { goal:i.goal?.split(" | ")[0], domain_id:i.domain_id });

        // 3. Create project
        const project = goal ? await createProject(u.id, goal.id, { goal:i.goal?.split(" | ")[0], domain_id:i.domain_id }) : null;

        // 4. Initialise user state
        await initUserState(u.id, i.domain_id);

        // 5. Extract memories from onboarding conversation
        if (i.conversation?.length) {
          await extractMemories(u.id, i.conversation, project?.id);
        }

        // 6. Fire sign-up and goal-created events
        await fireEvent("user.signed_up", u.id, { domain: i.domain_id, goal_preview: i.goal?.slice(0,100) }, project?.id);
        if (goal) await fireEvent("goal.created", u.id, { goal_id: goal.id, title: goal.title }, project?.id);

        // 7. Ask for WhatsApp number and voice/text preference
        const waResult = await requestPhoneNumber(u.name);
        if (waResult?.phone) {
          await supabase.from('profiles').update({
            whatsapp_number: waResult.phone,
            preferred_channel: 'whatsapp',
            whatsapp_format: waResult.format
          }).eq('id', u.id);

          // Send immediate welcome message in their preferred format
          const welcomeMsg = `Hi ${u.name||'there'}! Aiveree here. Your workspace is ready and my team is already working on your goal. I'll keep you updated here.`;
          await apiFetch("/.netlify/functions/whatsapp", { action: "send", user_id: u.id, message: welcomeMsg, message_type: "welcome" }).catch(()=>{});
        }

      } catch(err) {
        console.error("Post-auth setup error:", err);
        // Non-blocking — dashboard still shows
      }
    }, 100);
  };

  const handleNewProject=()=>{setSelectedDomain(null);setScreen("onboarding");};
  const handleSelectProject=p=>{
    const pi={...intel,goal:p.goal,domain_id:p.domain_id};
    setIntel(pi);setScreen("dashboard");
  };

  return(
    <div style={{minHeight:"100vh",background:"#fdfdfd",color:"#000",fontFamily:"Inter,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:3px;}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes ping{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.5);opacity:0}}
        @keyframes voiceBar{0%{transform:scaleY(0.4)}100%{transform:scaleY(1.4)}}
        input::placeholder,textarea::placeholder{color:#ccc;}
        button{font-family:Inter,sans-serif;}
      `}</style>

      {/* HEADER */}
      {screen!=="auth"&&(
        <header style={{background:"rgba(253,253,253,0.95)",borderBottom:"1px solid #efefef",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(20px)"}}>
          <div style={{display:"flex",alignItems:"center",height:54,padding:`0 ${mobile?14:36}px`,maxWidth:1200,margin:"0 auto"}}>
            <div onClick={()=>setScreen("home")} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",flexShrink:0}}>
              <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:11,color:"#fff",fontFamily:"Inter,sans-serif"}}>Ai</div>
              {!mobile&&<span style={{fontFamily:"Inter,sans-serif",fontSize:15,fontWeight:500,letterSpacing:-0.2,color:"#000"}}>Aiveree</span>}
            </div>
            {!mobile&&intel?.onboarding_complete&&user&&(
              <nav style={{flex:1,display:"flex",alignItems:"center",marginLeft:28}}>
                <button onClick={()=>setScreen("dashboard")} style={{background:"none",border:"none",color:screen==="dashboard"?"#000":"#999",fontSize:13,fontWeight:screen==="dashboard"?500:300,cursor:"pointer",padding:"5px 10px",fontFamily:"Inter,sans-serif"}}>Dashboard</button>
                <button onClick={()=>setScreen("projects")} style={{background:"none",border:"none",color:screen==="projects"?"#000":"#999",fontSize:13,fontWeight:screen==="projects"?500:300,cursor:"pointer",padding:"5px 10px",fontFamily:"Inter,sans-serif"}}>Workspaces</button>
              </nav>
            )}
            <div style={{display:"flex",alignItems:"center",gap:7,marginLeft:"auto",flexShrink:0}}>
              {user?(
                <button onClick={handleNewProject} style={{background:"#000",border:"none",borderRadius:9999,padding:"6px 14px",fontSize:12,color:"#fff",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ New workspace</button>
              ):(
                <>
                  <button onClick={()=>setScreen("auth")} style={{background:"transparent",border:"1px solid #e0e0e0",borderRadius:9999,padding:"6px 16px",fontSize:13,color:"#555",fontWeight:300,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Log in</button>
                  <button onClick={()=>startOnboarding(null)} style={{background:"#000",border:"none",borderRadius:9999,padding:"6px 18px",fontSize:13,color:"#fff",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Get started</button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {screen==="home"&&<Homepage onStart={startOnboarding} mobile={mobile}/>}
      {screen==="onboarding"&&<Onboarding selectedDomain={selectedDomain} onComplete={handleOnboardingComplete} mobile={mobile}/>}
      {screen==="auth"&&<AuthScreen onAuth={handleAuth} prefilledIntel={pendingIntel||intel} mobile={mobile}/>}
      {screen==="dashboard"&&intel&&user&&<CommandCentre intel={intel} user={user} mobile={mobile} onNewProject={handleNewProject} credits={credits} onCreditUsed={nc=>setCredits(nc)}/>}
      {screen==="projects"&&<Projects projects={projects} onSelectProject={handleSelectProject} onNewProject={handleNewProject} mobile={mobile}/>}
    </div>
  );
}
