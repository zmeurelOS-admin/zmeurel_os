-- Magazia de produse (promptul 28): ce produse fitosanitare și îngrășăminte are ferma, cât a cumpărat, cât a
-- scos singur fiecare tratament făcut și cât a numărat. Doar aditiv: 2 tabele noi, 3 RPC-uri, 2 triggere noi
-- pe tabelele de tratamente (care scriu DOAR în `magazie_miscari`). Nu atinge date existente.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Se rulează DUPĂ 20261121160000_tratamente_modul.sql (folosește
-- `aplicari_tratament.lot_id`) și după 20261122110000_analize_fructe.sql (folosește `operator_can_read`); ambele
-- erau deja în producție la 22.11.2026. Schema de pornire citită din producție pe 22.11.2026
-- (`information_schema.columns`, `pg_constraint`, `pg_policies`, `pg_proc`, `information_schema.triggers`).
--
-- NU folosește coloanele vechi `stoc_mutatie_id` (duc la `miscari_stoc`, stocul de fructe) și nu scrie nimic în
-- `miscari_stoc`, `ajustari_stoc` sau `stock_reservations`.
--
-- De ce unitatea și pragul NU stau pe `produse_fitosanitare` (cum cerea promptul): produsele din catalog sunt
-- comune tuturor fermelor (`tenant_id is null`) și ferma nu le poate modifica (politica `produse_fitosanitare_update`
-- cere `tenant_id = current_tenant_id()`). În producție 18 ferme au aplicat produse din catalog. O coloană pe
-- produs ar fi comună tuturor fermelor. Unitatea și pragul stau deci pe (fermă, produs), în `magazie_produse`.
--
-- Ce adaugă:
--   * `magazie_produse` (tenant_id, produs_id) → `unitate_stoc` ('kg' / 'l' / 'buc', fixă după prima mișcare),
--     `prag_pe_terminate` (null = implicit, cât pentru încă o aplicare). Rândul apare la prima intrare sau numărare.
--   * `magazie_miscari`: intrări (+, cu preț, furnizor, bon, cheltuiala legată), ieșiri din tratamente (−, scrise
--     doar de trigger) și corecții (±, „Am numărat”). Cantitatea e în unitatea produsului.
--   * Triggerul de ieșire (`magazie_sincronizeaza_iesire`): ține un singur rând `iesire_tratament` pe fiecare produs
--     al unei aplicări (`aplicare_produs_id` unic):
--       - aplicare făcută (`status = 'aplicata'`), cu `produs_id` și `cantitate_totala > 0`, produs urmărit în
--         magazie, ziua aplicării ≥ ziua primei intrări / corecții a produsului, unitate convertibilă →
--         ieșire = −cantitatea, în unitatea produsului (ml → l și g → kg, împărțit la 1000);
--       - altfel (planificată, anulată, fără cantitate, unitate incompatibilă, tratament de dinainte de magazie,
--         produs scos) → rândul se șterge. Produsul schimbat pe același rând → rândul se refolosește.
--       - aplicarea sau produsul ei șterse → rândul pleacă în cascadă (FK `on delete cascade`).
--     Ziua aplicării = `data_aplicata` în ora României, altfel `data_planificata`.
--     La prima intrare a unui produs NU se recalculează retroactiv nimic.
--   * `magazie_stoc()`: stocul pe produs pentru ferma curentă, unitatea, pragul, doza ultimei aplicări (suma pe lot),
--     „ajunge pentru ~N aplicări”, „pe terminate”, ziua primei intrări / corecții (`inceput`); prețul mediu
--     ponderat și valoarea DOAR pentru proprietar.
--   * `magazie_miscari_produs(p_produs_id)`: mișcările unui produs (cu tratamentul legat), plus aplicările făcute
--     după prima intrare care nu s-au putut scădea (`tip = 'nescazut'`); prețurile, bonul și cheltuiala doar
--     pentru proprietar.
--   * `magazie_iesiri_aplicari()`: cât a scos fiecare produs al fiecărei aplicări (lista din Tratamente).
--   * RLS: `magazie_miscari` o citește doar proprietarul (operatorul vede stocul prin RPC-uri); intrări și corecții
--     inserează proprietarul și operatorul cu „Scrie” pe Tratamente (operatorul fără preț și fără cheltuială);
--     modificare și ștergere doar proprietarul, niciodată rândurile `iesire_tratament`.
--     `magazie_produse`: citește cine are „Tratamente”, scrie cine are „Scrie” pe Tratamente, șterge proprietarul.
--
-- Până la aplicare aplicația merge ca azi: Magazia arată „după actualizarea bazei de date”, rândul din Tratamente
-- și din Mai mult nu arată cifre, formularul de tratament nu arată stocul, Rapoartele nu arată linia
-- „Tratamente: X lei”, iar notificarea de luni nu pleacă.
--
-- Anulare (doar dacă e nevoie; pierde mișcările salvate):
--   drop trigger if exists magazie_iesire_produs on public.aplicari_tratament_produse;
--   drop trigger if exists magazie_iesire_aplicare on public.aplicari_tratament;
--   drop function if exists public.magazie_trg_aplicare_produs();
--   drop function if exists public.magazie_trg_aplicare();
--   drop function if exists public.magazie_stoc();
--   drop function if exists public.magazie_miscari_produs(uuid);
--   drop function if exists public.magazie_iesiri_aplicari();
--   drop table if exists public.magazie_miscari;
--   drop function if exists public.magazie_sincronizeaza_iesire(uuid);
--   drop table if exists public.magazie_produse;
--   drop function if exists public.magazie_produse_unitate_fixa();
--   drop function if exists public.magazie_converteste(numeric, text, text);

begin;

-- ─── Conversia unităților (pură) ─────────────────────────────────────────────────────────────────

create or replace function public.magazie_converteste(p_cantitate numeric, p_din text, p_in text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_cantitate is null then null
    when p_in = 'kg' and p_din = 'kg' then p_cantitate
    when p_in = 'kg' and p_din = 'g' then p_cantitate / 1000
    when p_in = 'l' and p_din = 'l' then p_cantitate
    when p_in = 'l' and p_din = 'ml' then p_cantitate / 1000
    when p_in = 'buc' and p_din in ('buc', 'nr_bucati') then p_cantitate
    else null
  end
$$;

comment on function public.magazie_converteste(numeric, text, text) is
  'Cantitatea unei aplicări în unitatea magaziei: ml → l și g → kg (/1000). Unități incompatibile → null (nu scade).';

-- ─── Produsele urmărite în magazie (pe fermă) ────────────────────────────────────────────────────

create table if not exists public.magazie_produse (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  produs_id uuid not null references public.produse_fitosanitare(id) on delete cascade,
  unitate_stoc text not null,
  prag_pe_terminate numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, produs_id),
  constraint magazie_produse_unitate_check check (unitate_stoc in ('kg', 'l', 'buc')),
  constraint magazie_produse_prag_check check (prag_pe_terminate is null or prag_pe_terminate >= 0)
);

comment on table public.magazie_produse is
  'Magazia: unitatea și pragul „pe terminate” ale unui produs, pe fermă (și pentru produsele din catalog).';

create index if not exists idx_magazie_produse_produs on public.magazie_produse (produs_id);

-- ─── Mișcările ───────────────────────────────────────────────────────────────────────────────────

create table if not exists public.magazie_miscari (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  produs_id uuid not null references public.produse_fitosanitare(id) on delete cascade,
  tip text not null,
  cantitate numeric not null,
  data date not null default current_date,
  pret_total_lei numeric null,
  furnizor text null,
  bon_path text null,
  cheltuiala_id uuid null references public.cheltuieli_diverse(id) on delete set null,
  aplicare_produs_id uuid null references public.aplicari_tratament_produse(id) on delete cascade,
  nota text null,
  client_sync_id uuid null,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint magazie_miscari_aplicare_produs_key unique (aplicare_produs_id),
  constraint magazie_miscari_tip_check check (tip in ('intrare', 'iesire_tratament', 'corectie')),
  constraint magazie_miscari_cantitate_check check (
    (tip = 'intrare' and cantitate > 0)
    or (tip = 'iesire_tratament' and cantitate < 0)
    or (tip = 'corectie' and cantitate <> 0)
  ),
  constraint magazie_miscari_pret_check check (pret_total_lei is null or (tip = 'intrare' and pret_total_lei >= 0)),
  constraint magazie_miscari_furnizor_check check (furnizor is null or tip = 'intrare'),
  constraint magazie_miscari_cheltuiala_check check (cheltuiala_id is null or tip = 'intrare'),
  constraint magazie_miscari_iesire_check check ((tip = 'iesire_tratament') = (aplicare_produs_id is not null))
);

comment on table public.magazie_miscari is
  'Magazia: intrări (+), ieșiri din tratamentele făcute (−, doar triggerul) și corecții (±), în unitatea produsului.';
comment on column public.magazie_miscari.bon_path is 'Calea pozei bonului în bucketul privat `bonuri` (<tenant>/magazie/<cheie>.jpg).';
comment on column public.magazie_miscari.cheltuiala_id is 'Cheltuiala creată odată cu intrarea („Trece și la cheltuieli”).';
comment on column public.magazie_miscari.aplicare_produs_id is 'Doar la ieșiri: produsul aplicării care a scos cantitatea.';

create index if not exists idx_magazie_miscari_tenant_produs_data on public.magazie_miscari (tenant_id, produs_id, data);
create index if not exists idx_magazie_miscari_produs on public.magazie_miscari (produs_id);
create index if not exists idx_magazie_miscari_cheltuiala on public.magazie_miscari (cheltuiala_id) where cheltuiala_id is not null;
create index if not exists idx_magazie_miscari_created_by on public.magazie_miscari (created_by) where created_by is not null;
create unique index if not exists magazie_miscari_tenant_client_sync_key
  on public.magazie_miscari (tenant_id, client_sync_id)
  where client_sync_id is not null;

-- ─── Unitatea nu se schimbă după prima mișcare ───────────────────────────────────────────────────

create or replace function public.magazie_produse_unitate_fixa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is distinct from old.tenant_id or new.produs_id is distinct from old.produs_id then
    raise exception 'Produsul din magazie nu se mută.' using errcode = '23514';
  end if;
  if new.unitate_stoc is distinct from old.unitate_stoc and exists (
    select 1 from public.magazie_miscari m where m.tenant_id = old.tenant_id and m.produs_id = old.produs_id
  ) then
    raise exception 'Unitatea produsului nu se mai schimbă după prima mișcare.' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.magazie_produse_unitate_fixa() from public, anon, authenticated;
grant execute on function public.magazie_produse_unitate_fixa() to service_role;

drop trigger if exists magazie_produse_unitate_fixa on public.magazie_produse;
create trigger magazie_produse_unitate_fixa
  before update on public.magazie_produse
  for each row execute function public.magazie_produse_unitate_fixa();

-- ─── Ieșirea automată din tratamente ─────────────────────────────────────────────────────────────

create or replace function public.magazie_sincronizeaza_iesire(p_aplicare_produs_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_unitate text;
  v_start date;
  v_zi date;
  v_cantitate numeric;
begin
  select atp.id, atp.tenant_id, atp.produs_id, atp.cantitate_totala, atp.unitate_cantitate,
         a.status, a.data_aplicata, a.data_planificata
    into r
  from public.aplicari_tratament_produse atp
  join public.aplicari_tratament a on a.id = atp.aplicare_id
  where atp.id = p_aplicare_produs_id;

  if not found then
    delete from public.magazie_miscari where aplicare_produs_id = p_aplicare_produs_id;
    return;
  end if;

  v_zi := coalesce((r.data_aplicata at time zone 'Europe/Bucharest')::date, r.data_planificata);

  if r.status = 'aplicata' and r.produs_id is not null and coalesce(r.cantitate_totala, 0) > 0 and v_zi is not null then
    select mp.unitate_stoc into v_unitate
    from public.magazie_produse mp
    where mp.tenant_id = r.tenant_id and mp.produs_id = r.produs_id;

    if v_unitate is not null then
      -- Tratamentele de dinainte de magazie nu scad: stocul pornește de la prima intrare sau numărătoare.
      select min(m.data) into v_start
      from public.magazie_miscari m
      where m.tenant_id = r.tenant_id and m.produs_id = r.produs_id and m.tip in ('intrare', 'corectie');

      if v_start is not null and v_zi >= v_start then
        v_cantitate := public.magazie_converteste(r.cantitate_totala, r.unitate_cantitate, v_unitate);
      end if;
    end if;
  end if;

  if v_cantitate is null or v_cantitate <= 0 then
    delete from public.magazie_miscari where aplicare_produs_id = p_aplicare_produs_id;
    return;
  end if;

  insert into public.magazie_miscari (tenant_id, produs_id, tip, cantitate, data, aplicare_produs_id)
  values (r.tenant_id, r.produs_id, 'iesire_tratament', -v_cantitate, v_zi, p_aplicare_produs_id)
  on conflict (aplicare_produs_id) do update
    set tenant_id = excluded.tenant_id,
        produs_id = excluded.produs_id,
        cantitate = excluded.cantitate,
        data = excluded.data;
end;
$$;

comment on function public.magazie_sincronizeaza_iesire(uuid) is
  'Ține sincronizat rândul `iesire_tratament` al unui produs de aplicare. Scrie doar în `magazie_miscari`.';

revoke execute on function public.magazie_sincronizeaza_iesire(uuid) from public, anon, authenticated;
grant execute on function public.magazie_sincronizeaza_iesire(uuid) to service_role;

create or replace function public.magazie_trg_aplicare_produs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.magazie_sincronizeaza_iesire(new.id);
  return null;
end;
$$;

revoke execute on function public.magazie_trg_aplicare_produs() from public, anon, authenticated;
grant execute on function public.magazie_trg_aplicare_produs() to service_role;

drop trigger if exists magazie_iesire_produs on public.aplicari_tratament_produse;
create trigger magazie_iesire_produs
  after insert or update of produs_id, cantitate_totala, unitate_cantitate, aplicare_id
  on public.aplicari_tratament_produse
  for each row execute function public.magazie_trg_aplicare_produs();

create or replace function public.magazie_trg_aplicare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in select atp.id from public.aplicari_tratament_produse atp where atp.aplicare_id = new.id loop
    perform public.magazie_sincronizeaza_iesire(v_id);
  end loop;
  return null;
end;
$$;

revoke execute on function public.magazie_trg_aplicare() from public, anon, authenticated;
grant execute on function public.magazie_trg_aplicare() to service_role;

drop trigger if exists magazie_iesire_aplicare on public.aplicari_tratament;
create trigger magazie_iesire_aplicare
  after update of status, data_aplicata, data_planificata on public.aplicari_tratament
  for each row
  when (
    old.status is distinct from new.status
    or old.data_aplicata is distinct from new.data_aplicata
    or old.data_planificata is distinct from new.data_planificata
  )
  execute function public.magazie_trg_aplicare();

-- ─── RLS ─────────────────────────────────────────────────────────────────────────────────────────

alter table public.magazie_produse enable row level security;
alter table public.magazie_miscari enable row level security;

drop policy if exists magazie_produse_select on public.magazie_produse;
create policy magazie_produse_select on public.magazie_produse for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists magazie_produse_insert on public.magazie_produse;
create policy magazie_produse_insert on public.magazie_produse for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and public.operator_can_write('tratamente')
    and exists (
      select 1 from public.produse_fitosanitare p
      where p.id = magazie_produse.produs_id and (p.tenant_id is null or p.tenant_id = public.current_tenant_id())
    )
  );

drop policy if exists magazie_produse_update on public.magazie_produse;
create policy magazie_produse_update on public.magazie_produse for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_write('tratamente'))
  with check (tenant_id = public.current_tenant_id() and public.operator_can_write('tratamente'));

drop policy if exists magazie_produse_delete on public.magazie_produse;
create policy magazie_produse_delete on public.magazie_produse for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- Citirea directă: doar proprietarul (prețurile sunt bani). Operatorul vede stocul prin RPC-urile de mai jos.
drop policy if exists magazie_miscari_select on public.magazie_miscari;
create policy magazie_miscari_select on public.magazie_miscari for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- Intrări și corecții. Operatorul cu „Scrie” pe Tratamente: fără preț și fără cheltuială. Ieșirile: doar triggerul.
drop policy if exists magazie_miscari_insert on public.magazie_miscari;
create policy magazie_miscari_insert on public.magazie_miscari for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and tip in ('intrare', 'corectie')
    and aplicare_produs_id is null
    and exists (
      select 1 from public.produse_fitosanitare p
      where p.id = magazie_miscari.produs_id and (p.tenant_id is null or p.tenant_id = public.current_tenant_id())
    )
    and (
      cheltuiala_id is null
      or exists (
        select 1 from public.cheltuieli_diverse c
        where c.id = magazie_miscari.cheltuiala_id and c.tenant_id = public.current_tenant_id()
      )
    )
    and (
      public.is_tenant_owner(tenant_id)
      or (public.operator_can_write('tratamente') and pret_total_lei is null and cheltuiala_id is null)
    )
  );

drop policy if exists magazie_miscari_update on public.magazie_miscari;
create policy magazie_miscari_update on public.magazie_miscari for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id) and tip <> 'iesire_tratament')
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_owner(tenant_id)
    and tip in ('intrare', 'corectie')
    and aplicare_produs_id is null
  );

drop policy if exists magazie_miscari_delete on public.magazie_miscari;
create policy magazie_miscari_delete on public.magazie_miscari for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id) and tip <> 'iesire_tratament');

-- ─── Stocul (RPC) ────────────────────────────────────────────────────────────────────────────────

create or replace function public.magazie_stoc()
returns table (
  produs_id uuid,
  nume text,
  tip text,
  unitate text,
  stoc numeric,
  prag numeric,
  doza_ultima numeric,
  aplicari_ramase numeric,
  pe_terminate boolean,
  pret_mediu numeric,
  valoare numeric,
  ultima_miscare date,
  inceput date
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.current_tenant_id();
  v_owner boolean;
begin
  if auth.uid() is null or v_tenant is null then
    raise exception 'Neautentificat.' using errcode = '42501';
  end if;
  if not public.operator_can_read('tratamente') then
    raise exception 'Fără drept pe Tratamente.' using errcode = '42501';
  end if;
  v_owner := public.is_tenant_owner(v_tenant);

  return query
  with prod as (
    select mp.produs_id, mp.unitate_stoc, mp.prag_pe_terminate, p.nume_comercial, p.tip
    from public.magazie_produse mp
    join public.produse_fitosanitare p on p.id = mp.produs_id
    where mp.tenant_id = v_tenant
  ),
  sume as (
    select m.produs_id,
           sum(m.cantitate) as stoc,
           sum(m.pret_total_lei) filter (where m.tip = 'intrare' and m.pret_total_lei is not null) as pret_sum,
           sum(m.cantitate) filter (where m.tip = 'intrare' and m.pret_total_lei is not null) as cant_cu_pret,
           max(m.data) as ultima,
           min(m.data) filter (where m.tip in ('intrare', 'corectie')) as inceput
    from public.magazie_miscari m
    where m.tenant_id = v_tenant
    group by m.produs_id
  ),
  -- Doza ultimei aplicări = tot ce a scos ultimul tratament (lotul: mai multe parcele salvate împreună).
  grupuri as (
    select m.produs_id,
           coalesce(a.lot_id, a.id) as grup,
           max(m.data) as zi,
           max(m.created_at) as creat,
           sum(-m.cantitate) as cant
    from public.magazie_miscari m
    join public.aplicari_tratament_produse atp on atp.id = m.aplicare_produs_id
    join public.aplicari_tratament a on a.id = atp.aplicare_id
    where m.tenant_id = v_tenant and m.tip = 'iesire_tratament'
    group by m.produs_id, coalesce(a.lot_id, a.id)
  ),
  ultima as (
    select distinct on (g.produs_id) g.produs_id, g.cant
    from grupuri g
    order by g.produs_id, g.zi desc, g.creat desc
  )
  select prod.produs_id,
         prod.nume_comercial,
         prod.tip,
         prod.unitate_stoc,
         coalesce(s.stoc, 0),
         prod.prag_pe_terminate,
         u.cant,
         case when u.cant > 0 then greatest(coalesce(s.stoc, 0), 0) / u.cant end,
         case
           when coalesce(s.stoc, 0) <= 0 then true
           when prod.prag_pe_terminate is not null then coalesce(s.stoc, 0) < prod.prag_pe_terminate
           when u.cant > 0 then coalesce(s.stoc, 0) < u.cant
           else false
         end,
         case when v_owner and s.cant_cu_pret > 0 then s.pret_sum / s.cant_cu_pret end,
         case when v_owner and s.cant_cu_pret > 0 then greatest(coalesce(s.stoc, 0), 0) * s.pret_sum / s.cant_cu_pret end,
         s.ultima,
         s.inceput
  from prod
  left join sume s on s.produs_id = prod.produs_id
  left join ultima u on u.produs_id = prod.produs_id
  order by prod.nume_comercial;
end;
$$;

comment on function public.magazie_stoc() is
  'Stocul magaziei pe produs, pentru ferma curentă. Prețul mediu și valoarea doar pentru proprietar (null pentru operator).';

revoke execute on function public.magazie_stoc() from public, anon;
grant execute on function public.magazie_stoc() to authenticated, service_role;

-- ─── Mișcările unui produs (RPC, fișa produsului) ────────────────────────────────────────────────

create or replace function public.magazie_miscari_produs(p_produs_id uuid)
returns table (
  id uuid,
  tip text,
  cantitate numeric,
  data date,
  pret_total_lei numeric,
  furnizor text,
  bon_path text,
  cheltuiala_id uuid,
  aplicare_id uuid,
  metoda_aplicare text,
  parcela_nume text,
  nota text,
  created_at timestamptz,
  cantitate_aplicare text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.current_tenant_id();
  v_owner boolean;
  v_start date;
begin
  if auth.uid() is null or v_tenant is null then
    raise exception 'Neautentificat.' using errcode = '42501';
  end if;
  if not public.operator_can_read('tratamente') then
    raise exception 'Fără drept pe Tratamente.' using errcode = '42501';
  end if;
  v_owner := public.is_tenant_owner(v_tenant);

  select min(m.data) into v_start
  from public.magazie_miscari m
  where m.tenant_id = v_tenant and m.produs_id = p_produs_id and m.tip in ('intrare', 'corectie');

  return query
  select * from (
    select m.id,
           m.tip,
           m.cantitate,
           m.data,
           case when v_owner then m.pret_total_lei end,
           m.furnizor,
           case when v_owner then m.bon_path end,
           case when v_owner then m.cheltuiala_id end,
           a.id,
           a.metoda_aplicare,
           pa.nume_parcela::text,
           m.nota,
           m.created_at,
           null::text
    from public.magazie_miscari m
    left join public.aplicari_tratament_produse atp on atp.id = m.aplicare_produs_id
    left join public.aplicari_tratament a on a.id = atp.aplicare_id
    left join public.parcele pa on pa.id = a.parcela_id
    where m.tenant_id = v_tenant and m.produs_id = p_produs_id

    union all

    -- Aplicările făcute după prima intrare care n-au scăzut nimic (unitate incompatibilă sau fără cantitate).
    select atp.id,
           'nescazut'::text,
           null::numeric,
           (a.data_aplicata at time zone 'Europe/Bucharest')::date,
           null::numeric,
           null::text,
           null::text,
           null::uuid,
           a.id,
           a.metoda_aplicare,
           pa.nume_parcela::text,
           null::text,
           atp.created_at,
           nullif(btrim(coalesce(atp.cantitate_totala::text, '') || ' ' || coalesce(atp.unitate_cantitate, '')), '')
    from public.aplicari_tratament_produse atp
    join public.aplicari_tratament a on a.id = atp.aplicare_id
    left join public.parcele pa on pa.id = a.parcela_id
    where atp.tenant_id = v_tenant
      and atp.produs_id = p_produs_id
      and a.status = 'aplicata'
      and v_start is not null
      and a.data_aplicata is not null
      and (a.data_aplicata at time zone 'Europe/Bucharest')::date >= v_start
      and not exists (select 1 from public.magazie_miscari m2 where m2.aplicare_produs_id = atp.id)
  ) t
  order by t.data desc, t.created_at desc
  limit 500;
end;
$$;

comment on function public.magazie_miscari_produs(uuid) is
  'Mișcările unui produs din magazie (fișa produsului). Prețul, bonul și cheltuiala doar pentru proprietar.';

revoke execute on function public.magazie_miscari_produs(uuid) from public, anon;
grant execute on function public.magazie_miscari_produs(uuid) to authenticated, service_role;

-- ─── Ce a scos fiecare aplicare (RPC, lista de tratamente) ───────────────────────────────────────

create or replace function public.magazie_iesiri_aplicari()
returns table (
  aplicare_id uuid,
  aplicare_produs_id uuid,
  produs_id uuid,
  cantitate numeric,
  unitate text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.current_tenant_id();
begin
  if auth.uid() is null or v_tenant is null then
    raise exception 'Neautentificat.' using errcode = '42501';
  end if;
  if not public.operator_can_read('tratamente') then
    raise exception 'Fără drept pe Tratamente.' using errcode = '42501';
  end if;

  return query
  select atp.aplicare_id, m.aplicare_produs_id, m.produs_id, -m.cantitate, mp.unitate_stoc
  from public.magazie_miscari m
  join public.aplicari_tratament_produse atp on atp.id = m.aplicare_produs_id
  left join public.magazie_produse mp on mp.tenant_id = m.tenant_id and mp.produs_id = m.produs_id
  where m.tenant_id = v_tenant and m.tip = 'iesire_tratament';
end;
$$;

comment on function public.magazie_iesiri_aplicari() is
  'Cât a scos din magazie fiecare produs al fiecărei aplicări făcute (ferma curentă). Fără prețuri.';

revoke execute on function public.magazie_iesiri_aplicari() from public, anon;
grant execute on function public.magazie_iesiri_aplicari() to authenticated, service_role;

commit;

-- PostgREST: schema nouă se vede fără restart.
notify pgrst, 'reload schema';
