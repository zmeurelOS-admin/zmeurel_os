-- Safety note: before applying this migration on a live environment, run a read-only
-- stock audit query to document any existing negative stock buckets. This migration
-- only adds a deferred constraint trigger and does not modify existing data.

create or replace function public.check_stock_not_negative()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_total_cal1 numeric;
  v_total_cal2 numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.tenant_id is not null then
    select
      coalesce(sum(ms.cantitate_cal1), 0),
      coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = old.tenant_id
      and ms.produs is not distinct from old.produs
      and ms.locatie_id is not distinct from old.locatie_id
      and ms.depozit is not distinct from old.depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul ar deveni negativ: cal1=%s, cal2=%s pentru produs=%s, locatie=%s, depozit=%s',
          v_total_cal1,
          v_total_cal2,
          coalesce(old.produs, '[null]'),
          coalesce(old.locatie_id::text, '[null]'),
          coalesce(old.depozit, '[null]')
        );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.tenant_id is not null
     and (
       tg_op <> 'UPDATE'
       or new.tenant_id is distinct from old.tenant_id
       or new.produs is distinct from old.produs
       or new.locatie_id is distinct from old.locatie_id
       or new.depozit is distinct from old.depozit
     ) then
    select
      coalesce(sum(ms.cantitate_cal1), 0),
      coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = new.tenant_id
      and ms.produs is not distinct from new.produs
      and ms.locatie_id is not distinct from new.locatie_id
      and ms.depozit is not distinct from new.depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul ar deveni negativ: cal1=%s, cal2=%s pentru produs=%s, locatie=%s, depozit=%s',
          v_total_cal1,
          v_total_cal2,
          coalesce(new.produs, '[null]'),
          coalesce(new.locatie_id::text, '[null]'),
          coalesce(new.depozit, '[null]')
        );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists prevent_negative_stock on public.miscari_stoc;
create constraint trigger prevent_negative_stock
  after insert or update or delete on public.miscari_stoc
  deferrable initially deferred
  for each row
  execute function public.check_stock_not_negative();

notify pgrst, 'reload schema';
