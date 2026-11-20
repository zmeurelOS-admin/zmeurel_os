-- Preferințele de notificări pe utilizator (ecranul „Ce primești”, /notificari/setari).
--
-- Aditivă: un tabel nou, nimic existent nu se schimbă.
-- `tipuri` ține doar comutatoarele oprite sau pornite explicit, pe cheile din
-- src/lib/notifications/preferinte.ts (noi, maine, rest, meteo, pauza, sapt, acte).
-- Cheie lipsă = pornit. Un rând lipsă = totul pornit, cu liniște noaptea.
--
-- Push-ul (src/lib/notifications/create.ts și cronul pentru butași) citește rândul cu service role.
-- Fără funcții SECURITY DEFINER.

create table if not exists public.notificari_preferinte (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tipuri jsonb not null default '{}'::jsonb,
  liniste_noaptea boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint notificari_preferinte_tipuri_obiect check (jsonb_typeof(tipuri) = 'object')
);

comment on table public.notificari_preferinte is
  'Ce notificări sună pe telefon, pe utilizator. Cheie lipsă în `tipuri` = pornit. Liniște noaptea: 22:00–6:00 Europe/Bucharest, gerul face excepție.';

alter table public.notificari_preferinte enable row level security;

drop policy if exists notificari_preferinte_select_own on public.notificari_preferinte;
create policy notificari_preferinte_select_own
  on public.notificari_preferinte
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notificari_preferinte_insert_own on public.notificari_preferinte;
create policy notificari_preferinte_insert_own
  on public.notificari_preferinte
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists notificari_preferinte_update_own on public.notificari_preferinte;
create policy notificari_preferinte_update_own
  on public.notificari_preferinte
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Fără politică de delete: rândul dispare doar odată cu contul (on delete cascade).

revoke all on table public.notificari_preferinte from anon;
grant select, insert, update on table public.notificari_preferinte to authenticated;
grant all on table public.notificari_preferinte to service_role;
