-- ─── AIVEREE SECURITY / INFRA TABLES ─────────────────────────────────────────
-- Run in Supabase. Supports rate limiting in netlify/functions/lib/shared.js.
-- Safe to run multiple times.

create table if not exists rate_limits (
  id          bigint generated always as identity primary key,
  bucket      text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists rate_limits_bucket_created_idx
  on rate_limits (bucket, created_at desc);

-- Optional housekeeping: drop rows older than a day. Schedule via pg_cron if available.
-- delete from rate_limits where created_at < now() - interval '1 day';
