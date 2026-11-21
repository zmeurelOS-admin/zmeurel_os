-- Lucrări (fostele Activități agricole, promptul 20): lucrările planificate și gruparea pe mai multe parcele.
-- Doar aditiv: două coloane nule, o constrângere pe valorile noi și două indexuri.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11.
-- Schema de pornire citită din producție pe 21.11.2026 (`information_schema.columns`, `pg_constraint`,
-- `pg_indexes`, `pg_policies`, `pg_trigger` pe `activitati_agricole`), nu din migrările vechi.
--
-- Ce adaugă:
--   * `activitati_agricole.status text null` — `'planificata'` = lucrare de făcut în ziua din `data_aplicare`;
--     `null` (toate rândurile de azi) sau `'facuta'` = făcută. „Marchează făcut” trece rândul pe `'facuta'` și
--     mută `data_aplicare` pe momentul marcării. Rândurile existente rămân `null`, deci făcute, neschimbate.
--   * `activitati_agricole.lot_id uuid null` — rândurile salvate împreună (aceeași lucrare pe mai multe parcele,
--     un rând pe parcelă, fiecare cu `client_sync_id` propriu) au același lot = cheia formularului. Jurnalul
--     Lucrări le arată pe un singur rând („Maravilla 1, Maravilla 2”). Rândurile vechi rămân fără lot.
--
-- Ce NU face: nu schimbă politici RLS (inserarea și modificarea cer deja
-- `is_tenant_owner(tenant_id) or operator_can_write('activitati')`, ștergerea doar proprietarul), nu adaugă
-- funcții (deci nici `revoke` / `grant`), nu atinge date existente, nu redenumește tipurile vechi de lucrări.
--
-- Până la aplicare, aplicația merge fără ele: Lucrări citește tot ca până acum (toate rândurile = făcute),
-- „Planifică” e dezactivat cu textul „Se activează după actualizarea bazei de date”, iar rândurile salvate
-- împreună se grupează după potrivire (aceeași zi, același tip, același „cine”, aceeași notă, salvate în
-- același minut).
--
-- Anulare (doar dacă e nevoie; pierde planificarea și lotul):
--   drop index if exists public.idx_activitati_agricole_tenant_planificate;
--   drop index if exists public.idx_activitati_agricole_tenant_lot;
--   alter table public.activitati_agricole drop constraint if exists activitati_agricole_status_check;
--   alter table public.activitati_agricole drop column if exists status, drop column if exists lot_id;

begin;

alter table public.activitati_agricole
  add column if not exists status text null,
  add column if not exists lot_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'activitati_agricole_status_check'
      and conrelid = 'public.activitati_agricole'::regclass
  ) then
    alter table public.activitati_agricole
      add constraint activitati_agricole_status_check
      check (status is null or status in ('planificata', 'facuta'));
  end if;
end $$;

comment on column public.activitati_agricole.status is
  'Lucrări: ''planificata'' = de făcut în ziua din data_aplicare; null sau ''facuta'' = făcută.';
comment on column public.activitati_agricole.lot_id is
  'Rândurile salvate împreună (aceeași lucrare, mai multe parcele). Cheia formularului; null la cele vechi.';

-- Acasă și jurnalul citesc planificatele fermei.
create index if not exists idx_activitati_agricole_tenant_planificate
  on public.activitati_agricole (tenant_id, data_aplicare)
  where status = 'planificata';

create index if not exists idx_activitati_agricole_tenant_lot
  on public.activitati_agricole (tenant_id, lot_id)
  where lot_id is not null;

commit;

-- PostgREST: schema nouă se vede fără restart.
notify pgrst, 'reload schema';
