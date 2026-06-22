create or replace function public.check_stock_not_negative()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_total_cal1 numeric;
  v_total_cal2 numeric;
  v_target_tenant_id uuid;
  v_target_depozit text;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.tenant_id is not null then
    v_target_tenant_id := old.tenant_id;
    v_target_depozit := old.depozit;

    select
      coalesce(sum(ms.cantitate_cal1), 0),
      coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = v_target_tenant_id
      and ms.depozit is not distinct from v_target_depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul agregat pe tenant ar deveni negativ: cal1=%s, cal2=%s pentru tenant=%s, depozit=%s',
          v_total_cal1,
          v_total_cal2,
          coalesce(v_target_tenant_id::text, '[null]'),
          coalesce(v_target_depozit, '[null]')
        );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.tenant_id is not null
     and (
       tg_op <> 'UPDATE'
       or new.tenant_id is distinct from old.tenant_id
       or new.depozit is distinct from old.depozit
     ) then
    v_target_tenant_id := new.tenant_id;
    v_target_depozit := new.depozit;

    select
      coalesce(sum(ms.cantitate_cal1), 0),
      coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = v_target_tenant_id
      and ms.depozit is not distinct from v_target_depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul agregat pe tenant ar deveni negativ: cal1=%s, cal2=%s pentru tenant=%s, depozit=%s',
          v_total_cal1,
          v_total_cal2,
          coalesce(v_target_tenant_id::text, '[null]'),
          coalesce(v_target_depozit, '[null]')
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
