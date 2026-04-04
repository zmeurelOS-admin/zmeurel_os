-- Opțional: realiniază tenant_metrics_daily după ce ai setat exclude_from_analytics,
-- pentru o fereastră de date (înlocuiește datele).
-- Rulează în SQL Editor ca superuser / service context permis.

do $$
declare
  d date := current_date - 30;
begin
  while d <= current_date loop
    perform public.refresh_tenant_metrics_daily(d);
    d := d + 1;
  end loop;
end $$;
