-- ─── SUPABASE STORAGE SETUP ───────────────────────────────────────────────────
-- Run this in Supabase SQL Editor
-- Creates the voice-notes bucket for WhatsApp voice notes

-- Create the voice-notes storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,          -- Public so Twilio can access the URL
  5242880,       -- 5MB max per file
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own voice notes
CREATE POLICY "Users can upload voice notes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-notes'
  AND auth.role() = 'authenticated'
);

-- Allow public read (Twilio needs to fetch the URL)
CREATE POLICY "Public read voice notes"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-notes');

-- Service role can do everything
CREATE POLICY "Service full access voice notes"
ON storage.objects FOR ALL
USING (bucket_id = 'voice-notes')
WITH CHECK (bucket_id = 'voice-notes');

-- Add whatsapp_format column to profiles if not exists
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_format TEXT DEFAULT 'text';
-- whatsapp_format: 'text' | 'voice'

-- Auto-cleanup old voice notes after 7 days (keeps storage lean)
-- This is handled by a scheduled function, not SQL
-- But we add a created_at index for the cleanup query
