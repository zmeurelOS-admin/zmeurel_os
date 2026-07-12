-- MIGRARE DE DATE (reconciliere R1) — 2026-07-11.
-- Cele 2 vânzări directe orfane (comanda_id NULL, total 7,50 kg) au fost scăzute
-- doar din ledgerul vechi miscari_stoc și sunt invizibile în disponibilul derivat.
-- Zmeura respectivă a plecat fizic din fermă, deci disponibilul derivat afișat
-- este cu 7,50 kg prea mare. Corectăm printr-un singur INSERT în ajustari_stoc
-- (tip 'corectie_minus', delta -7,50 kg). Vânzările orfane NU se șterg și NU se
-- modifică — rămân istoric financiar.
--
-- Rulează DUPĂ 20260711100000 (CHECK-ul nou pe tip; 'corectie_minus' există și
-- în setul vechi, deci ordinea nu e critică pentru acest tip).
--
-- Idempotent: dacă ajustarea de reconciliere există deja (după marcajul din
-- motiv), nu se inserează a doua oară.
-- Gardă: dacă disponibilul derivat ar deveni negativ după ajustare, migrarea
-- eșuează (rollback) pentru inspecție manuală.
--
-- Notă: disponibilul se calculează inline cu aceeași formulă ca
-- get_sellable_cal1_stock_summary (RPC-ul cere context autentificat/service_role,
-- indisponibil din SQL editor ca postgres).

do $$
declare
  v_tenant_id constant uuid := '99485d6b-f186-49db-a379-bb9a12d34968';
  v_delta constant numeric := -7.50;
  v_motiv constant text :=
    'Reconciliere vânzări directe pre-unificare: 2 vânzări orfane (7,50 kg) scăzute doar din ledgerul vechi miscari_stoc, invizibile în disponibilul derivat (R1, 2026-07-11)';
  v_recoltat numeric;
  v_livrat_comenzi numeric;
  v_in_livrare_comenzi numeric;
  v_livrat_shop_neprom numeric;
  v_in_livrare_shop_neprom numeric;
  v_ajustari numeric;
  v_disponibil_inainte numeric;
  v_disponibil_dupa numeric;
begin
  if exists (
    select 1
    from public.ajustari_stoc a
    where a.tenant_id = v_tenant_id
      and a.tip = 'corectie_minus'
      and a.motiv like 'Reconciliere vânzări directe pre-unificare%'
  ) then
    raise notice 'Reconciliere R1: ajustarea există deja — nu se inserează a doua oară.';
    return;
  end if;

  select round(coalesce(sum(r.kg_cal1), 0)::numeric, 2)
  into v_recoltat
  from public.recoltari r
  where r.tenant_id = v_tenant_id;

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_livrat_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'livrata';

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_in_livrare_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'in_livrare';

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(so.items)), 0)::numeric, 2)
  into v_livrat_shop_neprom
  from public.shop_orders so
  where so.tenant_id = v_tenant_id
    and so.status = 'livrata'
    and not exists (
      select 1 from public.shop_order_erp_links l
      where l.tenant_id = v_tenant_id and l.shop_order_id = so.id
    );

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(so.items)), 0)::numeric, 2)
  into v_in_livrare_shop_neprom
  from public.shop_orders so
  where so.tenant_id = v_tenant_id
    and so.status = 'in_livrare'
    and not exists (
      select 1 from public.shop_order_erp_links l
      where l.tenant_id = v_tenant_id and l.shop_order_id = so.id
    );

  select round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  into v_ajustari
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id;

  v_disponibil_inainte := round(
    (v_recoltat
      - (v_livrat_comenzi + v_livrat_shop_neprom)
      - (v_in_livrare_comenzi + v_in_livrare_shop_neprom)
      + v_ajustari)::numeric,
    2
  );
  v_disponibil_dupa := round((v_disponibil_inainte + v_delta)::numeric, 2);

  raise notice 'Reconciliere R1: disponibil derivat înainte = % kg, după = % kg.',
    v_disponibil_inainte, v_disponibil_dupa;

  if v_disponibil_dupa < 0 then
    raise exception 'Reconciliere R1: disponibilul ar deveni negativ (% kg) — rollback pentru inspecție manuală.',
      v_disponibil_dupa;
  end if;

  insert into public.ajustari_stoc (tenant_id, data, delta_kg, tip, motiv)
  values (v_tenant_id, current_date, v_delta, 'corectie_minus', v_motiv);

  raise notice 'Reconciliere R1: inserată ajustare corectie_minus de % kg.', v_delta;
end
$$;
