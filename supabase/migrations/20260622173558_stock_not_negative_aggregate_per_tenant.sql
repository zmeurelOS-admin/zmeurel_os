
create or replace function public.check_stock_not_negative()
returns trigger language plpgsql set search_path to 'public' as $function$
declare
  v_total_cal1 numeric;
  v_total_cal2 numeric;
begin
  -- Verificare pe TOTAL tenant (agregat pe toate parcelele), grupat doar pe depozit.
  -- Toata zmeura e un singur pool comercial, indiferent de parcela de origine.
  if tg_op in ('UPDATE', 'DELETE') and old.tenant_id is not null then
    select coalesce(sum(ms.cantitate_cal1), 0), coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = old.tenant_id
      and ms.depozit is not distinct from old.depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul total ar deveni negativ: cal1=%s, cal2=%s pentru depozit=%s',
          v_total_cal1, v_total_cal2, coalesce(old.depozit, '[null]')
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
    select coalesce(sum(ms.cantitate_cal1), 0), coalesce(sum(ms.cantitate_cal2), 0)
    into v_total_cal1, v_total_cal2
    from public.miscari_stoc ms
    where ms.tenant_id = new.tenant_id
      and ms.depozit is not distinct from new.depozit;

    if v_total_cal1 < 0 or v_total_cal2 < 0 then
      raise exception 'negative_stock'
        using hint = format(
          'Stocul total ar deveni negativ: cal1=%s, cal2=%s pentru depozit=%s',
          v_total_cal1, v_total_cal2, coalesce(new.depozit, '[null]')
        );
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;
;
