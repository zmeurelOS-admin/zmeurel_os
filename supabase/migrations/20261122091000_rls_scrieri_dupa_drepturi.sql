-- RLS: scrierile urmează drepturile pe module (promptul 24, partea 2).
--
-- NEAPLICATĂ: o rulează Andrei, după migrarea 20261122090000 (independente, dar așa am testat logica).
--
-- Regula de azi pe aceste tabele era doar `tenant_id = current_tenant_id()`. Pentru un operator,
-- `current_tenant_id()` întoarce ferma în care lucrează, deci ORICE operator (și unul doar-citire, și unul
-- fără niciun drept pe modul) putea scrie direct prin API (cheia publică + sesiunea lui):
--   - vânzări, cheltuieli, investiții (bani; module doar ale proprietarului);
--   - `miscari_stoc` (ledgerul vechi), actele fermei, campaniile magazinului, nomenclatoarele;
--   - culturile, etapele, jurnalele de solar, stadiile și configurările de sezon ale parcelelor (fără „Scrie” pe Parcele);
--   - `farm_members` / `farm_invites`: orice proprietar putea adăuga în ferma lui ORICE utilizator ca operator
--     (după id). `current_tenant_id()` preferă apartenența de operator, deci contul acela ar fi fost mutat pe
--     tăcute în ferma lui (vedea și scria acolo). Aplicația nu scrie niciodată aceste tabele cu sesiunea
--     utilizatorului: doar rutele server, cu service role.
--
-- Ce NU se schimbă: citirea (toate politicile SELECT rămân). Politicile superadminului și ale asociației rămân.
-- Material săditor (`vanzari_butasi*`) NU e atins aici (în afara promptului): vezi raportul.
--
-- Cine scrie azi, din aplicație, în tabelele atinse (verificat în cod):
--   - vanzari: `setVanzareStatusPlata` (pagina Vânzări, doar proprietar). Restul prin RPC SECURITY DEFINER.
--   - cheltuieli_diverse: Cheltuieli (proprietar) și cheltuiala automată „Manoperă cules” scrisă după o recoltare
--     (`queries/manopera-auto.ts`), deci și de operatorul cu „Scrie” pe Recoltări. Politica de mai jos îl lasă
--     să scrie DOAR acel rând automat.
--   - investitii, shop_campaigns, farmer_legal_docs: doar proprietarul (operatorul n-are aceste module).
--   - miscari_stoc, farmer_weekly_summary_runs, crops, crop_varieties, nomenclatoare, activitati_extra_season:
--     aplicația nu le scrie direct (doar RPC SECURITY DEFINER, cron sau demo cu service role).
--   - culturi, etape_cultura, culture_stage_logs, solar_climate_logs, stadii_fenologice_parcela,
--     configurari_parcela_sezon: fișa parcelei (Parcele).
--
-- Aplicația merge fără migrare (ca azi). Cu migrarea: proprietarul nu vede nicio diferență; operatorul fără
-- drept primește `42501` acolo unde interfața oricum nu-l lasă.
-- Aditivă pentru date: doar politici. Se poate rula de mai multe ori (drop if exists + create).

-- ─── Doar proprietarul ────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'vanzari',
    'investitii',
    'miscari_stoc',
    'farmer_weekly_summary_runs',
    'nomenclatoare'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_delete', t);
  end loop;
end $$;

-- crops / crop_varieties: aceleași trei politici de fermă; cele ale superadminului rămân.
do $$
declare
  t text;
begin
  foreach t in array array['crops', 'crop_varieties'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_delete', t);
  end loop;
end $$;

-- shop_campaigns: politica de update avea alt nume.
drop policy if exists "authenticated can update own campaigns" on public.shop_campaigns;
drop policy if exists shop_campaigns_insert on public.shop_campaigns;
drop policy if exists shop_campaigns_update on public.shop_campaigns;
drop policy if exists shop_campaigns_delete on public.shop_campaigns;
create policy shop_campaigns_insert on public.shop_campaigns for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy shop_campaigns_update on public.shop_campaigns for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy shop_campaigns_delete on public.shop_campaigns for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- farmer_legal_docs: politicile „_own” (rol public) devin ale proprietarului; cele ale superadminului rămân.
drop policy if exists farmer_legal_docs_insert_own on public.farmer_legal_docs;
drop policy if exists farmer_legal_docs_update_own on public.farmer_legal_docs;
drop policy if exists farmer_legal_docs_delete_own on public.farmer_legal_docs;
create policy farmer_legal_docs_insert_own on public.farmer_legal_docs for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy farmer_legal_docs_update_own on public.farmer_legal_docs for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy farmer_legal_docs_delete_own on public.farmer_legal_docs for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── Cheltuieli: proprietarul; operatorul cu „Scrie” pe Recoltări doar rândul automat de manoperă ────
-- Categoria și marcajul sunt cele din `src/lib/supabase/queries/manopera-auto.ts`
-- (`AUTO_MANOPERA_CATEGORY`, `AUTO_MANOPERA_DESCRIPTION_MARKER`).

drop policy if exists cheltuieli_diverse_insert on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_update on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_delete on public.cheltuieli_diverse;
create policy cheltuieli_diverse_insert on public.cheltuieli_diverse for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  );
create policy cheltuieli_diverse_update on public.cheltuieli_diverse for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  );
create policy cheltuieli_diverse_delete on public.cheltuieli_diverse for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  );

-- ─── Fișa parcelei: proprietarul sau operatorul cu „Scrie” pe Parcele ─────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'culturi',
    'etape_cultura',
    'culture_stage_logs',
    'solar_climate_logs',
    'stadii_fenologice_parcela',
    'configurari_parcela_sezon'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id()
                     and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id()
                and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))
         with check (tenant_id = public.current_tenant_id()
                     and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id()
                and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))',
      t || '_delete', t);
  end loop;
end $$;

-- ─── Lucrările din afara sezonului: proprietarul sau operatorul cu „Scrie” pe Lucrări ─────────────

drop policy if exists activitati_extra_season_insert on public.activitati_extra_season;
drop policy if exists activitati_extra_season_update on public.activitati_extra_season;
drop policy if exists activitati_extra_season_delete on public.activitati_extra_season;
create policy activitati_extra_season_insert on public.activitati_extra_season for insert to authenticated
  with check (tenant_id = public.current_tenant_id()
              and (public.is_tenant_owner(tenant_id) or public.operator_can_write('activitati')));
create policy activitati_extra_season_update on public.activitati_extra_season for update to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_tenant_owner(tenant_id) or public.operator_can_write('activitati')))
  with check (tenant_id = public.current_tenant_id()
              and (public.is_tenant_owner(tenant_id) or public.operator_can_write('activitati')));
create policy activitati_extra_season_delete on public.activitati_extra_season for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── Echipa: proprietarul citește; scrie doar serverul (service role) ─────────────────────────────

drop policy if exists "only owner can manage farm_members" on public.farm_members;
drop policy if exists farm_members_owner_select on public.farm_members;
create policy farm_members_owner_select on public.farm_members for select to authenticated
  using (tenant_id in (select t.id from public.tenants t where t.owner_user_id = (select auth.uid())));

drop policy if exists "only owner can manage farm_invites" on public.farm_invites;
drop policy if exists farm_invites_owner_select on public.farm_invites;
create policy farm_invites_owner_select on public.farm_invites for select to authenticated
  using (tenant_id in (select t.id from public.tenants t where t.owner_user_id = (select auth.uid())));

-- „member can read own row” pe farm_members rămâne.

notify pgrst, 'reload schema';

-- Verificarea de după aplicare (în demo, cu un operator din link fără Parcele și fără Recoltări):
--   - proprietarul: o vânzare rapidă, o cheltuială, o investiție, o cultură nouă în fișa parcelei, actele: merg;
--   - operatorul cu „Scrie” pe Recoltări: o recoltare se salvează, iar rândul „Manoperă cules” apare în Cheltuieli;
--   - același operator, prin API: `insert` în `vanzari` / `investitii` / `culturi` → 42501.
