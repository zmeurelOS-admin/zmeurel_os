-- Modulul Tratamente (promptul 18): coloane noi, toate nule, plus indexuri. Doar aditiv.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11.
-- Schema de pornire citită din producție pe 21.11.2026 (`information_schema.columns`, `pg_constraint`,
-- `pg_indexes`, `pg_policies`), nu din migrările vechi.
--
-- Ce adaugă:
--   * `aplicari_tratament.lot_id uuid null` — aplicările salvate împreună, pe mai multe parcele, au același lot
--     (cheia formularului, `form.clientSyncId`). Jurnalul arată un singur rând („Maravilla 1, Maravilla 2”).
--     Tot lotul e și cheia de idempotență: o reîncercare găsește aplicările deja create și nu le dublează
--     (index unic parțial pe `(tenant_id, lot_id, parcela_id)`). Aplicările vechi rămân fără lot și apar câte una.
--   * `aplicari_tratament_produse.rezervor text null` ('A' / 'B') — fertirigarea pe două rezervoare.
--   * `aplicari_tratament_produse.doza_g_per_planta numeric null` — doza la fertirigare, în grame pe plantă.
--   * `parcele.volum_solutie_l numeric null` — volumul de soluție obișnuit al parcelei la stropire. Se
--     completează singur la primul tratament pe parcelă (doar dacă e gol; nu se suprascrie) și se propune
--     la următoarele.
--
-- Ce NU face: nu schimbă politici RLS (cele existente acoperă coloanele noi: inserarea și modificarea
-- aplicărilor cer `is_tenant_owner(tenant_id) or operator_can_write('tratamente')`, parcele cer
-- `operator_can_write('parcele')`), nu adaugă funcții, nu atinge date existente.
--
-- Până la aplicare, aplicația merge fără ele: citirea nu cere coloanele noi, salvarea pe mai multe parcele
-- creează câte o aplicare pe parcelă (fără lot, deci câte un rând în jurnal și fără protecție la dublare),
-- fertirigarea păstrează g/plantă și rezervorul în `cantitate_text`, iar volumul nu se ține pe parcelă.
--
-- Anulare (doar dacă e nevoie, pierde lotul / rezervorul / volumul salvate):
--   drop index if exists public.aplicari_tratament_lot_parcela_key;
--   drop index if exists public.idx_aplicari_tratament_tenant_lot;
--   alter table public.aplicari_tratament drop column if exists lot_id;
--   alter table public.aplicari_tratament_produse drop column if exists rezervor, drop column if exists doza_g_per_planta;
--   alter table public.parcele drop column if exists volum_solutie_l;

begin;

alter table public.aplicari_tratament
  add column if not exists lot_id uuid null;

comment on column public.aplicari_tratament.lot_id is
  'Aplicările salvate împreună (același formular, mai multe parcele). Cheia formularului; null la cele vechi.';

create index if not exists idx_aplicari_tratament_tenant_lot
  on public.aplicari_tratament (tenant_id, lot_id)
  where lot_id is not null;

-- O parcelă apare o singură dată într-un lot: reîncercarea aceleiași salvări nu dublează.
create unique index if not exists aplicari_tratament_lot_parcela_key
  on public.aplicari_tratament (tenant_id, lot_id, parcela_id)
  where lot_id is not null;

alter table public.aplicari_tratament_produse
  add column if not exists rezervor text null,
  add column if not exists doza_g_per_planta numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'aplicari_tratament_produse_rezervor_check'
      and conrelid = 'public.aplicari_tratament_produse'::regclass
  ) then
    alter table public.aplicari_tratament_produse
      add constraint aplicari_tratament_produse_rezervor_check
      check (rezervor is null or rezervor in ('A', 'B'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'aplicari_tratament_produse_doza_g_per_planta_check'
      and conrelid = 'public.aplicari_tratament_produse'::regclass
  ) then
    alter table public.aplicari_tratament_produse
      add constraint aplicari_tratament_produse_doza_g_per_planta_check
      check (doza_g_per_planta is null or doza_g_per_planta >= 0);
  end if;
end $$;

comment on column public.aplicari_tratament_produse.rezervor is 'Fertirigare: rezervorul A sau B.';
comment on column public.aplicari_tratament_produse.doza_g_per_planta is 'Fertirigare: grame de produs pe plantă.';

alter table public.parcele
  add column if not exists volum_solutie_l numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parcele_volum_solutie_l_check'
      and conrelid = 'public.parcele'::regclass
  ) then
    alter table public.parcele
      add constraint parcele_volum_solutie_l_check
      check (volum_solutie_l is null or volum_solutie_l >= 0);
  end if;
end $$;

comment on column public.parcele.volum_solutie_l is
  'Litri de soluție la o stropire pe toată parcela. Propus în formularul de tratament; null = necunoscut.';

commit;

-- PostgREST: schema nouă se vede fără restart.
notify pgrst, 'reload schema';
