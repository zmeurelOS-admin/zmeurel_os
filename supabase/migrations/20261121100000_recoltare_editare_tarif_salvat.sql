-- Recoltări: editarea păstrează tariful din momentul înregistrării.
--
-- NEAPLICATĂ: o rulează Andrei, după merge.
--
-- Înainte: `update_recoltare_with_stock` citea mereu `culegatori.tarif_lei_kg` (tariful de azi) și
-- recalcula plata cu el. Dacă tariful culegătorului se schimbase între timp, editarea kilogramelor
-- unei recoltări vechi îi schimba și tariful.
--
-- Acum:
--   * același culegător  → plata = kg noi × `pret_lei_pe_kg_snapshot` (tariful salvat în rând);
--   * alt culegător       → tariful curent al noului culegător (ca la creare);
--   * rând vechi fără tarif salvat (`pret_lei_pe_kg_snapshot is null`) → tariful curent, ca înainte.
--
-- Corpul e cel din producție pe 21.11.2026 (`pg_get_functiondef`), cu o singură schimbare:
-- blocul care alege tariful. Semnătura, drepturile (EXECUTE pentru authenticated și service_role),
-- verificările de tenant / scriere, blocajul `stock-mutation` și garda anti-negativ rămân neschimbate.
-- `create or replace` păstrează drepturile existente.
--
-- Anulare: se rulează din nou definiția din producție de dinainte (blocul de tarif fără ramura
-- „același culegător”).

create or replace function public.update_recoltare_with_stock(
  p_recoltare_id uuid,
  p_data date,
  p_parcela_id uuid,
  p_culegator_id uuid,
  p_kg_cal1 numeric default 0,
  p_kg_cal2 numeric default 0,
  p_observatii text default null::text
)
returns public.recoltari
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tarif numeric;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
  v_total_kg numeric := round((greatest(coalesce(p_kg_cal1, 0), 0) + greatest(coalesce(p_kg_cal2, 0), 0))::numeric, 2);
  v_valoare_munca numeric;
  v_recoltare public.recoltari;
  v_current_recoltare public.recoltari;
  v_delta_cal1 numeric;
  v_summary record;
  v_available numeric;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('recoltari')) then
    raise exception 'forbidden_read_only';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_current_recoltare
  from public.recoltari r
  where r.id = p_recoltare_id
    and r.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Recoltarea este invalida pentru tenantul curent.';
  end if;

  perform 1
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  -- Tariful: cel salvat în rând, cât culegătorul rămâne același; altfel tariful curent.
  if p_culegator_id is not distinct from v_current_recoltare.culegator_id
     and v_current_recoltare.pret_lei_pe_kg_snapshot is not null then
    v_tarif := v_current_recoltare.pret_lei_pe_kg_snapshot;
  else
    select c.tarif_lei_kg
    into v_tarif
    from public.culegatori c
    where c.id = p_culegator_id
      and c.tenant_id = v_tenant_id;

    if v_tarif is null then
      raise exception 'Culegatorul nu are tarif setat in profil';
    end if;
  end if;

  -- Gardă anti-negativ pe sursa derivată: reducerea kg_cal1 nu poate coborî
  -- disponibilul sub 0 (echivalentul verificării vechi pe miscari_stoc).
  v_delta_cal1 := round((v_kg_cal1 - coalesce(v_current_recoltare.kg_cal1, 0))::numeric, 2);

  if v_delta_cal1 < 0 then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available + v_delta_cal1 < 0 then
      raise exception 'insufficient_stock_after_edit'
        using hint = 'Stocul ar deveni negativ după editare. Există comenzi care depind de această recoltare.';
    end if;
  end if;

  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);

  update public.recoltari
  set data = p_data,
      parcela_id = p_parcela_id,
      culegator_id = p_culegator_id,
      kg_cal1 = v_kg_cal1,
      kg_cal2 = v_kg_cal2,
      pret_lei_pe_kg_snapshot = round(v_tarif::numeric, 2),
      valoare_munca_lei = v_valoare_munca,
      observatii = nullif(btrim(coalesce(p_observatii, '')), ''),
      updated_at = now()
  where id = p_recoltare_id
    and tenant_id = v_tenant_id
  returning *
  into v_recoltare;

  return v_recoltare;
end;
$function$;

revoke execute on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) from public, anon;
grant execute on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) to authenticated, service_role;
