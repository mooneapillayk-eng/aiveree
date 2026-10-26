-- ─── AIVEREE AGENT TABLES ─────────────────────────────────────────────────────
-- Run once in the Supabase SQL editor. The execution service writes here; the
-- app's agent-status function reads here. Service-role access only (no RLS
-- policies added, since only server-side service-role keys touch these tables).

create table if not exists agent_runs (
  id                 text primary key,
  user_id            uuid references auth.users(id) on delete cascade,
  task               text not null,
  start_url          text,
  status             text not null default 'running',   -- running | needs_login | needs_approval | complete | stopped | error
  latest_shot        text,                               -- base64 PNG of the current screen (live view)
  thought            text,                               -- the agent's latest note
  checkpoint_kind    text,                               -- login | approval | null
  checkpoint_summary text,
  checkpoint_details text,
  live_url           text,                               -- cloud-browser live view (for login takeover)
  result             text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists agent_runs_user_idx on agent_runs (user_id, updated_at desc);

create table if not exists agent_run_steps (
  id         bigint generated always as identity primary key,
  run_id     text references agent_runs(id) on delete cascade,
  action     text,
  url        text,
  created_at timestamptz default now()
);
create index if not exists agent_run_steps_run_idx on agent_run_steps (run_id, created_at);
