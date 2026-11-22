-- Citirea banilor și a actelor fermei: doar proprietarul (promptul 25, partea 2; decizia lui Andrei).
--
-- NEAPLICATĂ: o rulează Andrei. Vine după 20261122091000 (scrierile după drepturi), care e deja aplicată.
--
-- Azi, pe `vanzari`, `cheltuieli_diverse`, `investitii`, `farmer_legal_docs`, citirea era doar
-- `tenant_id = current_tenant_id()`. Pentru un operator, `current_tenant_id()` întoarce ferma în care lucrează,
-- deci orice operator (și unul doar-citire) citea prin API toate vânzările cu sume și plăți, cheltuielile,
-- investițiile și actele fermei (nume, telefon, poza certificatului).
--
-- După migrare:
--   - vanzari, investitii, farmer_legal_docs: citește doar proprietarul (superadminul păstrează politica lui pe acte);
--   - cheltuieli_diverse: proprietarul; operatorul cu „Scrie” pe Recoltări citește DOAR rândul automat
--     „Manoperă cules” (`[AUTO_MANOPERA]…`), pe care îl caută, îl actualizează sau îl șterge după o recoltare
--     (`src/lib/supabase/queries/manopera-auto.ts`). Fără citire, UPDATE/DELETE cu filtru nu ar găsi rândul;
--   - Comenzi și Livrări arată starea plății comenzii livrate din vânzarea legată (`comenzi.linked_vanzare_id`).
--     Pentru operator, legătura `vanzare:vanzari!…` din `select` devine `null`; aplicația cere atunci doar
--     câmpurile de plată prin RPC-ul `comenzi_stare_plata` (mai jos), care verifică dreptul pe Comenzi sau Livrări.
--     Tabelul `vanzari` nu se deschide.
--
-- Ce rămâne la fel: scrierile (migrarea 20261122091000), politicile superadminului, funcțiile SECURITY DEFINER
-- (livrarea, încasarea, plata parțială, notificările și cronurile citesc cu drepturile lor). Vederile
-- `vanzari_extended` / `vanzari_butasi_extended` sunt `security_invoker`, deci urmează noile politici.
--
-- Aplicația:
--   - FĂRĂ migrare: merge ca azi (operatorul vede tot; RPC-ul nu e chemat, legătura vine plină).
--   - CU migrare, pe codul de azi din `main` (fără completarea prin RPC): proprietarul nu vede nicio diferență;
--     operatorul vede comenzile livrate ca „fără vânzare legată” (fără „Încasat”/„De încasat” pe ele) și fișa
--     clientului fără vânzări. Nimic nu se strică, dar starea plății lipsește pentru operator.
--   - CU migrare și codul din `redesign/decizii-25`: operatorul vede starea plății prin RPC.
--   => Ordinea recomandată: întâi merge (codul tolerează lipsa RPC-ului), apoi migrarea.
--
-- Aditivă pentru date: doar politici și o funcție nouă. Se poate rula de mai multe ori.

-- ─── vanzari, investitii: doar proprietarul ───────────────────────────────────────────────────────

drop policy if exists vanzari_select on public.vanzari;
create policy vanzari_select on public.vanzari for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

drop policy if exists investitii_select on public.investitii;
create policy investitii_select on public.investitii for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── farmer_legal_docs: doar proprietarul (+ superadmin, politica existentă rămâne) ──────────────

drop policy if exists farmer_legal_docs_select_own on public.farmer_legal_docs;
create policy farmer_legal_docs_select_own on public.farmer_legal_docs for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── cheltuieli_diverse: proprietarul; operatorul cu „Scrie” pe Recoltări doar manopera automată ──
-- Categoria și marcajul: `AUTO_MANOPERA_CATEGORY`, `AUTO_MANOPERA_DESCRIPTION_MARKER` din manopera-auto.ts
-- (aceleași condiții ca politicile de scriere din 20261122091000).

drop policy if exists cheltuieli_diverse_select on public.cheltuieli_diverse;
create policy cheltuieli_diverse_select on public.cheltuieli_diverse for select to authenticated
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

-- ─── Starea plății comenzilor, pentru Comenzi și Livrări ─────────────────────────────────────────
-- Întoarce DOAR câmpurile de plată ale vânzării legate de fiecare comandă cerută, din ferma apelantului.
-- Are voie: proprietarul; operatorul activ cu „Citește” sau „Scrie” pe Comenzi sau Livrări (sau cu drepturile
-- vechi, fără listă validă, care însemnau Comenzi + Livrări — aceeași regulă ca `operator_can_write`).
-- Altcineva primește 0 rânduri.

create or replace function public.comenzi_stare_plata(p_comanda_ids uuid[])
returns table (
  comanda_id uuid,
  status_plata text,
  data_incasare date,
  cantitate_kg numeric,
  pret_lei_kg numeric,
  suma_incasata_partial_lei numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_access jsonb;
  v_are_lista_valida boolean;
  v_are_comenzi_livrari boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_comanda_ids is null or cardinality(p_comanda_ids) = 0 then
    return;
  end if;

  if cardinality(p_comanda_ids) > 2000 then
    raise exception 'Prea multe comenzi într-o cerere' using errcode = '22023';
  end if;

  v_tenant := public.current_tenant_id();
  if v_tenant is null then
    return;
  end if;

  if not public.is_tenant_owner(v_tenant) then
    select fm.modules_access
      into v_access
      from public.farm_members fm
     where fm.user_id = v_uid
       and fm.tenant_id = v_tenant
       and fm.is_active = true
       and fm.role = 'operator'
     order by fm.created_at asc
     limit 1;

    if not found then
      return;
    end if;

    if jsonb_typeof(v_access) = 'array' then
      select exists (
        select 1 from jsonb_array_elements(v_access) as a(value)
         where a.value ->> 'module' in (
                 'comenzi','livrari','recoltari','clienti','tratamente','culegatori','produse','activitati','parcele'
               )
           and a.value ->> 'level' in ('read', 'write')
      ) into v_are_lista_valida;

      select exists (
        select 1 from jsonb_array_elements(v_access) as a(value)
         where a.value ->> 'module' in ('comenzi', 'livrari')
           and a.value ->> 'level' in ('read', 'write')
      ) into v_are_comenzi_livrari;

      if v_are_lista_valida and not v_are_comenzi_livrari then
        return;
      end if;
    end if;
  end if;

  return query
    select c.id,
           v.status_plata::text,
           v.data_incasare,
           v.cantitate_kg,
           v.pret_lei_kg,
           v.suma_incasata_partial_lei
      from public.comenzi c
      join public.vanzari v
        on v.id = c.linked_vanzare_id
       and v.tenant_id = c.tenant_id
     where c.tenant_id = v_tenant
       and c.id = any (p_comanda_ids);
end;
$$;

revoke execute on function public.comenzi_stare_plata(uuid[]) from public, anon;
grant execute on function public.comenzi_stare_plata(uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';

-- Verificarea de după aplicare (într-un demo nou, cu un operator din link cu Comenzi + Recoltări pe „Scrie”):
--   - proprietarul: Vânzări, Cheltuieli, Investiții, Rapoarte, Actele fermei arată ca înainte;
--   - operatorul: o livrare și o recoltare cu manoperă automată merg; comanda livrată arată „Încasat”/„De încasat”;
--   - operatorul, prin API (cheia publică + sesiunea lui):
--       select * from vanzari;            -- 0 rânduri
--       select * from investitii;         -- 0 rânduri
--       select * from farmer_legal_docs;  -- 0 rânduri
--       select * from cheltuieli_diverse; -- doar rândurile „Manoperă cules” automate
--   - operatorul fără Comenzi și fără Livrări: `rpc('comenzi_stare_plata', { p_comanda_ids: [...] })` → 0 rânduri.
