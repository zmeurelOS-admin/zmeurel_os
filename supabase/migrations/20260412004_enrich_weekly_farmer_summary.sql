-- Îmbogățește rezumatul săptămânal al fermierului pentru vânzările din magazinul asociației.
-- Păstrăm aceeași funcție și același contract RETURNS TABLE pentru compatibilitate cu cron-ul existent.

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
      SUM(COALESCE(c.cantitate_kg, 0))::numeric(12, 2) AS quantity_total,
      COUNT(c.id)::integer AS order_count,
      SUM(COALESCE(c.total, 0))::numeric(12, 2) AS total_value_lei
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
      p.unitate_vanzare
  ),
  farmer_summaries AS (
    SELECT
      sl.tenant_id,
      sl.week_start,
      sl.week_end,
      jsonb_agg(
        jsonb_build_object(
          'nume', sl.product_name,
          'unitate', sl.unit_label,
          'cantitate_totala', round(sl.quantity_total, 2),
          'nr_comenzi', sl.order_count,
          'valoare_totala_lei', round(sl.total_value_lei, 2)
        )
        ORDER BY sl.product_name
      ) AS produse,
      SUM(sl.order_count)::integer AS total_comenzi,
      round(SUM(sl.quantity_total), 2) AS total_cantitate,
      round(SUM(sl.total_value_lei), 2) AS total_valoare_lei,
      format('%s - %s', to_char(sl.week_start, 'DD.MM'), to_char(sl.week_end, 'DD.MM.YYYY')) AS saptamana,
      string_agg(
        format(
          '%s — %s %s · %s comenzi · %s lei',
          sl.product_name,
          trim(to_char(round(sl.quantity_total, 2), 'FM999999990.##')),
          sl.unit_label,
          sl.order_count,
          trim(to_char(round(sl.total_value_lei, 2), 'FM999999990.##'))
        ),
        E'\n'
        ORDER BY sl.product_name
      ) AS body_text
    FROM sold_lines sl
    GROUP BY sl.tenant_id, sl.week_start, sl.week_end
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
      format('Rezumat vânzări săptămâna %s', fs.saptamana),
      format(
        'Total: %s comenzi, %s unități, %s lei.%s%s',
        fs.total_comenzi,
        trim(to_char(fs.total_cantitate, 'FM999999990.##')),
        trim(to_char(fs.total_valoare_lei, 'FM999999990.##')),
        E'\n',
        fs.body_text
      ),
      jsonb_build_object(
        'weekStart', nr.week_start,
        'weekEnd', nr.week_end,
        'saptamana', fs.saptamana,
        'source', 'magazin_asociatie',
        'produse', fs.produse,
        'itemCount', jsonb_array_length(fs.produse),
        'total_comenzi', fs.total_comenzi,
        'total_cantitate', fs.total_cantitate,
        'total_valoare_lei', fs.total_valoare_lei
      ),
      'weekly_sales_summary',
      format('%s:%s', nr.week_start::text, nr.tenant_id::text)
    ) AS notification_id,
    jsonb_array_length(fs.produse)::integer AS item_count
  FROM new_runs nr
  JOIN farmer_summaries fs
    ON fs.tenant_id = nr.tenant_id
   AND fs.week_start = nr.week_start
   AND fs.week_end = nr.week_end
  JOIN public.tenants t
    ON t.id = nr.tenant_id;
$$;

COMMENT ON FUNCTION public.generate_farmer_weekly_summary(date) IS
  'Generates idempotent weekly sales summaries for farmers with association-shop sales in the previous Monday-Sunday window, including totals and per-product breakdowns.';

REVOKE ALL ON FUNCTION public.generate_farmer_weekly_summary(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_farmer_weekly_summary(date) TO service_role;

NOTIFY pgrst, 'reload schema';
