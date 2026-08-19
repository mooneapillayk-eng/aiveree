-- ─── AIVEREE PROJECTS TABLE ───────────────────────────────────────────────────
-- First-class projects — the ongoing threads of a user's work (a seed round, a
-- product launch, first hires). Backs netlify/functions/projects.js.
-- Run in the Supabase SQL editor. Safe to run multiple times.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  description text,
  status      text default 'active',   -- active | paused | done | archived
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists projects_user_idx on public.projects (user_id, created_at desc);

-- Optional links so existing objects can belong to a project (additive, nullable).
-- (memories already carries a project_id column.)
alter table public.workstreams add column if not exists project_id uuid;
alter table public.dashboards  add column if not exists project_id uuid;

-- Row level security. The service-role backend bypasses RLS; this owner-scoped
-- policy only matters if the anon/auth client ever queries projects directly.
alter table public.projects enable row level security;
drop policy if exists "projects_owner" on public.projects;
create policy "projects_owner" on public.projects
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
