-- Fix 2: adaugă verificare cross-user pe create_notification.
-- Un user autentificat nu poate trimite notificări pentru alt user.
-- service_role (auth.uid() IS NULL) poate notifica orice user.

CREATE OR REPLACE FUNCTION public.create_notification (
  p_user_id     uuid,
  p_type        text,
  p_title       text,
  p_body        text    DEFAULT NULL,
  p_data        jsonb   DEFAULT '{}'::jsonb,
  p_entity_type text    DEFAULT NULL,
  p_entity_id   text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_body, COALESCE(p_data, '{}'::jsonb), p_entity_type, p_entity_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
