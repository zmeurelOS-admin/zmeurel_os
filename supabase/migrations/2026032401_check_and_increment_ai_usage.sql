-- Atomic AI usage check + increment RPC
-- Replaces the two-phase read/write pattern in /api/chat/route.ts.
-- Uses SELECT FOR UPDATE to prevent race conditions when two tabs
-- send messages simultaneously.

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_user_id uuid,
  p_today   date,
  p_limit   int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_date  date;
BEGIN
  -- Caller may only touch their own row
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Lock the row for the duration of this transaction
  SELECT ai_messages_count, last_ai_usage_date
  INTO   v_count, v_date
  FROM   profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  -- New day → reset counter
  IF v_date IS DISTINCT FROM p_today THEN
    v_count := 0;
  END IF;

  -- Hard limit check
  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', p_limit);
  END IF;

  -- Atomic increment
  UPDATE profiles
  SET    ai_messages_count  = v_count + 1,
         last_ai_usage_date = p_today
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', p_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, date, int) TO authenticated;
