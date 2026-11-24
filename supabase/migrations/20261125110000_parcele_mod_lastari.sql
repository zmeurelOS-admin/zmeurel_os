-- „Cum lucrezi lăstarii” pe parcelă (promptul 33), pentru zmeură și mur.
--
-- NEAPLICATĂ: o rulează Andrei, după merge (după 20261125100000). Doar aditivă: o coloană nouă, fără valoare implicită
-- și fără `update` pe date. Fără `drop`.
--
-- Valori:
--   an1      = „Doar lăstari de an 1 (tai tot toamna)”: în foaia Stadiul apare doar Primocane · lăstar an 1;
--   an1_an2  = „An 1 + an 2 (păstrez o parte, două recolte)”: apar amândoi lăstarii și ciclul „Tai tot / Păstrez”;
--   an2      = „Doar lăstari de an 2 (soiuri floricane)”: apare doar Floricane · lăstar an 2.
--   null     = nesetat: aplicația îl calculează la citire (an1_an2 dacă parcela are deja un stadiu pe floricane sau
--              sezonul e notat „mixt”, altfel an1). Rândurile existente rămân null.
--
-- Stadiile noi ale ciclului (`pastrat`, `taiat`) nu cer migrare: `stadii_fenologice_parcela.stadiu` nu are listă de
-- valori (verificat pe 24.11.2026: constrângerile sunt doar pe `cohort`, `sursa` și cheia unică).
--
-- Drepturi: politicile existente ale `parcele` (UPDATE: proprietarul sau operatorul cu „Scrie” pe Parcele).
--
-- Fără migrare: rândul „Cum lucrezi lăstarii” nu apare pe fișă, iar modul se calculează mereu.
--
-- Anulare (doar dacă e nevoie):
--   alter table public.parcele drop constraint if exists parcele_mod_lastari_check;
--   alter table public.parcele drop column if exists mod_lastari;

alter table public.parcele add column if not exists mod_lastari text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'parcele_mod_lastari_check'
       and conrelid = 'public.parcele'::regclass
  ) then
    alter table public.parcele
      add constraint parcele_mod_lastari_check
      check (mod_lastari is null or mod_lastari in ('an1', 'an1_an2', 'an2'));
  end if;
end;
$$;

comment on column public.parcele.mod_lastari is
  'Cum lucrezi lăstarii (zmeură, mur): an1 / an1_an2 / an2. Null = calculat în aplicație (an1_an2 dacă există stadii pe floricane).';
