-- Redesign, noaptea de 19 → 20.11.2026 (prompt 08): coloanele noi pentru Comenzi, Livrări, Acasă,
-- Clienți, Setări și Vânzări. O singură migrare, doar aditivă.
--
-- NU a fost aplicată din cod. O aprobă și o rulează Andrei.
--
-- Reguli respectate: doar `add column if not exists`, valori implicite și `check`-uri pe coloanele noi.
-- Fără `update`, `delete`, backfill, `drop`, redenumiri sau indexuri unice. Se poate rula de două ori.
-- Politicile RLS nu se schimbă: coloanele noi stau pe tabele care au deja RLS pe `tenant_id`.
--
-- Aplicația merge și înainte, și după rulare (`src/lib/schema-features.ts` verifică existența coloanelor).
--
-- Ce face fiecare coloană:
--
-- comenzi
--   prioritara                    comanda se livrează cu prioritate: e prima în listă și bifată implicit în
--                                 „Pune în livrare azi”.
--
-- clienti
--   latitudine, longitudine       locul de livrare salvat la o livrare (pentru „Navighează” și traseu).
--   locatie_salvata_la            când a fost salvată locația.
--   locatie_precizie_m            precizia GPS la salvare, în metri.
--
-- vanzari
--   suma_incasata_partial_lei     cât a dat clientul până acum dintr-o vânzare încă Neîncasată.
--   data_incasare_partiala        când a dat suma parțială. Venitul se trece o singură dată, cu toată suma,
--                                 la `data_incasare` (când se încasează restul).
--
-- tenant_settings
--   pret_standard_inceput_lei_kg  prețul standard la început de sezon (rezerva din cod: 35).
--   pret_standard_varf_lei_kg     prețul standard la vârf de sezon (rezerva din cod: 25).
--   pret_standard_mediu_lei_kg    prețul standard mediu (rezerva din cod: 30).
--   pret_standard_perioada        perioada activă: 'inceput' / 'varf' / 'mediu' (null = început).
--   acasa_perioada_mod            ce arată Acasă: 'auto' / 'sezon' / 'extrasezon'.
--   extrasezon_inceput_la         ziua în care fermierul a confirmat „Da, începem extrasezonul”.
--   extrasezon_amanat_pana        „Mai am de cules”: întrebarea revine după această zi.
--   extrasezon_intrebare_din      de când apare întrebarea, ca lună-zi ('10-25' = 25 octombrie).
--   acasa_extrasezon_afiseaza     ce arată Acasă în extrasezon:
--                                 {"comenzi_butasi": true, "rest_incasat": true, "lucrari": true, "inghet": true}
--                                 (null = toate).

-- ─── comenzi ────────────────────────────────────────────────────────────────────

alter table public.comenzi
  add column if not exists prioritara boolean not null default false;

-- ─── clienti ────────────────────────────────────────────────────────────────────

alter table public.clienti
  add column if not exists latitudine double precision
    check (latitudine is null or (latitudine >= -90 and latitudine <= 90));

alter table public.clienti
  add column if not exists longitudine double precision
    check (longitudine is null or (longitudine >= -180 and longitudine <= 180));

alter table public.clienti
  add column if not exists locatie_salvata_la timestamptz;

alter table public.clienti
  add column if not exists locatie_precizie_m real
    check (locatie_precizie_m is null or locatie_precizie_m >= 0);

-- ─── vanzari ────────────────────────────────────────────────────────────────────

alter table public.vanzari
  add column if not exists suma_incasata_partial_lei numeric(12,2)
    check (suma_incasata_partial_lei is null or suma_incasata_partial_lei >= 0);

alter table public.vanzari
  add column if not exists data_incasare_partiala date;

-- ─── tenant_settings ────────────────────────────────────────────────────────────

alter table public.tenant_settings
  add column if not exists pret_standard_inceput_lei_kg numeric(10,2)
    check (pret_standard_inceput_lei_kg is null or pret_standard_inceput_lei_kg >= 0);

alter table public.tenant_settings
  add column if not exists pret_standard_varf_lei_kg numeric(10,2)
    check (pret_standard_varf_lei_kg is null or pret_standard_varf_lei_kg >= 0);

alter table public.tenant_settings
  add column if not exists pret_standard_mediu_lei_kg numeric(10,2)
    check (pret_standard_mediu_lei_kg is null or pret_standard_mediu_lei_kg >= 0);

alter table public.tenant_settings
  add column if not exists pret_standard_perioada text
    check (pret_standard_perioada is null or pret_standard_perioada in ('inceput', 'varf', 'mediu'));

alter table public.tenant_settings
  add column if not exists acasa_perioada_mod text not null default 'auto'
    check (acasa_perioada_mod in ('auto', 'sezon', 'extrasezon'));

alter table public.tenant_settings
  add column if not exists extrasezon_inceput_la date;

alter table public.tenant_settings
  add column if not exists extrasezon_amanat_pana date;

alter table public.tenant_settings
  add column if not exists extrasezon_intrebare_din text not null default '10-25'
    check (extrasezon_intrebare_din ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');

alter table public.tenant_settings
  add column if not exists acasa_extrasezon_afiseaza jsonb;
