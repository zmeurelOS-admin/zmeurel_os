create or replace function public.upsert_plan_tratament_cu_linii(
  p_plan_id uuid, p_plan_data jsonb, p_linii jsonb, p_parcele_ids uuid[], p_an integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_plan_id uuid;
  v_linie jsonb;
  v_produs jsonb;
  v_produse jsonb;
  v_linie_id uuid;
  v_parcela_id uuid;
  v_selected_parcele uuid[] := coalesce(p_parcele_ids, array[]::uuid[]);
  v_existing_assoc_id uuid;
  v_line_items jsonb;
  v_parcele_json jsonb;
  v_plan_json jsonb;
  v_produs_ordine integer;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('tratamente')) then raise exception 'forbidden_read_only'; end if;
  if p_plan_data is null or jsonb_typeof(p_plan_data) <> 'object' then raise exception 'Datele planului sunt invalide.'; end if;
  if p_linii is null or jsonb_typeof(p_linii) <> 'array' then raise exception 'Liniile planului sunt invalide.'; end if;
  if p_an is null or p_an < 2020 or p_an > 2100 then raise exception 'Anul de asociere este invalid.'; end if;
  if p_plan_id is null then
    insert into public.planuri_tratament (tenant_id, nume, cultura_tip, descriere, activ, arhivat, created_by, updated_by)
    values (v_tenant_id, nullif(btrim(p_plan_data ->> 'nume'),''), nullif(btrim(p_plan_data ->> 'cultura_tip'),''), nullif(btrim(p_plan_data ->> 'descriere'),''), coalesce((p_plan_data ->> 'activ')::boolean, true), coalesce((p_plan_data ->> 'arhivat')::boolean, false), v_user_id, v_user_id)
    returning id into v_plan_id;
  else
    perform 1 from public.planuri_tratament where id = p_plan_id and tenant_id = v_tenant_id for update;
    if not found then raise exception 'Planul de tratament nu există în tenantul curent.'; end if;
    update public.planuri_tratament set nume = nullif(btrim(p_plan_data ->> 'nume'),''), cultura_tip = nullif(btrim(p_plan_data ->> 'cultura_tip'),''), descriere = nullif(btrim(p_plan_data ->> 'descriere'),''), activ = coalesce((p_plan_data ->> 'activ')::boolean, activ), arhivat = coalesce((p_plan_data ->> 'arhivat')::boolean, arhivat), updated_by = v_user_id
    where id = p_plan_id and tenant_id = v_tenant_id;
    v_plan_id := p_plan_id;
  end if;
  if v_plan_id is null then raise exception 'Planul nu a putut fi salvat.'; end if;
  delete from public.planuri_tratament_linii where plan_id = v_plan_id and tenant_id = v_tenant_id;
  for v_linie in select value from jsonb_array_elements(p_linii)
  loop
    v_produse := case when jsonb_typeof(v_linie -> 'produse') = 'array' and jsonb_array_length(v_linie -> 'produse') > 0 then v_linie -> 'produse'
      else jsonb_build_array(jsonb_build_object('ordine', 1, 'produs_id', v_linie ->> 'produs_id', 'produs_nume_manual', v_linie ->> 'produs_nume_manual', 'doza_ml_per_hl', v_linie ->> 'doza_ml_per_hl', 'doza_l_per_ha', v_linie ->> 'doza_l_per_ha', 'observatii', v_linie ->> 'observatii')) end;
    insert into public.planuri_tratament_linii (tenant_id, plan_id, ordine, stadiu_trigger, cohort_trigger, tip_interventie, scop, regula_repetare, interval_repetare_zile, numar_repetari_max, fereastra_start_offset_zile, fereastra_end_offset_zile, produs_id, produs_nume_manual, doza_ml_per_hl, doza_l_per_ha, observatii)
    values (v_tenant_id, v_plan_id, coalesce((v_linie ->> 'ordine')::integer, 0), nullif(btrim(v_linie ->> 'stadiu_trigger'),''), nullif(btrim(v_linie ->> 'cohort_trigger'),''), nullif(btrim(v_linie ->> 'tip_interventie'),''), nullif(btrim(v_linie ->> 'scop'),''), coalesce(nullif(btrim(v_linie ->> 'regula_repetare'),''),'fara_repetare'), nullif(v_linie ->> 'interval_repetare_zile','')::integer, nullif(v_linie ->> 'numar_repetari_max','')::integer, nullif(v_linie ->> 'fereastra_start_offset_zile','')::integer, nullif(v_linie ->> 'fereastra_end_offset_zile','')::integer, nullif(v_linie ->> 'produs_id','')::uuid, nullif(btrim(v_linie ->> 'produs_nume_manual'),''), nullif(v_linie ->> 'doza_ml_per_hl','')::numeric, nullif(v_linie ->> 'doza_l_per_ha','')::numeric, nullif(btrim(v_linie ->> 'observatii'),''))
    returning id into v_linie_id;
    v_produs_ordine := 0;
    for v_produs in select value from jsonb_array_elements(v_produse)
    loop
      v_produs_ordine := v_produs_ordine + 1;
      insert into public.planuri_tratament_linie_produse (tenant_id, plan_linie_id, ordine, produs_id, produs_nume_manual, produs_nume_snapshot, substanta_activa_snapshot, tip_snapshot, frac_irac_snapshot, phi_zile_snapshot, doza_ml_per_hl, doza_l_per_ha, observatii)
      select v_tenant_id, v_linie_id, coalesce(nullif(v_produs ->> 'ordine','')::integer, v_produs_ordine), payload.produs_id,
        case when payload.produs_id is null then payload.produs_nume_manual else null end,
        coalesce(produs.nume_comercial, nullif(btrim(v_produs ->> 'produs_nume_snapshot'),''), payload.produs_nume_manual),
        coalesce(produs.substanta_activa, nullif(btrim(v_produs ->> 'substanta_activa_snapshot'),'')),
        coalesce(produs.tip, nullif(btrim(v_produs ->> 'tip_snapshot'),'')),
        coalesce(produs.frac_irac, nullif(btrim(v_produs ->> 'frac_irac_snapshot'),'')),
        coalesce(produs.phi_zile, nullif(v_produs ->> 'phi_zile_snapshot','')::integer),
        nullif(v_produs ->> 'doza_ml_per_hl','')::numeric, nullif(v_produs ->> 'doza_l_per_ha','')::numeric, nullif(btrim(v_produs ->> 'observatii'),'')
      from (select nullif(v_produs ->> 'produs_id','')::uuid as produs_id, nullif(btrim(v_produs ->> 'produs_nume_manual'),'') as produs_nume_manual) payload
      left join public.produse_fitosanitare produs on produs.id = payload.produs_id and (produs.tenant_id is null or produs.tenant_id = v_tenant_id)
      where coalesce(produs.nume_comercial, nullif(btrim(v_produs ->> 'produs_nume_snapshot'),''), payload.produs_nume_manual) is not null;
    end loop;
  end loop;
  update public.parcele_planuri set activ = false where tenant_id = v_tenant_id and plan_id = v_plan_id and an = p_an and activ = true;
  if p_parcele_ids is not null then
    foreach v_parcela_id in array v_selected_parcele
    loop
      perform 1 from public.parcele where id = v_parcela_id and tenant_id = v_tenant_id;
      if not found then raise exception 'Parcela % nu aparține tenantului curent.', v_parcela_id; end if;
      update public.parcele_planuri set activ = false where tenant_id = v_tenant_id and parcela_id = v_parcela_id and an = p_an and activ = true;
      select id into v_existing_assoc_id from public.parcele_planuri where tenant_id = v_tenant_id and parcela_id = v_parcela_id and plan_id = v_plan_id and an = p_an limit 1;
      if v_existing_assoc_id is null then
        insert into public.parcele_planuri (tenant_id, parcela_id, plan_id, an, activ) values (v_tenant_id, v_parcela_id, v_plan_id, p_an, true);
      else
        update public.parcele_planuri set activ = true where id = v_existing_assoc_id and tenant_id = v_tenant_id;
      end if;
      v_existing_assoc_id := null;
    end loop;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'tenant_id', l.tenant_id, 'plan_id', l.plan_id, 'ordine', l.ordine, 'stadiu_trigger', l.stadiu_trigger, 'cohort_trigger', l.cohort_trigger, 'tip_interventie', l.tip_interventie, 'scop', l.scop, 'regula_repetare', l.regula_repetare, 'interval_repetare_zile', l.interval_repetare_zile, 'numar_repetari_max', l.numar_repetari_max, 'fereastra_start_offset_zile', l.fereastra_start_offset_zile, 'fereastra_end_offset_zile', l.fereastra_end_offset_zile, 'produs_id', l.produs_id, 'produs_nume_manual', l.produs_nume_manual, 'doza_ml_per_hl', l.doza_ml_per_hl, 'doza_l_per_ha', l.doza_l_per_ha, 'observatii', l.observatii, 'created_at', l.created_at, 'updated_at', l.updated_at, 'produse', coalesce((select jsonb_agg(to_jsonb(lp) order by lp.ordine asc) from public.planuri_tratament_linie_produse lp where lp.plan_linie_id = l.id and lp.tenant_id = v_tenant_id), '[]'::jsonb)) order by l.ordine asc, l.created_at asc), '[]'::jsonb)
  into v_line_items from public.planuri_tratament_linii l where l.tenant_id = v_tenant_id and l.plan_id = v_plan_id;
  select coalesce(jsonb_agg(jsonb_build_object('id', pp.id, 'tenant_id', pp.tenant_id, 'parcela_id', pp.parcela_id, 'plan_id', pp.plan_id, 'an', pp.an, 'activ', pp.activ, 'created_at', pp.created_at, 'updated_at', pp.updated_at, 'parcela_nume', p.nume_parcela, 'parcela_cod', p.id_parcela, 'suprafata_m2', p.suprafata_m2) order by pp.an desc, p.nume_parcela asc), '[]'::jsonb)
  into v_parcele_json from public.parcele_planuri pp join public.parcele p on p.id = pp.parcela_id and p.tenant_id = v_tenant_id where pp.tenant_id = v_tenant_id and pp.plan_id = v_plan_id and pp.activ = true;
  select jsonb_build_object('id', pt.id, 'tenant_id', pt.tenant_id, 'nume', pt.nume, 'cultura_tip', pt.cultura_tip, 'descriere', pt.descriere, 'activ', pt.activ, 'arhivat', pt.arhivat, 'created_at', pt.created_at, 'updated_at', pt.updated_at, 'created_by', pt.created_by, 'updated_by', pt.updated_by)
  into v_plan_json from public.planuri_tratament pt where pt.id = v_plan_id and pt.tenant_id = v_tenant_id;
  return jsonb_build_object('plan', v_plan_json, 'linii', v_line_items, 'parcele_asociate', v_parcele_json);
end; $$;

revoke all on function public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) from public;
grant execute on function public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) to authenticated, service_role;

notify pgrst, 'reload schema';;
