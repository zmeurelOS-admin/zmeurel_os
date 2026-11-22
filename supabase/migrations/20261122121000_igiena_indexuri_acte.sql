-- Promptul 27, C: igiena bazei de date. Doar aditiv: indexuri noi și `is_legal_docs_complete` restrânsă.
-- Nu atinge date. Nu modifică funcțiile `SECURITY DEFINER` chemate de aplicație și nici politicile RLS.
--
-- NEAPLICATĂ: o rulează Andrei. Se poate aplica înainte sau după merge: aplicația merge la fel cu sau fără ea
-- (indexurile doar grăbesc; `is_legal_docs_complete` întoarce același rezultat tuturor celor care o cheamă azi).
-- Se poate rula de mai multe ori (`if not exists`, `create or replace`).
-- Pornită din producție, doar cu citire (`pg_constraint`, `pg_index`, `pg_proc`, `pg_policies`), pe 22.11.2026.
--
-- ── C1. Indexuri pe cheile străine fără niciun index care să înceapă cu ele ─────────────────────────────────
-- De ce: filtrele aplicației și ale RLS (`tenant_id = current_tenant_id()`), join-urile, iar la ștergerea
-- rândului părinte (o parcelă, o comandă, o fermă) Postgres caută copiii după cheie: fără index, citește tot tabelul.
-- Fără `concurrently` (migrarea rulează într-o tranzacție); tabelele sunt mici (sub 2.000 de rânduri azi).
-- Pentru coloanele aproape mereu goale, index parțial (`where … is not null`): mai mic, folosit la fel.
-- Lăsate deoparte, intenționat: `created_by` / `updated_by` (cerința), `audit_logs.actor_user_id` (la fel),
-- tabelele asociației și ale magazinului (nu se ating în promptul 27), `stock_reservations` (moștenire),
-- `farm_invites.used_by_user_id` și `alert_dismissals.user_id` (căutate mereu împreună cu `tenant_id`, au deja
-- indexuri compuse).

begin;

-- tenant_id fără index (RLS filtrează pe el la fiecare citire; ștergerea fermei caută după el).
create index if not exists ai_conversations_tenant_id_idx on public.ai_conversations (tenant_id);
create index if not exists capcane_montate_tenant_id_idx on public.capcane_montate (tenant_id);
create index if not exists capcane_verificari_tenant_id_idx on public.capcane_verificari (tenant_id);
create index if not exists etape_cultura_tenant_id_idx on public.etape_cultura (tenant_id);

-- Comenzi: fișa clientului (comenzile unui client), stocul pe produs, livrarea parțială (comanda părinte),
-- legătura cu vânzarea creată la livrare.
create index if not exists comenzi_client_id_idx on public.comenzi (client_id);
create index if not exists comenzi_produs_id_idx on public.comenzi (produs_id);
create index if not exists comenzi_parent_comanda_id_idx on public.comenzi (parent_comanda_id) where parent_comanda_id is not null;
create index if not exists comenzi_linked_vanzare_id_idx on public.comenzi (linked_vanzare_id) where linked_vanzare_id is not null;

-- Vânzări pe produs (stoc, rapoarte).
create index if not exists vanzari_produs_id_idx on public.vanzari (produs_id);

-- Analizele la fructe: fișa parcelei (analizele unei parcele) și ștergerea parcelei (cascadă).
create index if not exists analize_fructe_parcele_parcela_id_idx on public.analize_fructe_parcele (parcela_id);

-- Tratamente: capcanele unei aplicări, produsul (catalog), cultura, linia de plan, mișcarea de stoc.
create index if not exists capcane_montate_aplicare_id_idx on public.capcane_montate (aplicare_id) where aplicare_id is not null;
create index if not exists capcane_verificari_aplicare_id_idx on public.capcane_verificari (aplicare_id) where aplicare_id is not null;
create index if not exists aplicari_tratament_produs_id_idx on public.aplicari_tratament (produs_id) where produs_id is not null;
create index if not exists aplicari_tratament_cultura_id_idx on public.aplicari_tratament (cultura_id) where cultura_id is not null;
create index if not exists aplicari_tratament_plan_linie_id_idx on public.aplicari_tratament (plan_linie_id) where plan_linie_id is not null;
create index if not exists aplicari_tratament_stoc_mutatie_id_idx on public.aplicari_tratament (stoc_mutatie_id) where stoc_mutatie_id is not null;
create index if not exists aplicari_tratament_produse_stoc_mutatie_id_idx on public.aplicari_tratament_produse (stoc_mutatie_id) where stoc_mutatie_id is not null;
create index if not exists planuri_tratament_linii_produs_id_idx on public.planuri_tratament_linii (produs_id) where produs_id is not null;
create index if not exists parcele_planuri_plan_id_idx on public.parcele_planuri (plan_id);

-- Parcelele (solarii): jurnalele pe unitate și butașii pe parcela-sursă.
create index if not exists culture_stage_logs_unitate_id_idx on public.culture_stage_logs (unitate_id);
create index if not exists solar_climate_logs_unitate_id_idx on public.solar_climate_logs (unitate_id);
create index if not exists vanzari_butasi_parcela_sursa_id_idx on public.vanzari_butasi (parcela_sursa_id) where parcela_sursa_id is not null;

-- GDPR: consimțămintele unei comenzi (ștergerea comenzii caută după ele).
create index if not exists consent_events_order_id_idx on public.consent_events (order_id) where order_id is not null;

-- Proprietarul fermei: `isFarmOwner`, `is_tenant_owner()` din RLS, ștergerea contului.
create index if not exists tenants_owner_user_id_idx on public.tenants (owner_user_id);

-- ── C2. `is_legal_docs_complete(p_tenant_id)`: doar cine are nevoie ────────────────────────────────────────
-- Înainte: orice cont logat afla dacă actele oricărei ferme sunt complete. Acum răspunsul adevărat îl primesc:
--   * serverul (service role) și editorul SQL: fără utilizator în JWT, dar nu `anon` (seed-ul demo, rutele admin);
--   * proprietarul fermei;
--   * membrii activi ai fermei (`farm_members.is_active`): operatorul care activează un produs trece prin
--     declanșatorul `produse_legal_docs_guard`;
--   * membrii asociației (`association_members`, aceeași regulă ca `list_association_farmer_legal_status`):
--     rutele `/api/association/producers`, `/api/association/products`, `/api/association/products/create`
--     o cheamă cu sesiunea staff-ului pentru ferma producătorului;
--   * superadminul (`is_superadmin()`).
-- Oricine altcineva primește `false`.
-- Cine o cheamă (verificat 22.11.2026): cele 3 rute ale asociației (sesiunea utilizatorului) și declanșatorul
-- `enforce_produse_requires_legal_docs` (SECURITY DEFINER; `auth.uid()` rămâne al celui care scrie în `produse`).
-- Nicio altă funcție, vedere sau pagină publică.

create or replace function public.is_legal_docs_complete(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when (auth.uid() is null and coalesce(auth.role(), '') <> 'anon')
      or exists (select 1 from public.tenants t where t.id = p_tenant_id and t.owner_user_id = auth.uid())
      or exists (
        select 1
        from public.farm_members fm
        where fm.tenant_id = p_tenant_id
          and fm.user_id = auth.uid()
          and coalesce(fm.is_active, false) = true
      )
      or exists (select 1 from public.association_members am where am.user_id = auth.uid())
      or public.is_superadmin(auth.uid())
    then coalesce((
      select fld.legal_docs_complete
      from public.farmer_legal_docs fld
      where fld.tenant_id = p_tenant_id
    ), false)
    else false
  end;
$function$;

revoke execute on function public.is_legal_docs_complete(uuid) from public, anon;
grant execute on function public.is_legal_docs_complete(uuid) to authenticated, service_role;

-- ── C3. `clienti_merge_audit`: neschimbat ──────────────────────────────────────────────────────────────────
-- RLS pornit, fără politici. Scrie în el doar `merge_clienti_duplicates`, chemată de scriptul de mentenanță
-- `scripts/dedupe-clienti-merge.ts` cu service role (care ocolește RLS). Aplicația nu îl citește (niciun
-- `from('clienti_merge_audit')` în `src`). Deci rămâne doar pentru service role, cum a fost gândit în
-- `20260705120000_clienti_merge_audit.sql`.

commit;
