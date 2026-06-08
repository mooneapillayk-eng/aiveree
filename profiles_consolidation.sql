-- ─── AIVEREE PROFILES CONSOLIDATION ──────────────────────────────────────────
-- The app standardises on a single `profiles` table (keyed by auth.users.id).
-- The legacy `user_profiles` table is gone — all functions read/write `profiles`.
--
-- `profiles` already carries the auth/credit columns (created by auth.js on
-- signup): id, email, name, credits, is_pro, plan, credit_date, created_at.
-- These ADDs bring across the channel/activity columns the WhatsApp, digest,
-- and events functions expect. Run this BEFORE relying on those features.
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT    DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS whatsapp_number   TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_format   TEXT    DEFAULT 'text',  -- 'text' | 'voice'
  ADD COLUMN IF NOT EXISTS language_code     TEXT    DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone          TEXT    DEFAULT 'Europe/London',
  ADD COLUMN IF NOT EXISTS onboarded_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_at    TIMESTAMPTZ DEFAULT now();

-- Digest / proactive sweeps filter active users by last_active_at and look up
-- recipients by whatsapp_number.
CREATE INDEX IF NOT EXISTS profiles_last_active_idx     ON public.profiles (last_active_at);
CREATE INDEX IF NOT EXISTS profiles_whatsapp_number_idx ON public.profiles (whatsapp_number);
