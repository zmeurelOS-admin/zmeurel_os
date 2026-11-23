-- Planul pe stadii (promptul 30): „E timpul pentru…”, „Sar peste”, excepțiile pe parcelă și ce s-a anunțat deja.
--
-- Refolosește tabelele de plan care există deja în producție (citite pe 23.11.2026: `planuri_tratament` 4 rânduri,
-- `planuri_tratament_linii` 13, `planuri_tratament_linie_produse` 0, `parcele_planuri` 2; 5 aplicări cu
-- `plan_linie_id`). Nu redenumește și nu șterge nimic, nu atinge rânduri existente. Doar adaugă:
--
--   * `planuri_linii_sarite` (linie, parcelă, an, motiv): „Sar peste” pe o linie, pentru o parcelă, în anul acela.
--     Linia rămâne în plan și apare tăiată. Ștergerea rândului = „Nu mai sar” (proprietarul sau cine are „Scrie”).
--   * `planuri_linii_exceptii` (linie, parcelă): linia nu se aplică pe parcela aceea (în niciun an).
--   * `planuri_anuntate` (linie, parcelă, an, repetare): ce a anunțat deja notificarea de dimineață, ca aceeași
--     intervenție să nu fie anunțată de două ori. O scrie doar cronul (service role); utilizatorii doar citesc.
--   * Citirea pe cele 4 tabele de plan existente cere și `operator_can_read('tratamente')` (până acum doar ferma),
--     ca la Capcane și Analize. Proprietarul trece mereu (`operator_can_read` întoarce `true` pentru el).
--     Inserarea / modificarea (proprietarul sau `operator_can_write('tratamente')`) și ștergerea (proprietarul)
--     există deja și rămân.
--
-- Ce exista deja și se folosește așa cum e (nu e nevoie de migrare):
--   * mai multe produse pe o linie: `planuri_tratament_linie_produse` (cu doze și `cantitate_text`); liniile vechi
--     țin produsul pe linie (`produs_id` / `produs_nume_manual`) și aplicația îl citește de acolo când linia n-are
--     rânduri de produse;
--   * repetarea: `regula_repetare` ('fara_repetare' / 'interval'), `interval_repetare_zile`, `numar_repetari_max`;
--   * metoda: `metoda_aplicare`; scopul: `scop`; cohorta (zmeură remontantă): `cohort_trigger`;
--   * legătura cu aplicările: `aplicari_tratament.plan_linie_id` (+ `sursa = 'din_plan'`) și
--     `aplicari_tratament_produse.plan_linie_produs_id`.
--
-- NEAPLICATĂ: o rulează Andrei. Se rulează DUPĂ 20261122110000_analize_fructe.sql (folosește `operator_can_read`),
-- aplicată deja în producție; nu depinde de 20261122130000_magazia.sql sau de 20261123100000_capcane.sql.
-- Se poate aplica înainte sau după merge: fără ea, Planul merge (vezi, faci, editezi planuri, „E timpul pentru…”,
-- formularul completat), doar „Sar peste” și excepțiile pe parcelă nu apar, iar notificarea de dimineață a planului
-- nu pleacă (n-are unde să țină minte ce a anunțat).
--
-- Anulare (doar dacă e nevoie; pierde liniile sărite, excepțiile și istoricul anunțurilor):
--   drop table if exists public.planuri_anuntate;
--   drop table if exists public.planuri_linii_exceptii;
--   drop table if exists public.planuri_linii_sarite;
--   (politicile de citire vechi: `using (tenant_id = public.current_tenant_id())` pe cele 4 tabele de plan)

begin;

-- ─── Liniile sărite ──────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.planuri_linii_sarite (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_linie_id uuid not null references public.planuri_tratament_linii(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  an integer not null check (an between 2020 and 2100),
  motiv text null check (motiv is null or char_length(motiv) <= 500),
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint planuri_linii_sarite_unic unique (plan_linie_id, parcela_id, an)
);

create index if not exists idx_planuri_linii_sarite_tenant_an on public.planuri_linii_sarite (tenant_id, an);
create index if not exists idx_planuri_linii_sarite_parcela on public.planuri_linii_sarite (parcela_id);

alter table public.planuri_linii_sarite enable row level security;

drop policy if exists planuri_linii_sarite_select on public.planuri_linii_sarite;
create policy planuri_linii_sarite_select on public.planuri_linii_sarite for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_linii_sarite_insert on public.planuri_linii_sarite;
create policy planuri_linii_sarite_insert on public.planuri_linii_sarite for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (select 1 from public.planuri_tratament_linii l where l.id = plan_linie_id and l.tenant_id = public.current_tenant_id())
    and exists (select 1 from public.parcele p where p.id = parcela_id and p.tenant_id = public.current_tenant_id())
  );

drop policy if exists planuri_linii_sarite_update on public.planuri_linii_sarite;
create policy planuri_linii_sarite_update on public.planuri_linii_sarite for update to authenticated
  using (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente')))
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (select 1 from public.planuri_tratament_linii l where l.id = plan_linie_id and l.tenant_id = public.current_tenant_id())
    and exists (select 1 from public.parcele p where p.id = parcela_id and p.tenant_id = public.current_tenant_id())
  );

drop policy if exists planuri_linii_sarite_delete on public.planuri_linii_sarite;
create policy planuri_linii_sarite_delete on public.planuri_linii_sarite for delete to authenticated
  using (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente')));

-- ─── Excepțiile pe parcelă ───────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.planuri_linii_exceptii (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_linie_id uuid not null references public.planuri_tratament_linii(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint planuri_linii_exceptii_unic unique (plan_linie_id, parcela_id)
);

create index if not exists idx_planuri_linii_exceptii_tenant on public.planuri_linii_exceptii (tenant_id);
create index if not exists idx_planuri_linii_exceptii_parcela on public.planuri_linii_exceptii (parcela_id);

alter table public.planuri_linii_exceptii enable row level security;

drop policy if exists planuri_linii_exceptii_select on public.planuri_linii_exceptii;
create policy planuri_linii_exceptii_select on public.planuri_linii_exceptii for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_linii_exceptii_insert on public.planuri_linii_exceptii;
create policy planuri_linii_exceptii_insert on public.planuri_linii_exceptii for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (select 1 from public.planuri_tratament_linii l where l.id = plan_linie_id and l.tenant_id = public.current_tenant_id())
    and exists (select 1 from public.parcele p where p.id = parcela_id and p.tenant_id = public.current_tenant_id())
  );

drop policy if exists planuri_linii_exceptii_delete on public.planuri_linii_exceptii;
create policy planuri_linii_exceptii_delete on public.planuri_linii_exceptii for delete to authenticated
  using (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente')));

-- ─── Ce s-a anunțat deja (notificarea de dimineață) ──────────────────────────────────────────────────────────────

create table if not exists public.planuri_anuntate (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_linie_id uuid not null references public.planuri_tratament_linii(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  an integer not null check (an between 2020 and 2100),
  repetare integer not null default 1 check (repetare >= 1),
  anuntat_la timestamptz not null default now(),
  constraint planuri_anuntate_unic unique (plan_linie_id, parcela_id, an, repetare)
);

create index if not exists idx_planuri_anuntate_tenant_an on public.planuri_anuntate (tenant_id, an);

alter table public.planuri_anuntate enable row level security;

-- Doar citire pentru utilizatori; scrie cronul cu service role (care trece peste RLS).
drop policy if exists planuri_anuntate_select on public.planuri_anuntate;
create policy planuri_anuntate_select on public.planuri_anuntate for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

-- ─── Citirea planurilor: și dreptul „Tratamente” (operatorii fără Tratamente nu mai văd planurile) ──────────────

drop policy if exists planuri_tratament_select on public.planuri_tratament;
create policy planuri_tratament_select on public.planuri_tratament for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_tratament_linii_select on public.planuri_tratament_linii;
create policy planuri_tratament_linii_select on public.planuri_tratament_linii for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists planuri_tratament_linie_produse_select on public.planuri_tratament_linie_produse;
create policy planuri_tratament_linie_produse_select on public.planuri_tratament_linie_produse for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists parcele_planuri_select on public.parcele_planuri;
create policy parcele_planuri_select on public.parcele_planuri for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

commit;
