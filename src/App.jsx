import { useState, useEffect, useRef } from "react";

// ─── AGENT DEFINITIONS ────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: "cara",
    name: "Cara",
    role: "Career Strategist",
    emoji: "💼",
    color: "#5b21b6",
    gradient: "linear-gradient(135deg,#5b21b6,#a78bfa)",
    dashboardType: "career",
    live: true,
    description: "Cara reviews your professional situation, maps your path forward, finds the right opportunities, and prepares you to land them. She works continuously on your behalf — searching, analysing, and building — so you stay ahead of the market.",
    delivers: [
      "A live job board updated daily with roles matched to your profile",
      "Tailored CV and cover letter for any role in under 60 seconds",
      "Interview preparation specific to the company and role",
      "Real salary data for your target role and a negotiation strategy",
      "A skills gap analysis with specific courses to close each gap"
    ],
    team: [
      { name: "Scout", role: "Job Finder", desc: "Searches live job listings daily and surfaces the strongest matches for your profile. Runs automatically — new results waiting when you return." },
      { name: "Forge", role: "Application Builder", desc: "Takes any job listing and generates a tailored CV and cover letter specific to that role, company, and requirements." },
      { name: "Brief", role: "Interview Coach", desc: "Researches the company, anticipates the questions they are likely to ask, and prepares your talking points and example answers." },
      { name: "Gauge", role: "Salary Intelligence", desc: "Pulls real market salary data for your target role and location. Provides a negotiation strategy and the script to use." },
      { name: "Map", role: "Skills Analyst", desc: "Compares your current skills against your target roles. Identifies the specific gaps and finds the right courses to close them." },
    ]
  },
  {
    id: "max",
    name: "Max",
    role: "Business Advisor",
    emoji: "🏗️",
    color: "#059669",
    gradient: "linear-gradient(135deg,#059669,#34d399)",
    dashboardType: "business",
    live: true,
    description: "Max thinks like a founder and an investor simultaneously. He analyses your idea, builds the plan, researches the market, handles the legal setup, and models the financials. He pressure-tests assumptions and finds opportunities others miss.",
    delivers: [
      "A full lean business plan built around your specific idea",
      "A competitive landscape showing who is in your market and what gap you can fill",
      "A legal setup checklist with every registration, insurance, and contract you need",
      "A 12-month financial projection with break-even analysis",
      "A positioning statement, target customer profile, and 90-day go-to-market plan"
    ],
    team: [
      { name: "Blueprint", role: "Business Plan Writer", desc: "Generates a full lean business plan from your profile and idea. Structured for investors, banks, or your own clarity. Downloadable." },
      { name: "Intel", role: "Market Researcher", desc: "Searches Companies House, news sources, and competitor data to build a competitive landscape specific to your market." },
      { name: "Foundation", role: "Legal Setup Guide", desc: "Identifies every registration, insurance, and contract you need for your specific business type and structure." },
      { name: "Ledger", role: "Financial Modeller", desc: "Builds a 12-month financial projection. Models different pricing scenarios and calculates your break-even point." },
      { name: "Launch", role: "Marketing Strategist", desc: "Generates your positioning statement, ideal customer profile, and a 90-day marketing plan specific to your business." },
    ]
  },
  {
    id: "ada",
    name: "Ada",
    role: "Housing Advocate",
    emoji: "🏠",
    color: "#dc2626",
    gradient: "linear-gradient(135deg,#dc2626,#f87171)",
    dashboardType: "housing",
    live: false,
    description: "Ada knows housing law inside out and is entirely on the tenant's side. She reads documents, identifies what landlords hope tenants never find out, drafts formal letters, and finds the support needed to resolve disputes.",
    delivers: [
      "Plain English analysis of any tenancy agreement with legal flags",
      "Formal letters to landlords and councils citing specific legislation",
      "A clear picture of your rights and entitlements for your exact situation",
      "Local law centres, housing charities, and Citizens Advice with contact details",
      "Legal deadline tracking so nothing important is ever missed"
    ],
    team: [
      { name: "Lens", role: "Document Analyser", desc: "Reads any tenancy agreement or letter and identifies everything illegal, unusual, or worth questioning." },
      { name: "Voice", role: "Letter Writer", desc: "Drafts formal letters to landlords, councils, and courts with correct legal citations for your specific situation." },
      { name: "Shield", role: "Rights Checker", desc: "Pulls your specific entitlements from GOV.UK based on your exact circumstances and housing situation." },
      { name: "Compass", role: "Support Finder", desc: "Finds local law centres, housing charities, and Citizens Advice with contact details and availability." },
      { name: "Clock", role: "Deadline Monitor", desc: "Extracts legal deadlines from your situation and tracks them on your dashboard so nothing slips." },
    ]
  },
  {
    id: "rex",
    name: "Rex",
    role: "Property Manager",
    emoji: "🔑",
    color: "#d97706",
    gradient: "linear-gradient(135deg,#d97706,#fbbf24)",
    dashboardType: "landlord",
    live: false,
    description: "Rex keeps landlords compliant, legally protected, and profitable. He tracks every deadline, generates every document, monitors compliance requirements, and models the financials so nothing is ever missed.",
    delivers: [
      "A compliance dashboard tracking gas safety, EPC, HMO licencing, and renewal deadlines",
      "Legally compliant tenancy agreements and supporting documents",
      "Deposit protection tracking and prescribed information documentation",
      "Valid Section 21 and Section 8 notices checked before sending",
      "Rental yield calculations and market-rate pricing for your property"
    ],
    team: [
      { name: "Guard", role: "Compliance Monitor", desc: "Tracks gas safety certificates, EPC ratings, HMO licencing, alarm requirements, and every upcoming renewal deadline." },
      { name: "Draft", role: "Document Builder", desc: "Generates legally compliant tenancy agreements, guarantor forms, and addenda for your specific property type." },
      { name: "Safe", role: "Deposit Manager", desc: "Tracks deposit protection deadlines, generates prescribed information documents, and monitors ongoing compliance." },
      { name: "Notice", role: "Legal Notice Generator", desc: "Drafts Section 21 and Section 8 notices correctly and validates them before sending." },
      { name: "Yield", role: "Finance Adviser", desc: "Calculates rental yield, advises on market-rate pricing, and models refinancing and portfolio scenarios." },
    ]
  },
  {
    id: "nova",
    name: "Nova",
    role: "Property Investment Adviser",
    emoji: "🏡",
    color: "#2563eb",
    gradient: "linear-gradient(135deg,#2563eb,#60a5fa)",
    dashboardType: "buyer",
    live: false,
    description: "Nova is analytical, opportunity-focused, and completely objective. She models the full financial picture of any property across three scenarios, surfaces the hidden upside, and flags the risks before anyone gets attached to the wrong investment.",
    delivers: [
      "Three-scenario ROI model: hold as-is, add value, and sell after improvement",
      "Estimated value uplift from extensions, conversions, and refurbishments",
      "Total purchase cost including stamp duty, legal fees, survey, and mortgage",
      "Plain English translation of survey reports with repair cost estimates",
      "Step-by-step conveyancing guide with current timelines"
    ],
    team: [
      { name: "Search", role: "Property Finder", desc: "Searches Rightmove and Zoopla for properties matching your criteria, budget, and investment goals." },
      { name: "Horizon", role: "ROI Calculator", desc: "Models three investment scenarios: hold as-is, add value, and sell after improvement. Shows projected yield, growth, and total return." },
      { name: "Uplift", role: "Value Add Analyst", desc: "Estimates the cost and potential value increase from common improvements for the specific property type and postcode." },
      { name: "Vault", role: "Cost Calculator", desc: "Calculates total purchase cost including stamp duty, solicitor fees, survey, mortgage arrangement, and initial works." },
      { name: "Survey", role: "Survey Analyser", desc: "Reads a survey report and translates every issue into plain English with estimated repair costs and a red, amber, green risk rating." },
      { name: "Path", role: "Conveyancing Guide", desc: "Walks through the entire purchase process step by step with current realistic timelines and what to chase at each stage." },
    ]
  },
];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const INTEL_KEY = "aiveree_intel_v4";
const PROJECT_KEY = "aiveree_projects_v4";
function getLocalIntel() { try { const v = localStorage.getItem(INTEL_KEY); return v ? JSON.parse(v) : null; } catch { return null; } }
function saveLocalIntel(d) { try { localStorage.setItem(INTEL_KEY, JSON.stringify(d)); } catch {} }
function getProjects() { try { const v = localStorage.getItem(PROJECT_KEY); return v ? JSON.parse(v) : []; } catch { return []; } }
function saveProjects(p) { try { localStorage.setItem(PROJECT_KEY, JSON.stringify(p)); } catch {} }

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return m;
}

function MD({ text }) {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return <div>{paragraphs.map((para, pi) => (
    <p key={pi} style={{ margin: 0, marginBottom: pi < paragraphs.length - 1 ? 14 : 0, lineHeight: 1.8 }}>
      {para.split(/(\*\*[^*\n]+\*\*)/).map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} style={{ color: "#1a1523", fontWeight: 700 }}>{p.slice(2, -2)}</strong>
          : p.split(/\n/).map((line, li, arr) => <span key={`${i}-${li}`}>{line}{li < arr.length - 1 && <br />}</span>)
      )}
    </p>
  ))}</div>;
}

// ─── ONBOARDING PROMPT ────────────────────────────────────────────────────────
const ONBOARDING_PROMPT = `You're Aiveree, meeting someone for the first time. Think of this as a real conversation — you're genuinely curious about this person and what's going on in their life.

Write like you're texting a brilliant friend. Short sentences. Warm. Real. No bullet points, no headers, no corporate language.

After they answer what they're working toward, respond with genuine interest. Pick up on something specific they said. Then ask what's making it difficult.

After they share what's hard, acknowledge it honestly. Ask something that helps you understand better — background, how long they've been at it, what they've tried.

After 3 to 4 exchanges, wrap up warmly. Say something like "Right, I've got a proper picture now. Let me build your command centre." Then add exactly this marker on its own line: [ONBOARDING_COMPLETE]

Rules:
- Every response is 2 to 3 sentences maximum
- Use their name once they share it
- Match their energy
- Never mention AI tools or platform features yet
- Sound like someone who genuinely cares`;

// ─── AGENT CARD ───────────────────────────────────────────────────────────────
function AgentCard({ agent, mobile, onStart }) {
  const [expanded, setExpanded] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [hover, setHover] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: "#ffffff",
          border: `1.5px solid ${hover ? agent.color + "35" : "rgba(0,0,0,0.07)"}`,
          borderRadius: 20,
          padding: mobile ? 20 : "24px 28px",
          transition: "all .2s",
          boxShadow: hover ? `0 8px 32px ${agent.color}15` : "0 2px 8px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
        }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: agent.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            {agent.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: 19, color: "#1a1523" }}>{agent.name}</span>
              {!agent.live && <span style={{ fontSize: 10, background: "rgba(0,0,0,0.05)", color: "#9ca3af", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>Coming soon</span>}
            </div>
            <div style={{ fontSize: 13, color: agent.color, fontWeight: 600 }}>{agent.role}</div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "#4b4558", lineHeight: 1.75, marginBottom: 16, flex: 1 }}>{agent.description}</p>

        {expanded && (
          <div style={{ marginBottom: 16, background: "rgba(0,0,0,0.02)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8396", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>What {agent.name} delivers</div>
            {agent.delivers.map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ color: agent.color, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: "#3d3649", lineHeight: 1.65 }}>{d}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setExpanded(e => !e)} style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "7px 14px", fontSize: 13, color: "#4b4558", cursor: "pointer", fontWeight: 500 }}>
            {expanded ? "Show less" : "Learn more"}
          </button>
          <button onClick={() => setTeamOpen(true)} style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25`, borderRadius: 8, padding: "7px 14px", fontSize: 13, color: agent.color, cursor: "pointer", fontWeight: 600 }}>
            Meet the team
          </button>
          {agent.live && (
            <button onClick={() => onStart(agent)} style={{ background: agent.gradient, border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, color: "#ffffff", cursor: "pointer", fontWeight: 700, marginLeft: "auto" }}>
              Work with {agent.name} →
            </button>
          )}
        </div>
      </div>

      {teamOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setTeamOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#ffffff", borderRadius: 22, padding: mobile ? 20 : 32, maxWidth: 580, width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: agent.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{agent.emoji}</div>
              <div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: 18, color: "#1a1523" }}>{agent.name}'s Team</div>
                <div style={{ fontSize: 13, color: agent.color, fontWeight: 600 }}>{agent.role}</div>
              </div>
              <button onClick={() => setTeamOpen(false)} style={{ marginLeft: "auto", background: "rgba(0,0,0,0.04)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6b6478" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {agent.team.map((member, i) => (
                <div key={i} style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15, color: "#1a1523" }}>{member.name}</span>
                    <span style={{ fontSize: 11, color: agent.color, fontWeight: 700, background: `${agent.color}10`, padding: "2px 8px", borderRadius: 20 }}>{member.role}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#4b4558", lineHeight: 1.65, margin: 0 }}>{member.desc}</p>
                </div>
              ))}
            </div>
            {agent.live && (
              <button onClick={() => { setTeamOpen(false); onStart(agent); }} style={{ width: "100%", marginTop: 20, background: agent.gradient, border: "none", borderRadius: 12, padding: 13, color: "#ffffff", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
                Work with {agent.name} →
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── HOMEPAGE ─────────────────────────────────────────────────────────────────
function Homepage({ onStart, mobile }) {
  const liveAgents = AGENTS.filter(a => a.live);
  const comingAgents = AGENTS.filter(a => !a.live);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: mobile ? "32px 16px 80px" : "60px 28px 80px" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: mobile ? 52 : 80 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(91,33,182,0.06)", border: "1px solid rgba(91,33,182,0.14)", borderRadius: 20, padding: "5px 16px", fontSize: 12, color: "#5b21b6", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5b21b6", display: "inline-block" }} />
          Your Personal Command Centre
        </div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: mobile ? "clamp(32px,8vw,44px)" : "clamp(40px,5vw,68px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -3, marginBottom: 22, color: "#1a1523" }}>
          Meet your agents.<br />
          <span style={{ background: "linear-gradient(135deg,#5b21b6,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>They work for you.</span>
        </h1>
        <p style={{ fontSize: mobile ? 15 : 18, color: "#6b6478", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.8 }}>
          Tell us your goal. We build your personal command centre and deploy specialist agents to do the work on your behalf. Not a chatbot. A system that acts.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => onStart(null)} style={{ background: "linear-gradient(135deg,#5b21b6,#a78bfa)", border: "none", borderRadius: 12, padding: "13px 30px", color: "#ffffff", fontWeight: 700, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 20px rgba(91,33,182,0.25)" }}>
            Build my command centre →
          </button>
          <button onClick={() => document.getElementById("agents-section")?.scrollIntoView({ behavior: "smooth" })} style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: "13px 24px", color: "#1a1523", fontWeight: 600, cursor: "pointer", fontSize: 15 }}>
            Meet the agents
          </button>
        </div>
      </div>

      {/* Live agents */}
      <div id="agents-section" style={{ marginBottom: 60 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: mobile ? 20 : 26, color: "#1a1523", marginBottom: 6 }}>Available now</h2>
          <p style={{ fontSize: 14, color: "#8a8396" }}>Choose an agent and they will build a command centre around your goal.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
          {liveAgents.map(agent => <AgentCard key={agent.id} agent={agent} mobile={mobile} onStart={onStart} />)}
        </div>
      </div>

      {/* Coming soon */}
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: mobile ? 20 : 26, color: "#1a1523", marginBottom: 6 }}>Coming soon</h2>
          <p style={{ fontSize: 14, color: "#8a8396" }}>More agents in development. Each one brings a specialist team.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 16 }}>
          {comingAgents.map(agent => <AgentCard key={agent.id} agent={agent} mobile={mobile} onStart={onStart} />)}
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ selectedAgent, onComplete, mobile }) {
  const initMsg = selectedAgent
    ? `Hey! I'm Aiveree. ${selectedAgent.name} is ready to work with you — but first I want to make sure I properly understand your situation. What are you working toward?`
    : "Hey! I'm Aiveree. I'd love to understand what's going on in your world before I start building. So — what are you working toward right now, or what's taking up most of your headspace?";

  const [msgs, setMsgs] = useState([{ role: "assistant", content: initMsg }]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  const SUGGESTIONS = [
    { emoji: "💼", text: "I want to find a better job that pays what I'm worth" },
    { emoji: "🏗️", text: "I'm starting a business and don't know where to begin" },
    { emoji: "📚", text: "I'm studying and need help staying on top of everything" },
    { emoji: "💰", text: "I want to get my finances sorted and stop wasting money" },
    { emoji: "🏠", text: "I'm dealing with a housing issue and need to know my rights" },
    { emoji: "🚀", text: "I have a side project idea I want to make real" },
  ];

  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (overrideText) => {
    const text = (overrideText || inp).trim();
    if (!text || busy) return;
    const um = { role: "user", content: text };
    const next = [...msgs, um];
    setMsgs(next); setInp(""); setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })), system: ONBOARDING_PROMPT })
      });
      const data = await res.json();
      let reply = data.content ? data.content.filter(b => b.type === "text").map(b => b.text).join("") : "Sorry, something went wrong.";

      if (reply.includes("[ONBOARDING_COMPLETE]")) {
        reply = reply.replace("[ONBOARDING_COMPLETE]", "").trim();
        setComplete(true);
        const finalMsgs = [...next, { role: "assistant", content: reply }];
        setMsgs(finalMsgs);
        setBusy(false);
        setSaving(true);
        const userMessages = finalMsgs.filter(m => m.role === "user").map(m => m.content);
        const goal = userMessages[0] || "";
        const nameMatch = userMessages.join(" ").match(/(?:I'm |my name is |I am |call me )(\w+)/i);
        let dashboardType = selectedAgent?.dashboardType || null;
        if (!dashboardType) {
          const g = goal.toLowerCase();
          if (g.match(/job|career|work|employ|role|salary|cv|interview|promotion/)) dashboardType = "career";
          else if (g.match(/business|startup|freelance|founder|idea|side hustle|sell|client/)) dashboardType = "business";
          else if (g.match(/house|rent|landlord|tenant|flat|evict|deposit|housing/)) dashboardType = "housing";
          else if (g.match(/buy|mortgage|property|purchase|move|first.time/)) dashboardType = "buyer";
          else dashboardType = "career";
        }
        const intel = { goal, name: nameMatch ? nameMatch[1] : "", onboarding_complete: true, dashboard_type: dashboardType, created_at: new Date().toISOString() };
        saveLocalIntel(intel);
        const projects = getProjects();
        const newProject = { id: Date.now(), goal, agent: selectedAgent?.id || null, dashboard_type: dashboardType, created_at: new Date().toISOString(), name: goal.slice(0, 60) };
        saveProjects([newProject, ...projects]);
        setSaving(false);
        setTimeout(() => onComplete(intel), 1800);
        return;
      }
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch { setMsgs([...next, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]); }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: mobile ? "28px 16px 80px" : "52px 20px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        {selectedAgent ? (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: selectedAgent.gradient, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{selectedAgent.emoji}</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: mobile ? 22 : 28, letterSpacing: -1, marginBottom: 6, color: "#1a1523" }}>Working with {selectedAgent.name}</h2>
            <p style={{ color: "#6b6478", fontSize: 14 }}>Just a quick chat so I understand your situation properly.</p>
          </>
        ) : (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#5b21b6,#a78bfa)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, color: "#fff" }}>Ai</div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: mobile ? 22 : 28, letterSpacing: -1, marginBottom: 6, color: "#1a1523" }}>Welcome to Aiveree</h2>
            <p style={{ color: "#6b6478", fontSize: 14 }}>Just a quick chat so I know where you're coming from.</p>
          </>
        )}
      </div>

      <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 20, padding: mobile ? 16 : 24, marginBottom: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: mobile ? 320 : 420, overflowY: "auto", marginBottom: 14 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
              {m.role === "assistant" && (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: selectedAgent ? selectedAgent.gradient : "linear-gradient(135deg,#5b21b6,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: selectedAgent ? 13 : 11, flexShrink: 0, color: "#fff", fontWeight: 900 }}>
                  {selectedAgent ? selectedAgent.emoji : "Ai"}
                </div>
              )}
              <div style={{ maxWidth: "80%", background: m.role === "user" ? "rgba(91,33,182,0.06)" : "#fff", border: `1px solid ${m.role === "user" ? "rgba(91,33,182,0.15)" : "rgba(0,0,0,0.07)"}`, borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "11px 15px", fontSize: 14, color: "#1a1523", lineHeight: 1.75 }}>
                <MD text={m.content} />
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: selectedAgent ? selectedAgent.gradient : "linear-gradient(135deg,#5b21b6,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 3 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: 2, background: "#fff", animation: `pulse 1.2s ease ${i * .25}s infinite` }} />)}</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: "18px 18px 18px 4px", padding: "11px 15px", display: "flex", gap: 4 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "#a78bfa", animation: `pulse 1.2s ease ${i * .25}s infinite` }} />)}
              </div>
            </div>
          )}
          {complete && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{saving ? "⏳" : "✨"}</div>
              <div style={{ color: "#5b21b6", fontWeight: 700, fontSize: 14 }}>{saving ? "Building your command centre..." : "Ready. Taking you there now..."}</div>
            </div>
          )}
          <div ref={ref} />
        </div>

        {!complete && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12, display: "flex", gap: 8 }}>
            <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} placeholder="Type your answer..." autoFocus
              style={{ flex: 1, background: "#f9f7f4", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#1a1523", outline: "none" }}
              onFocus={e => e.target.style.borderColor = "rgba(91,33,182,0.3)"}
              onBlur={e => e.target.style.borderColor = "rgba(0,0,0,0.08)"} />
            <button onClick={() => send()} disabled={busy || !inp.trim()} style={{ background: "linear-gradient(135deg,#5b21b6,#a78bfa)", border: "none", borderRadius: 10, padding: "11px 20px", color: "#fff", fontWeight: 700, cursor: busy || !inp.trim() ? "not-allowed" : "pointer", fontSize: 14, opacity: busy || !inp.trim() ? 0.6 : 1 }}>Send</button>
          </div>
        )}
      </div>

      {!complete && msgs.length <= 1 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8396", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, textAlign: "center" }}>Or pick one to get started</div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8 }}>
            {SUGGESTIONS.map(s => (
              <button key={s.text} onClick={() => send(s.text)}
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#3d3649", cursor: "pointer", textAlign: "left", lineHeight: 1.6, display: "flex", gap: 10, alignItems: "flex-start" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(91,33,182,0.25)"; e.currentTarget.style.background = "rgba(91,33,182,0.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)"; e.currentTarget.style.background = "#ffffff"; }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{s.emoji}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUB-AGENT RUNNER ─────────────────────────────────────────────────────────
function SubAgentRunner({ member, agent, intel, mobile, onClose }) {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(true);

  const profile = [
    intel?.name ? `Name: ${intel.name}` : "",
    intel?.goal ? `Goal: ${intel.goal}` : "",
    intel?.context ? `Background: ${intel.context}` : "",
    intel?.blockers ? `Challenges: ${intel.blockers}` : "",
  ].filter(Boolean).join("\n");

  const prompts = {
    Scout: `Search the web for real, current UK job listings matching this user's profile. Find 5 to 8 specific roles with real job titles, companies, locations, salary where shown, and application links. Explain in one sentence why each role matches. Format with **Job Title** at Company on each entry.`,
    Forge: `Based on this user's profile and goal, generate a strong professional CV summary (3 to 4 sentences) and a tailored cover letter opening paragraph they can adapt. Make it specific to their background and target role.`,
    Brief: `Search the web for interview preparation advice for the user's target field. Generate 8 likely interview questions they will face with a suggested talking point for each. Make it specific to their situation.`,
    Gauge: `Search the web for current UK salary data for the user's target role and location. Provide realistic salary ranges at junior, mid, and senior levels. Then give a specific negotiation strategy — what to say, when, and what number to anchor on.`,
    Map: `Analyse the user's goal and experience. Identify 4 specific skill gaps between where they are and where they want to be. For each gap, find a real free or affordable course with actual URL. Explain how long each takes and the order to tackle them.`,
    Blueprint: `Generate a complete lean business plan for this user's idea. Include: **Problem**, **Solution**, **Target Market**, **Revenue Model**, **Key Assumptions**, **First 90 Days**, and **One Key Risk**. Make it specific to what they described. Not a template — a real plan.`,
    Intel: `Search Companies House and the web for competitors in this user's market. Find 4 to 6 real businesses. For each: name, what they do, approximate pricing, and their key weakness. Then identify the specific gap this user could fill.`,
    Foundation: `Based on the user's business idea, identify exactly what legal and administrative setup they need in the UK. Cover: business structure recommendation, HMRC registration, insurance types needed, key contracts, and any industry-specific licencing. Include GOV.UK links.`,
    Ledger: `Build a simple 12-month financial projection for this user's business. Show conservative, moderate, and optimistic scenarios with monthly revenue targets, key costs, and break-even point for each. Use realistic numbers for their market.`,
    Launch: `Generate a marketing strategy for this user's business. Include: **Positioning statement**, **Ideal customer profile**, **Top 3 acquisition channels** specific to their business type, and a **90-day marketing calendar** with weekly actions.`,
  };

  useEffect(() => {
    (async () => {
      try {
        const prompt = prompts[member.name] || `Help this user with: ${member.role}. Be specific, practical, and use web search to find real current information.`;
        const res = await fetch("/.netlify/functions/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: `User profile:\n${profile}\n\n${prompt}` }],
            system: `You are ${member.name}, a specialist agent. Use web search to find real, current, specific information. Format output with **bold headers** for sections. Keep paragraphs to 2 to 3 sentences. Deliver genuine, specific value — not generic advice.`,
            useSearch: true
          })
        });
        const data = await res.json();
        const text = data.content ? data.content.filter(b => b.type === "text").map(b => b.text).join("\n\n") : "";
        setOutput(text || "Something went wrong. Please try again.");
      } catch { setOutput("Something went wrong. Please try again."); }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ background: "#ffffff", border: `1.5px solid ${agent.color}25`, borderRadius: 20, padding: mobile ? 16 : 24, marginBottom: 20, boxShadow: `0 4px 24px ${agent.color}08` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: agent.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 900 }}>{member.name.slice(0, 2)}</div>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15, color: "#1a1523" }}>{member.name}</div>
            <div style={{ fontSize: 12, color: agent.color, fontWeight: 600 }}>{member.role}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 16, color: "#6b6478" }}>×</button>
      </div>

      {loading ? (
        <div style={{ padding: "28px 0", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: agent.color, animation: `pulse 1.2s ease ${i * .3}s infinite`, opacity: 0.7 }} />)}
          </div>
          <div style={{ color: "#6b6478", fontSize: 13 }}>{member.name} is working on this. Searching the web and building your results...</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, color: "#3d3649", lineHeight: 1.8 }}><MD text={output} /></div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={() => navigator.clipboard.writeText(output)} style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "7px 14px", fontSize: 12, color: "#4b4558", cursor: "pointer" }}>Copy</button>
            <button onClick={onClose} style={{ background: `${agent.color}10`, border: `1px solid ${agent.color}25`, borderRadius: 8, padding: "7px 14px", fontSize: 12, color: agent.color, cursor: "pointer", fontWeight: 600 }}>Done</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── COMMAND CENTRE ───────────────────────────────────────────────────────────
function CommandCentre({ intel, mobile, onNewProject }) {
  const agent = AGENTS.find(a => a.dashboardType === intel.dashboard_type) || AGENTS.find(a => a.live);
  const [breakdown, setBreakdown] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [activeSubAgent, setActiveSubAgent] = useState(null);
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? "Good morning" : timeOfDay < 17 ? "Good afternoon" : "Good evening";

  const profile = [
    intel?.name ? `Name: ${intel.name}` : "",
    intel?.goal ? `Goal: ${intel.goal}` : "",
  ].filter(Boolean).join("\n");

  useEffect(() => {
    if (!intel?.goal || breakdown || breakdownLoading) return;
    const cacheKey = `bd_${intel.goal.slice(0, 40).replace(/\W/g, "_")}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { try { setBreakdown(JSON.parse(cached)); return; } catch {} }
    (async () => {
      setBreakdownLoading(true);
      try {
        const res = await fetch("/.netlify/functions/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: `User profile:\n${profile}\n\nBreak down this person's goal. Return ONLY valid JSON, no markdown.\n\n{"summary":"2 sentences understanding what they are trying to do","milestones":[{"title":"milestone","timeframe":"e.g. Week 1 to 2","tasks":["specific task","specific task"]}],"quick_wins":["action they can do today","another quick win","a third"],"insight":"one honest observation they probably haven't considered"}` }],
            system: "Return only valid JSON. Be specific to this person's actual situation. Create 4 to 5 milestones.",
            useSearch: true
          })
        });
        const data = await res.json();
        let text = data.content ? data.content.filter(b => b.type === "text").map(b => b.text).join("") : "";
        text = text.replace(/```json|```/g, "").trim();
        const start = text.indexOf("{"), end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
        const parsed = JSON.parse(text);
        setBreakdown(parsed);
        sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
      } catch { setBreakdown({ error: true }); }
      setBreakdownLoading(false);
    })();
  }, [intel?.goal]);

  if (breakdownLoading) {
    return (
      <div style={{ textAlign: "center", padding: mobile ? "48px 16px" : "80px 28px", maxWidth: 560, margin: "0 auto" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: agent?.gradient || "linear-gradient(135deg,#5b21b6,#a78bfa)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 20 }}>{agent?.emoji || "Ai"}</div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: mobile ? 20 : 26, marginBottom: 10, color: "#1a1523" }}>{greeting}{intel?.name ? `, ${intel.name}` : ""}.</h2>
        <p style={{ color: "#6b6478", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{agent?.name} is building your command centre.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300, margin: "0 auto" }}>
          {["Analysing your goal...", "Mapping your milestones...", "Identifying quick wins...", "Preparing your team..."].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "rgba(91,33,182,0.04)", border: "1px solid rgba(91,33,182,0.08)", borderRadius: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: "#a78bfa", animation: `pulse 1.5s ease ${i * .4}s infinite` }} />
              <span style={{ fontSize: 13, color: "#4b4558" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const b = breakdown || {};

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: mobile ? "24px 16px 80px" : "40px 28px 80px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: mobile ? 22 : 30, fontWeight: 900, letterSpacing: -1.5, color: "#1a1523", marginBottom: 4 }}>
            {greeting}{intel?.name ? `, ${intel.name}` : ""}.
          </h1>
          {agent && <div style={{ fontSize: 13, color: agent.color, fontWeight: 600 }}>Working with {agent.name} · {agent.role}</div>}
        </div>
        <button onClick={onNewProject} style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "8px 16px", fontSize: 13, color: "#4b4558", cursor: "pointer", fontWeight: 500 }}>+ New project</button>
      </div>

      {/* Goal */}
      {intel?.goal && (
        <div style={{ background: agent ? `${agent.color}06` : "rgba(91,33,182,0.04)", border: `1px solid ${agent ? agent.color + "20" : "rgba(91,33,182,0.12)"}`, borderLeft: `4px solid ${agent?.color || "#5b21b6"}`, borderRadius: 14, padding: mobile ? "14px 16px" : "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: agent?.color || "#5b21b6", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 }}>Your goal</div>
          <p style={{ fontSize: mobile ? 15 : 17, fontWeight: 600, color: "#1a1523", lineHeight: 1.6, margin: 0 }}>{intel.goal}</p>
        </div>
      )}

      {/* Insight */}
      {b.insight && (
        <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: mobile ? "14px 16px" : "18px 22px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: agent?.gradient || "linear-gradient(135deg,#5b21b6,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 900 }}>{agent?.emoji || "Ai"}</div>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1523" }}>{agent?.name || "Aiveree"} says</span>
          </div>
          <p style={{ fontSize: 14, color: "#3d3649", lineHeight: 1.75, margin: 0 }}>{b.insight}</p>
        </div>
      )}

      {/* Quick wins */}
      {b.quick_wins?.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 16, color: "#1a1523", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚡</span> Do these today
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            {b.quick_wins.map((qw, i) => (
              <div key={i} style={{ background: "#ffffff", border: "1px solid rgba(5,150,105,0.12)", borderLeft: "3px solid #059669", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#059669", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: "#3d3649", lineHeight: 1.65 }}>{qw}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      {b.milestones?.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 16, color: "#1a1523", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🗺️</span> Your roadmap
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {b.milestones.map((ms, i) => (
              <div key={i} style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, padding: mobile ? "14px 16px" : "16px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: i === 0 ? (agent?.gradient || "linear-gradient(135deg,#5b21b6,#a78bfa)") : "rgba(0,0,0,0.04)", border: i !== 0 ? "1.5px solid rgba(0,0,0,0.1)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: i === 0 ? "#ffffff" : "#8a8396", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1523" }}>{ms.title}</span>
                    {ms.timeframe && <span style={{ fontSize: 11, color: "#8a8396", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>{ms.timeframe}</span>}
                  </div>
                  {ms.tasks?.map((task, ti) => (
                    <div key={ti} style={{ fontSize: 13, color: "#4b4558", display: "flex", gap: 6, alignItems: "flex-start", marginTop: 4 }}>
                      <span style={{ color: agent?.color || "#5b21b6", flexShrink: 0 }}>→</span>
                      <span>{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active sub-agent output */}
      {activeSubAgent && agent && (
        <SubAgentRunner member={activeSubAgent} agent={agent} intel={intel} mobile={mobile} onClose={() => setActiveSubAgent(null)} />
      )}

      {/* Team */}
      {agent && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 16, color: "#1a1523", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{agent.emoji}</span> {agent.name}'s team
          </div>
          <p style={{ fontSize: 13, color: "#8a8396", marginBottom: 14 }}>Tap any specialist to put them to work on your behalf.</p>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(5,1fr)", gap: mobile ? 10 : 12 }}>
            {agent.team.map(member => (
              <button key={member.name}
                onClick={() => setActiveSubAgent(activeSubAgent?.name === member.name ? null : member)}
                style={{ background: activeSubAgent?.name === member.name ? `${agent.color}10` : "#ffffff", border: `1.5px solid ${activeSubAgent?.name === member.name ? agent.color + "40" : "rgba(0,0,0,0.07)"}`, borderRadius: 14, padding: mobile ? "14px 10px" : "16px 14px", cursor: "pointer", textAlign: "center", transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = agent.color + "35"; e.currentTarget.style.boxShadow = `0 4px 16px ${agent.color}12`; }}
                onMouseLeave={e => { if (activeSubAgent?.name !== member.name) { e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)"; e.currentTarget.style.boxShadow = "none"; } }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: mobile ? 13 : 14, color: activeSubAgent?.name === member.name ? agent.color : "#1a1523", marginBottom: 3 }}>{member.name}</div>
                <div style={{ fontSize: 11, color: "#8a8396", lineHeight: 1.4 }}>{member.role}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {b.summary && <p style={{ fontSize: 14, color: "#6b6478", lineHeight: 1.75, marginTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>{b.summary}</p>}
    </div>
  );
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
function Projects({ projects, onSelectProject, onNewProject, mobile }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: mobile ? "24px 16px 80px" : "40px 28px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 900, fontSize: mobile ? 22 : 28, letterSpacing: -1, color: "#1a1523", marginBottom: 4 }}>Your projects</h2>
          <p style={{ fontSize: 14, color: "#8a8396" }}>Every goal you've brought to Aiveree. Each one is a live command centre.</p>
        </div>
        <button onClick={onNewProject} style={{ background: "linear-gradient(135deg,#5b21b6,#a78bfa)", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>+ New project</button>
      </div>

      {projects.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1.5px dashed rgba(91,33,182,0.2)", borderRadius: 20, padding: "48px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1523", marginBottom: 6 }}>No projects yet</div>
          <div style={{ color: "#6b6478", fontSize: 14, marginBottom: 20 }}>Start your first project and your command centre will live here.</div>
          <button onClick={onNewProject} style={{ background: "linear-gradient(135deg,#5b21b6,#a78bfa)", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Build my first command centre</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {projects.map(p => {
            const agent = AGENTS.find(a => a.dashboardType === p.dashboard_type);
            return (
              <div key={p.id} onClick={() => onSelectProject(p)}
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 16, padding: mobile ? 16 : "18px 22px", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start", transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = agent ? agent.color + "30" : "rgba(91,33,182,0.2)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: agent?.gradient || "linear-gradient(135deg,#5b21b6,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{agent?.emoji || "🎯"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1523", marginBottom: 3 }}>{p.name || p.goal}</div>
                  <div style={{ fontSize: 12, color: "#8a8396" }}>{agent ? `${agent.name} · ${agent.role}` : "Command Centre"} · {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
                <span style={{ fontSize: 16, color: "#c4b5fd", flexShrink: 0 }}>→</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const mobile = useIsMobile();
  const [screen, setScreen] = useState("home");
  const [intel, setIntel] = useState(() => getLocalIntel());
  const [projects, setProjects] = useState(() => getProjects());
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => { if (intel?.onboarding_complete) setScreen("dashboard"); }, []);

  const startOnboarding = (agent) => { setSelectedAgent(agent); setScreen("onboarding"); };

  const handleOnboardingComplete = (newIntel) => {
    setIntel(newIntel);
    setProjects(getProjects());
    setScreen("dashboard");
  };

  const handleNewProject = () => { setSelectedAgent(null); setScreen("onboarding"); };

  const handleSelectProject = (project) => {
    const projectIntel = { ...intel, goal: project.goal, dashboard_type: project.dashboard_type };
    setIntel(projectIntel);
    setScreen("dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA", color: "#1a1523", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(91,33,182,0.2);border-radius:4px;}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        input::placeholder,textarea::placeholder{color:rgba(26,21,35,.3);}
        button{font-family:'Plus Jakarta Sans',sans-serif;}
        a{text-decoration:none;}
      `}</style>

      {/* HEADER */}
      <header style={{ background: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 8px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: `0 ${mobile ? 14 : 24}px` }}>
          <div onClick={() => setScreen("home")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0, marginRight: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#5b21b6,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff" }}>Ai</div>
            {!mobile && <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: -0.5, color: "#1a1523" }}>Aiveree</span>}
            <span style={{ fontSize: 9, background: "rgba(91,33,182,0.08)", color: "#5b21b6", padding: "2px 6px", borderRadius: 8, fontWeight: 700 }}>BETA</span>
          </div>

          <nav style={{ flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
            {intel?.onboarding_complete && (
              <>
                <button onClick={() => setScreen("dashboard")} style={{ background: screen === "dashboard" ? "rgba(91,33,182,0.06)" : "transparent", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: screen === "dashboard" ? 700 : 500, color: screen === "dashboard" ? "#5b21b6" : "#6b6478", cursor: "pointer" }}>Dashboard</button>
                <button onClick={() => setScreen("projects")} style={{ background: screen === "projects" ? "rgba(91,33,182,0.06)" : "transparent", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: screen === "projects" ? 700 : 500, color: screen === "projects" ? "#5b21b6" : "#6b6478", cursor: "pointer" }}>Projects</button>
              </>
            )}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {intel?.onboarding_complete ? (
              <button onClick={handleNewProject} style={{ background: "rgba(91,33,182,0.06)", border: "1px solid rgba(91,33,182,0.15)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#5b21b6", cursor: "pointer" }}>+ New project</button>
            ) : (
              <button onClick={() => startOnboarding(null)} style={{ background: "linear-gradient(135deg,#5b21b6,#a78bfa)", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Get started</button>
            )}
          </div>
        </div>
      </header>

      {screen === "home" && <Homepage onStart={startOnboarding} mobile={mobile} />}
      {screen === "onboarding" && <Onboarding selectedAgent={selectedAgent} onComplete={handleOnboardingComplete} mobile={mobile} />}
      {screen === "dashboard" && intel && <CommandCentre intel={intel} mobile={mobile} onNewProject={handleNewProject} />}
      {screen === "projects" && <Projects projects={projects} onSelectProject={handleSelectProject} onNewProject={handleNewProject} mobile={mobile} />}
    </div>
  );
}
