
-- ============================================================
-- Tabel: ai_usage_log
-- Scopuri: logging consum AI per tenant/user + rate limiting
--          persistent (înlocuiește Map in-memory din rate-limit.ts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id),
  user_id              uuid        NOT NULL REFERENCES auth.users(id),
  feature              text        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  success              boolean     NOT NULL DEFAULT true,
  confidence           text        NULL,
  campuri_lipsa_count  integer     NULL
);

-- Index pentru queries de rate-check (window pe user/tenant + feature)
CREATE INDEX IF NOT EXISTS ai_usage_log_user_feature_created_at_idx
  ON public.ai_usage_log (user_id, feature, created_at);

CREATE INDEX IF NOT EXISTS ai_usage_log_tenant_feature_created_at_idx
  ON public.ai_usage_log (tenant_id, feature, created_at);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Userii văd doar propriile înregistrări
CREATE POLICY "ai_usage_log_select_own"
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert permis pentru useri autentificați (rate limiter scrie direct)
CREATE POLICY "ai_usage_log_insert_own"
  ON public.ai_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Niciun UPDATE/DELETE pentru useri — doar service role poate modifica
-- (nicio politică FOR UPDATE / FOR DELETE = denied by default)

-- ============================================================
-- Funcție: check_and_log_ai_usage
-- Verifică limitele user + tenant și inserează un rând în aceeași
-- tranzacție atomică. Rulează SECURITY DEFINER pentru a putea
-- scrie în ai_usage_log indiferent de RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_log_ai_usage(
  p_user_id              uuid,
  p_tenant_id            uuid,
  p_feature              text,
  p_user_limit           integer,
  p_user_window_minutes  integer,
  p_tenant_limit         integer,
  p_tenant_window_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_count   integer;
  v_tenant_count integer;
  v_user_window_start   timestamptz;
  v_tenant_window_start timestamptz;
BEGIN
  v_user_window_start   := now() - (p_user_window_minutes   || ' minutes')::interval;
  v_tenant_window_start := now() - (p_tenant_window_minutes || ' minutes')::interval;

  -- Numără apelurile recente ale userului (FOR UPDATE SKIP LOCKED pe
  -- un advisory lock per (user, feature) previne race conditions)
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || ':' || p_feature)
  );

  SELECT COUNT(*)
    INTO v_user_count
    FROM public.ai_usage_log
   WHERE user_id   = p_user_id
     AND feature   = p_feature
     AND created_at >= v_user_window_start;

  IF v_user_count >= p_user_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'user_limit',
      'retry_after_seconds',
        GREATEST(1,
          EXTRACT(EPOCH FROM (
            (SELECT MIN(created_at) FROM public.ai_usage_log
              WHERE user_id = p_user_id AND feature = p_feature
                AND created_at >= v_user_window_start)
            + (p_user_window_minutes || ' minutes')::interval
            - now()
          ))::integer
        )
    );
  END IF;

  -- Numără apelurile recente ale tenantului
  SELECT COUNT(*)
    INTO v_tenant_count
    FROM public.ai_usage_log
   WHERE tenant_id = p_tenant_id
     AND feature   = p_feature
     AND created_at >= v_tenant_window_start;

  IF v_tenant_count >= p_tenant_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'tenant_limit',
      'retry_after_seconds',
        GREATEST(1,
          EXTRACT(EPOCH FROM (
            (SELECT MIN(created_at) FROM public.ai_usage_log
              WHERE tenant_id = p_tenant_id AND feature = p_feature
                AND created_at >= v_tenant_window_start)
            + (p_tenant_window_minutes || ' minutes')::interval
            - now()
          ))::integer
        )
    );
  END IF;

  -- Limitele nu sunt depășite — inserează rândul de log
  INSERT INTO public.ai_usage_log (tenant_id, user_id, feature)
    VALUES (p_tenant_id, p_user_id, p_feature);

  RETURN jsonb_build_object('allowed', true);
END;
$$;
;
