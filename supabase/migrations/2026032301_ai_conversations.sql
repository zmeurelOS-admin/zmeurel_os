-- AI conversations table for session memory
-- Used by /api/chat to load the last 3 exchanges per user for continuity.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mesaj_user text,
  raspuns_ai text,
  pathname   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conv_select_own" ON public.ai_conversations;
CREATE POLICY "ai_conv_select_own"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conv_insert_own" ON public.ai_conversations;
CREATE POLICY "ai_conv_insert_own"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Efficient fetch of recent exchanges per user
CREATE INDEX IF NOT EXISTS ai_conversations_user_created_idx
  ON public.ai_conversations(user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
