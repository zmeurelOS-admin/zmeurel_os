-- Weekly sales summaries for farmers who sold products through the association shop.
-- The function is idempotent per farmer and week via farmer_weekly_summary_runs.

CREATE TABLE IF NOT EXISTS public.farmer_weekly_summary_runs (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, week_start)
);

COMMENT ON TABLE public.farmer_weekly_summary_runs IS
  'Idempotency log for weekly farmer sales summaries.';

CREATE INDEX IF NOT EXISTS idx_farmer_weekly_summary_runs_week
  ON public.farmer_weekly_summary_runs (week_start, week_end);

CREATE OR REPLACE FUNCTION public.generate_farmer_weekly_summary(
  p_anchor_date date DEFAULT public.bucharest_today()
)
RETURNS TABLE (
  tenant_id uuid,
  week_start date,
  week_end date,
  notification_id uuid,
  item_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (date_trunc('week', p_anchor_date::timestamp)::date - 7) AS week_start,
      (date_trunc('week', p_anchor_date::timestamp)::date - 1) AS week_end
  ),
  sold_lines AS (
    SELECT
      p.farmer_id AS tenant_id,
      b.week_start,
      b.week_end,
      c.produs_id,
      p.nume AS product_name,
      p.unitate_vanzare AS unit_label,
      NULLIF(BTRIM(p.approximate_weight), '') AS approximate_weight,
      SUM(c.cantitate_kg)::bigint AS quantity_total
    FROM public.comenzi c
    JOIN public.produse p
      ON p.id = c.produs_id
    JOIN public.tenants t
      ON t.id = p.farmer_id
    CROSS JOIN bounds b
    WHERE c.data_origin = 'magazin_asociatie'
      AND c.produs_id IS NOT NULL
      AND c.status IN ('confirmata', 'programata', 'in_livrare', 'livrata')
      AND c.data_comanda BETWEEN b.week_start AND b.week_end
      AND p.farmer_id IS NOT NULL
      AND COALESCE(t.is_association_approved, false) = true
      AND COALESCE(t.is_demo, false) = false
      AND t.owner_user_id IS NOT NULL
    GROUP BY
      p.farmer_id,
      b.week_start,
      b.week_end,
      c.produs_id,
      p.nume,
      p.unitate_vanzare,
      NULLIF(BTRIM(p.approximate_weight), '')
  ),
  farmer_summaries AS (
    SELECT
      tenant_id,
      week_start,
      week_end,
      jsonb_agg(
        jsonb_build_object(
          'productId', produs_id,
          'productName', product_name,
          'quantity', quantity_total,
          'unitLabel', unit_label,
          'approximateWeight', approximate_weight
        )
        ORDER BY product_name
      ) AS items,
      string_agg(
        CASE
          WHEN approximate_weight IS NOT NULL
            THEN product_name || ' ' || approximate_weight || ' — ' || quantity_total::text || ' ' || unit_label
          ELSE product_name || ' — ' || quantity_total::text || ' ' || unit_label
        END,
        E'\n'
        ORDER BY product_name
      ) AS body_text
    FROM sold_lines
    GROUP BY tenant_id, week_start, week_end
  ),
  new_runs AS (
    INSERT INTO public.farmer_weekly_summary_runs (tenant_id, week_start, week_end)
    SELECT tenant_id, week_start, week_end
    FROM farmer_summaries
    ON CONFLICT (tenant_id, week_start) DO NOTHING
    RETURNING tenant_id, week_start, week_end
  )
  SELECT
    nr.tenant_id,
    nr.week_start,
    nr.week_end,
    public.create_notification(
      t.owner_user_id,
      'weekly_sales_summary',
      format(
        'Rezumat vânzări săptămâna %s - %s',
        to_char(nr.week_start, 'DD.MM.YYYY'),
        to_char(nr.week_end, 'DD.MM.YYYY')
      ),
      fs.body_text,
      jsonb_build_object(
        'weekStart', nr.week_start,
        'weekEnd', nr.week_end,
        'itemCount', jsonb_array_length(fs.items),
        'source', 'magazin_asociatie'
      ),
      'weekly_sales_summary',
      format('%s:%s', nr.week_start::text, nr.tenant_id::text)
    ) AS notification_id,
    jsonb_array_length(fs.items)::integer AS item_count
  FROM new_runs nr
  JOIN farmer_summaries fs
    ON fs.tenant_id = nr.tenant_id
   AND fs.week_start = nr.week_start
   AND fs.week_end = nr.week_end
  JOIN public.tenants t
    ON t.id = nr.tenant_id;
$$;

COMMENT ON FUNCTION public.generate_farmer_weekly_summary(date) IS
  'Generates idempotent weekly sales summaries for farmers with association-shop sales in the previous Monday-Sunday window.';

REVOKE ALL ON FUNCTION public.generate_farmer_weekly_summary(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_farmer_weekly_summary(date) TO service_role;

NOTIFY pgrst, 'reload schema';
