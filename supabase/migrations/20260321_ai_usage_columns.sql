-- Add AI usage tracking columns to profiles table
-- These are used by /api/chat to enforce the 20 messages/day rate limit per user.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_messages_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ai_usage_date date;
