
-- W-2: Drop the 10-param overload. The canonical version is the 13-param one
-- (with p_idempotency_key, p_in_suceava, p_preferred_delivery_date).
-- Prod only ever had the 10-param version; it will gain the 13-param on merge.
DROP FUNCTION IF EXISTS public.place_preorder_atomic(
  uuid, uuid, text, text, text, text, text, jsonb, integer, text
);
;
