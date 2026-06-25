-- Fix 3: elimină p_limit din semnătură, funcția calculează singură limita
-- pe baza is_superadmin din profiles (20 normal, 60 superadmin).

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_user_id uuid,
  p_today   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count         int;
  v_date          date;
  v_is_superadmin boolean;
  v_limit         int;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT ai_messages_count, last_ai_usage_date, COALESCE(is_superadmin, false)
  INTO   v_count, v_date, v_is_superadmin
  FROM   public.profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  v_limit := CASE WHEN v_is_superadmin THEN 60 ELSE 20 END;

  IF v_date IS DISTINCT FROM p_today THEN
    v_count := 0;
  END IF;

  IF v_count >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', v_limit);
  END IF;

  UPDATE public.profiles
  SET    ai_messages_count  = v_count + 1,
         last_ai_usage_date = p_today
  WHERE  id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', v_limit);
END;
$$;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(uuid, date, int) FROM PUBLIC;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
  BEGIN
    REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(uuid, date, int) FROM anon;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
  BEGIN
    REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(uuid, date, int) FROM authenticated;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
