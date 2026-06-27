
-- Fix 1: elimină p_user_limit/p_tenant_limit din semnătură, hardcodează limitele,
-- adaugă verificare auth.uid() și GRANT explicit.

CREATE OR REPLACE FUNCTION public.check_and_log_ai_usage(
  p_user_id              uuid,
  p_tenant_id            uuid,
  p_feature              text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Limite hardcodate — nu acceptăm parametri din exterior
  v_user_limit              integer := 20;
  v_user_window_minutes     integer := 10;
  v_tenant_limit            integer := 100;
  v_tenant_window_minutes   integer := 60;
  v_user_count              integer;
  v_tenant_count            integer;
  v_user_window_start       timestamptz;
  v_tenant_window_start     timestamptz;
BEGIN
  -- Verificare autentificare: caller trebuie să fie userul pentru care înregistrează
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_user_window_start   := now() - (v_user_window_minutes   || ' minutes')::interval;
  v_tenant_window_start := now() - (v_tenant_window_minutes || ' minutes')::interval;

  -- Lock per (user, feature) pentru a preveni race conditions
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || ':' || p_feature)
  );

  SELECT COUNT(*)
    INTO v_user_count
    FROM public.ai_usage_log
   WHERE user_id   = p_user_id
     AND feature   = p_feature
     AND created_at >= v_user_window_start;

  IF v_user_count >= v_user_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'user_limit',
      'retry_after_seconds',
        GREATEST(1,
          EXTRACT(EPOCH FROM (
            (SELECT MIN(created_at) FROM public.ai_usage_log
              WHERE user_id = p_user_id AND feature = p_feature
                AND created_at >= v_user_window_start)
            + (v_user_window_minutes || ' minutes')::interval
            - now()
          ))::integer
        )
    );
  END IF;

  SELECT COUNT(*)
    INTO v_tenant_count
    FROM public.ai_usage_log
   WHERE tenant_id = p_tenant_id
     AND feature   = p_feature
     AND created_at >= v_tenant_window_start;

  IF v_tenant_count >= v_tenant_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'tenant_limit',
      'retry_after_seconds',
        GREATEST(1,
          EXTRACT(EPOCH FROM (
            (SELECT MIN(created_at) FROM public.ai_usage_log
              WHERE tenant_id = p_tenant_id AND feature = p_feature
                AND created_at >= v_tenant_window_start)
            + (v_tenant_window_minutes || ' minutes')::interval
            - now()
          ))::integer
        )
    );
  END IF;

  INSERT INTO public.ai_usage_log (tenant_id, user_id, feature)
    VALUES (p_tenant_id, p_user_id, p_feature);

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Revocă vechea semnătură cu 7 parametri (dacă există) și semnătura nouă de la public/anon
REVOKE ALL ON FUNCTION public.check_and_log_ai_usage(uuid, uuid, text, integer, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_log_ai_usage(uuid, uuid, text, integer, integer, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.check_and_log_ai_usage(uuid, uuid, text, integer, integer, integer, integer) FROM authenticated;

REVOKE ALL ON FUNCTION public.check_and_log_ai_usage(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_log_ai_usage(uuid, uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.check_and_log_ai_usage(uuid, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
;
