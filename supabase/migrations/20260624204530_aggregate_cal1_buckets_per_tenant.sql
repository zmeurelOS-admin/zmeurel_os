
-- Task 1: Modifică list_sellable_cal1_buckets_for_reservation să agregeze per tenant
-- (ignorând locatie_id), eliminând discrepanța inter-parcelă.
-- Zmeura este un singur pool comercial — locatie_id contează doar la recoltare.
create or replace function public.list_sellable_cal1_buckets_for_reservation(
  p_tenant_id uuid default null
)
returns table (
  locatie_id uuid,
  produs text,
  depozit text,
  calitate text,
  available_kg numeric
)
language sql
security definer
set search_path = public
as $$
  with resolved_tenant as (
    select coalesce(p_tenant_id, public.current_tenant_id()) as tenant_id
  ),
  ledger as (
    select
      coalesce(nullif(btrim(ms.produs), ''), 'zmeura') as produs,
      coalesce(nullif(btrim(ms.depozit), ''), 'fresh') as depozit,
      round(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        )::numeric,
        2
      ) as ledger_kg
    from public.miscari_stoc ms
    join resolved_tenant tenant
      on tenant.tenant_id = ms.tenant_id
    where ms.calitate = 'cal1'
      and coalesce(ms.depozit, 'fresh') = 'fresh'
      and ms.tip_miscare is not null
      and ms.cantitate_kg is not null
    group by
      coalesce(nullif(btrim(ms.produs), ''), 'zmeura'),
      coalesce(nullif(btrim(ms.depozit), ''), 'fresh')
  ),
  reserved as (
    select
      coalesce(nullif(btrim(sr.produs), ''), 'zmeura') as produs,
      coalesce(nullif(btrim(sr.depozit), ''), 'fresh') as depozit,
      round(sum(sr.cantitate_kg)::numeric, 2) as reserved_kg
    from public.stock_reservations sr
    join resolved_tenant tenant
      on tenant.tenant_id = sr.tenant_id
    where sr.status = 'active'
      and sr.calitate = 'cal1'
    group by
      coalesce(nullif(btrim(sr.produs), ''), 'zmeura'),
      coalesce(nullif(btrim(sr.depozit), ''), 'fresh')
  )
  select
    null::uuid as locatie_id,
    ledger.produs,
    ledger.depozit,
    'cal1'::text as calitate,
    round(greatest(ledger.ledger_kg - coalesce(reserved.reserved_kg, 0), 0)::numeric, 2) as available_kg
  from ledger
  left join reserved
    on reserved.produs = ledger.produs
   and reserved.depozit = ledger.depozit
  where round(greatest(ledger.ledger_kg - coalesce(reserved.reserved_kg, 0), 0)::numeric, 2) > 0
  order by available_kg desc, ledger.produs asc;
$$;
;
