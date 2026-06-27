
CREATE OR REPLACE VIEW public.campaign_leaderboard
WITH (security_invoker = true) AS
WITH customer_totals AS (
  SELECT o.campaign_id,
    o.customer_phone,
    (array_agg(o.customer_name ORDER BY o.created_at DESC, o.id DESC))[1] AS representative_name,
    max(o.delivery_city) AS city,
    sum((item.value ->> 'qty'::text)::integer) AS total_qty,
    min(o.created_at) AS first_order_at
  FROM public.shop_orders o,
    LATERAL jsonb_array_elements(o.items) item(value)
  WHERE o.order_kind = 'preorder'::text
    AND o.status <> 'anulata'::text
    AND o.campaign_id IS NOT NULL
  GROUP BY o.campaign_id, o.customer_phone
)
SELECT
  row_number() OVER (PARTITION BY campaign_id ORDER BY total_qty DESC, first_order_at) AS rank,
  campaign_id,
  CASE
    WHEN char_length(split_part(btrim(COALESCE(representative_name, ''::text)), ' '::text, 1)) <= 3
      THEN '***'::text
    ELSE '***'::text || "right"(split_part(btrim(representative_name), ' '::text, 1), 3)
  END AS anon_id,
  city,
  total_qty
FROM customer_totals;

GRANT SELECT ON public.campaign_leaderboard TO service_role;
;
