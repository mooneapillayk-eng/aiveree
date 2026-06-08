-- ─── AIVEREE WORKSTREAMS TABLE ───────────────────────────────────────────────
-- Persists the real work Aiveree completes, so it survives across sessions.
-- Run this in the Supabase SQL editor.

create table if not exists public.workstreams (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  goal_key    text not null,
  task_index  int  not null,
  title       text,
  detail      text,
  status      text default 'complete',
  result      text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, goal_key, task_index)
);

create index if not exists workstreams_user_goal_idx
  on public.workstreams (user_id, goal_key);

-- Remembered dashboard so its structure stays stable across sessions
create table if not exists public.dashboards (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  goal_key    text not null,
  dashboard   jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, goal_key)
);

create index if not exists dashboards_user_goal_idx
  on public.dashboards (user_id, goal_key);

-- Row level security
alter table public.workstreams enable row level security;
alter table public.dashboards enable row level security;

drop policy if exists "workstreams_service" on public.workstreams;
create policy "workstreams_service" on public.workstreams
  for all using (true) with check (true);

drop policy if exists "dashboards_service" on public.dashboards;
create policy "dashboards_service" on public.dashboards
  for all using (true) with check (true);
