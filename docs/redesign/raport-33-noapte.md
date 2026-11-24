# Raport — promptul 33: resturile redenumirii, banii neîncasați, pierderile din stoc, vremea, lăstarii, audit final

Branch: `redesign/33-noapte`, pornit din `origin/main` la `958e9cf`. **Fără merge.** `public/sw.js` nu e în niciun commit.
Din baza de producție doar am citit (`select`, `pg_policies`, `pg_proc`, `has_function_privilege`). Migrările sunt scrise,
**neaplicate**. Scrierile de test s-au făcut doar în demo-uri noi create din `/start`.

## Pașii tăi (Andrei), după merge

1. **Supabase → SQL editor**, în ordinea asta:
   1. `supabase/migrations/20261125100000_pierderi_stoc_motiv.sql` (butonul „Pierdere” din Stocuri);
   2. `supabase/migrations/20261125110000_parcele_mod_lastari.sql` („Cum lucrezi lăstarii” pe fișa parcelei).

   Fără ele, aplicația merge ca înainte: butonul „Pierdere” și rândul „Cum lucrezi lăstarii” nu apar.
2. **Deploy la funcțiile Supabase** `fetch-meteo` și `get-meteo` (același cod, din `supabase/functions/_shared/`):
   `supabase functions deploy fetch-meteo` și `supabase functions deploy get-meteo`. Abia după deploy apar cele 3 zile
   pe cardul de vreme (cache-ul vechi, de 3 ore, se reface singur). Până atunci cardul arată ca azi.
3. Nicio variabilă nouă pe Vercel. Regula pentru adrese folosește `VERCEL_ENV` (și `NEXT_PUBLIC_VERCEL_ENV`), pe care Vercel
   le pune singur. Dacă `NEXT_PUBLIC_SITE_URL` / `SITE_URL` nu trec regula, build-ul scrie o avertizare și se folosește
   `https://caietulfermei.ro`.

## 1. Ce am schimbat, pe secțiuni

### 1. `originDinUrl` (commit `b070adf`)
- `src/lib/brand.ts`: `originValida()` (originea sau `null`), `originDinUrl()` (originea sau `https://caietulfermei.ro`;
  nu aruncă niciodată), `primaOrigineValida()`, `esteProductie()` (`VERCEL_ENV=production`). Regula: după `trim`, un URL
  `http:`/`https:` valid, fără utilizator și parolă, cu host care conține un punct; `localhost` / `127.0.0.1` doar în afara
  producției. Nu mai pune `https://` în fața unei valori stricate (de aici veneau `https://value` și `https://valuehttps`).
- Trecute prin aceeași regulă:
  - redirecționarea (`redirect-domeniu.ts`): o adresă stricată a platformei duce la adresa implicită, niciodată la un host
    fără punct sau la `localhost`;
  - `auth/callback`, `buildAuthCallbackUrl`, resetarea parolei;
  - QR-ul raportului public (`origineAplicatie`);
  - invitațiile și linkul de livrator (`owner-auth.ts`);
  - Google Contacts (OAuth `connect` / `callback` și `sync-now`).
- `scripts/check-env.js`: rescris în UTF-8 (diacriticele erau stricate). Avertizare (nu eșec) pentru
  `NEXT_PUBLIC_SITE_URL` / `SITE_URL` stricate, cu valoarea folosită în loc. Nu afișează alte variabile.
- Teste:
  - `src/lib/__tests__/brand-origine.test.ts`: cele 18 valori din prompt, dezvoltare vs producție, `primaOrigineValida`,
    `buildAuthCallbackUrl`, `origineAplicatie`;
  - `redirect-domeniu.test.ts`: nicio destinație fără punct; `/a/test123?x=1` își păstrează calea și query-ul.

### 2. „Zmeurel” rămas (commit `176e0f4`)
- Mesajele WhatsApp către clienți (`src/lib/comenzi/whatsapp-messages.ts`): „Ferma Zmeurel” scris fix devine numele fermei
  care trimite (`farmName` din `DashboardAuthContext`). Fără nume, sau cu numele pus automat („Ferma mea”, „…'s Farm”,
  `tenant_…`), mesajul spune doar „Mulțumim! 🌿”, fără nume de fermă.
- Exportul GDPR: `zmeurel-gdpr-export-<zi>.json` devine `caietul-fermei-date-<zi>.json`.
- `scripts/check-brand.mjs` (`npm run check:brand`), adăugat în `check:critical`, deci rulează și în CI:
  - pică la un „Zmeurel” nou în `src/`, `public/` (fără `sw.js`) și `supabase/functions/`, cu excepțiile din prompt;
  - `--lista` scrie toate aparițiile rămase, cu motivul;
  - verificat: o linie nouă cu „Zmeurel OS” îl face să pice.
- Tabelul aparițiilor rămase e în secțiunea 4.

### 3. Mementoul pentru banii neîncasați după 30 de zile (commit `b67848a`)
- `src/lib/notifications/zilnice/neincasate-30.ts` (funcții pure): intră comenzile `livrata` cu rest (aceeași regulă ca în
  Comenzi, `comandaRestDeIncasat`), livrate acum **≥ 30 de zile** (ziua vânzării, altfel `data_livrare`). Textul comun:
  „N comenzi neîncasate de peste 30 de zile · total X lei”.
- Cronul de dimineață (`/api/cron/notificari-dimineata`) are un pas nou, doar pentru proprietar:
  - trimite prin `createNotificationForTenantOwner`, deci respectă liniștea de noapte și comutatorul „Bani de încasat” (`rest`);
  - tipul e `incasari_peste_30`, cu cheia `neincasate30:<fermă>:<zi>`, deci o a doua rulare în aceeași zi nu dublează;
  - mesajul se repetă abia după 7 zile (după ultima notificare de acest tip a fermei);
  - linkul `/comenzi?filter=neincasat30` deschide arhiva pe fila nouă „Peste 30 de zile”.
- „Bani de încasat” rămâne la 7 și 14 zile (pragul de 30 a ieșit, cum ai cerut).
- În Acasă (telefon și desktop): rândul `NeincasatePeste30Acasa`, doar pentru proprietar și doar dacă există comenzi.
- `comenzi` aduce acum și ziua vânzării legate (`vanzare.data`). O primește doar proprietarul; operatorul n-o primește din RPC.
- Teste:
  - selecția: 30 de zile exact, 29, plată parțială, anulată, nelivrată, fără vânzare, altă fermă;
  - regula celor 7 zile;
  - ruta de cron: o singură notificare, fără dublură; nimic la 4 zile după ultima;
  - rândul din Acasă: îl vede proprietarul, nu și operatorul.

### 4. Pierderile din stoc cu motiv (commit `5a8ee36`)
- În Stocuri, butonul „Pierdere” stă lângă „Ajustează”, pe fila culturii. `PierdereStocForm` (StepForm) are pașii:
  - motivul: stricat, consum propriu, donat, altul (la „altul”, textul e obligatoriu);
  - kilogramele (tastatura din aplicație), ziua (`CalendarPanel`) și nota;
  - dacă stocul culturii ar trece sub zero: „Stocul trece sub zero… Notezi totuși?”, iar cererea pleacă abia după
    confirmare, cu `p_sub_zero_confirmat`.
- În istoric apar „Pierdere · stricat”, „Consum propriu” sau „Pierdere” (rândurile vechi). Sumarul: „Pierderi în sezon:
  X kg, din care stricat Y” (sezonul = `inceputSezon`).
- Cu migrarea, „Ajustează stocul” nu mai are Pierdere și Consum propriu (răspunsul 7). Fără migrare, butonul „Pierdere”
  nu apare (detectat prin `schema-features`, grupul `pierderiMotiv`), iar „Ajustează” păstrează plăcile vechi.
- **Drepturi**: aceleași ca la `create_ajustare_stoc` (citit din producție): proprietarul sau operatorul cu „Scrie” pe
  **Comenzi**. `ajustari_stoc` are doar politica de citire (`tenant_id = current_tenant_id()`); scrierea merge numai prin RPC.
- Nu e venit și nu e cheltuială: scrie doar în `ajustari_stoc` și scade stocul culturii prin `cultura`, ca ajustările din 31.
- Teste:
  - regulile: `pierderi.test.ts`;
  - formularul: `PierdereStocForm.test.tsx` (salvarea simplă, confirmarea sub zero, „Altul” care cere textul).

### 9.1 Notificările pe kit (commit `b8cf093`)
- `RandNotificare` (iconița pe tip, titlul, textul, ora, punctul de necitit) e același în foaia clopoțelului și pe `/notificari`.
- Clopoțelul:
  - pe telefon: `BottomSheet`, cu titlul „Notificări” o singură dată, în antetul foii;
  - pe desktop: o fereastră pe tokeni (`z-popover`, `bg-surface`, `shadow-2`), tot cu titlul o singură dată;
  - „Citește tot”, „Vezi toate notificările” (48 px) și numărul de necitite, ținut la fel cu bara de jos;
  - datele nu se schimbă.
- `src/components/notifications` intră în `check:kit`. `PushPermissionBanner` și `NotificationToastProvider` (nerefăcute)
  stau în `KIT_RULE_PENDING_FILES`. Testul vechi al panoului (verifica clasele vechi și nu rula în CI) e rescris și inclus.

### 9.3 Lăstar an 1 / an 2 (commit-uri `2daa3e7`, `c154997`)
- `src/lib/parcele/lastari.ts` (funcții pure) ține:
  - modul de lucru: `an1` / `an1_an2` / `an2`; fără valoare salvată, `an1_an2` dacă parcela are un stadiu pe floricane sau
    sezonul e „mixt”, altfel `an1` (calculat la citire);
  - stadiul curent pe lăstar, etichetele, ciclul și regula pentru plan.
- Foaia Stadiul:
  - la „An 1 + an 2”, comutatorul „Pentru” cu „Floricane · lăstar an 2” / „Primocane · lăstar an 1”;
  - la un singur lăstar, direct stadiul (cohorta se salvează explicit);
  - în „An 1 + an 2”, după „După recoltare primocane”: „Tai tot” (an 1 tăiat) sau „Păstrez o parte pentru anul viitor”
    (**două rânduri** în aceeași zi: `pastrat` pe floricane și `taiat` pe primocane);
  - după „După recoltare floricane”: „Tăiat (lăstarii de an 2 au fost scoși)”;
  - rândurile se scriu pe anul zilei notate.
- Pe card și pe fișă:
  - „An 2: Înflorit · An 1: Creștere lăstari” când ambii lăstari au stadiu, „Lăstar an 2: Primele fructe colorate” când doar unul;
  - eticheta verde trece pe două rânduri (`StatusPill wrap`);
  - jurnalul și întrebarea „A început…?” spun lăstarul pe nume.
- Pe fișă (zmeură, mur; după migrarea `20261125110000`): rândul „Cum lucrezi lăstarii” deschide o foaie cu cele 3 variante.
- **Stadiul curent** = ultimul rând al lăstarului după `data_observata`, iar la aceeași zi ultimul înregistrat, **indiferent
  de an** (răspunsul 14):
  - lista, fișa și foaia citesc anul trecut + anul acesta (`getStadiiCanoniceFermaDoiAni`);
  - `taiat` ca ultim rând = fără stadiu;
  - rândurile vechi fără cohortă: în `an1` / `an2` sunt ale lăstarului; în `an1_an2` se citesc ca până acum.
- Planul și „E timpul pentru…”: din anul trecut contează doar `pastrat` (citit ca `repaus_vegetativ`) și `repaus_vegetativ`
  (răspunsul 15). Cheile stadiilor nu s-au redenumit; `pastrat` și `taiat` sunt valori noi, care nu apar ca plăci.
- Am scos vechiul `mixt` (`isParcelaRubusMixtFenologie`, sumarul vechi și prop-ul foii).
- Teste (`lastari.test.ts`):
  - modul implicit, ordinea după dată, rândurile fără cohortă;
  - toate tranzițiile ciclului, inclusiv cele două rânduri de la „Păstrez”;
  - trecerea de an: un `pastrat` din 15.11.2026 se vede pe 10.01 și 20.03.2027;
  - **1 ianuarie: niciun stadiu de plan din „După recoltare” de anul trecut**;
  - etichetele.

### 9.2 „fără dată de cules” doar când contează (commit `47e6cf6`)
- `culesConteaza` / `lipsaDataCulesConteaza` (`src/lib/analize/cules.ts`): stadiul de acum, pe oricare lăstar, între
  `legare_fruct` și `maturitate` inclusiv, **notat în anul curent**.
- Se aplică în trei locuri: eticheta din lista de parcele, mesajul „Pune data culesului pe parcele…” de pe fișă și cel din
  Acasă (memento). „X kg în <an>” și parcelele cu dată pusă rămân neschimbate (test). Calendarul mementoului
  (21 / 14 / 7 / 3) nu s-a atins.
- Stadiile pe doi ani se citesc printr-un singur hook (`useStadiiParcele`), cu aceeași cheie ca lista.

### 5. Vremea pe Acasă (commit `e6fb87d`)
- `fetch-meteo` / `get-meteo` (**nedeployate**): din prognoza 5 Day / 3 Hour, cerută deja, scot următoarele 3 zile pe ziua
  din București:
  - minima și maxima, ploaia + ninsoarea în mm, vântul maxim în km/h;
  - le țin în `meteo_cache.raw_json.forecast_zile` (cache-ul de 3 ore de acum) și le întorc în răspuns (`forecastZile`).
- Locul fermei:
  - Setări › Ferma întâi, apoi o parcelă (comercială, apoi oricare);
  - fără niciunul, răspunsul e `fara_loc`: **nu mai cade pe Suceava**;
  - aplicația nu cere vremea fără loc (`useLocFerma`) și arată „Pune locul fermei ca să vezi vremea ta”, cu link spre
    `/settings/ferma` (fără geolocalizare automată).
- Cardul existent („Meteo azi” pe desktop, antetul vremii din Acasă pe telefon) primește dedesubt cele 3 zile
  (`PrognozaZile`) și avertizările: îngheț (minima ≤ 0 °C) și ploaie mare (≥ 20 mm). Dacă serviciul nu răspunde, cardul dispare.
- Reparat: `meteoScurt` trata vântul (deja în km/h) ca m/s și îl mai înmulțea o dată cu 3,6 („vânt 22 km/h” la 6 km/h).
- Teste:
  - agregarea pe zile și citirea din cache: `meteo-forecast.test.ts`;
  - avertizările și numele zilelor: `prognoza.test.ts`;
  - componenta: `PrognozaZile.test.tsx`;
  - vântul: `acasa.test.ts`.

### 6. Reparațiile rămase din 31 (commit `982aba5`)
- „Mix fructe” venea din seed-ul demo: parcela „Grădina casei” avea cultura „Mix fructe”. Acum are „Zmeură”, doar pentru
  demo-urile noi. Verificat în smoke: Stocuri n-are fila „Mix fructe”.
- `e2e/onboarding-flows.spec.ts` și `e2e/demo-to-real-conversion.spec.ts` sunt rescrise pe noul `/start`:
  - cele vechi creau și ștergeau utilizatori cu service role în baza de producție;
  - cele noi merg doar prin interfață: gărzile fără sesiune, demo-ul primul, `?demo=1`, ecranul de așteptare, fără „Primii
    pași” în demo, „Creează-ți ferma” din banner → `/start` fără sesiune → formularul de cont nou;
  - rulate local pe `next start`: **6 / 6**.

### 7. Auditul și smoke-ul (commit-uri `2b79d6f`, `756c9dc`)
- Smoke-ul extins (`e2e/smoke/pasi-principali.spec.ts`), rulat local pe `next start` cu un demo nou: **19 / 19**. Pașii noi:
  - Acasă cu vremea, fără „Pune locul fermei” (demo-ul are parcele cu coordonate);
  - foaia clopoțelului;
  - Stocuri pe cultură, fără „Mix fructe” („Pierdere” se sare cu adnotare cât migrarea nu e aplicată);
  - cele 4 taburi din Tratamente și rândul Magaziei;
  - raportul public fără cookie-uri de sesiune și cu `noindex`;
  - foaia Stadiul la Maravilla, cu „Floricane · lăstar an 2 / Primocane · lăstar an 1”;
  - Setări.

  „La poartă” = „Vânzare rapidă” (pasul 4, existent).
- Operatorul demo (`e2e/operator-demo.spec.ts`, rulat o dată: trece):
  - proprietarul unui demo nou invită un operator cu Recoltări: Scrie și Tratamente: Citește;
  - operatorul intră din link, în alt context de browser;
  - `/vanzari`, `/cheltuieli`, `/rapoarte`, `/investitii` și `/settings/ferma/acte` nu se deschid;
  - Magazia nu arată „lei”; Mai mult n-are Vânzări, Cheltuieli, Rapoarte sau Actele fermei;
  - contul ascuns `@operator.zmeurel.local` e legat doar de demo și pleacă odată cu el.

#### Funcțiile `SECURITY DEFINER` din migrările 26–33 (citit din producție pe 24.11.2026)

| Funcție | Migrare | `anon` | `authenticated` | Ferma | Verificare internă |
|---|---|---|---|---|---|
| `operator_can_read(p_module)` | 26 `20261122110000` | nu | da | din sesiune (`current_tenant_id`) | proprietar sau operator activ cu drept pe modul |
| `is_legal_docs_complete(p_tenant_id)` | 27 `20261122121000` | nu | da | **parametru** | proprietarul, un membru activ al fermei, un membru de asociație, superadmin sau service role; altfel `false`. Întoarce doar un boolean (magazinul asociației) |
| `magazie_produse_unitate_fixa()` | 28 `20261122130000` | nu | nu | trigger | — |
| `magazie_sincronizeaza_iesire(p_aplicare_produs_id)` | 28 | nu | nu | din rândul aplicării | internă (o cheamă doar triggerele) |
| `magazie_trg_aplicare()` / `magazie_trg_aplicare_produs()` | 28 | nu | nu | trigger | — |
| `magazie_stoc()` | 28 | nu | da | din sesiune | `operator_can_read('tratamente')`; prețurile `null` pentru operator |
| `magazie_miscari_produs(p_produs_id)` | 28 | nu | da | din sesiune | la fel; produsul filtrat pe ferma din sesiune |
| `magazie_iesiri_aplicari()` | 28 | nu | da | din sesiune | `operator_can_read('tratamente')` |
| `stoc_cal1_pe_cultura(p_tenant_id)` | 31 `20261124100000` | nu | da | **parametru** | refuză orice fermă diferită de cea din sesiune (în afară de service role) |
| `get_sellable_cal1_stock_summary(p_tenant_id)` | 31 | nu | da | **parametru** | la fel (verificat în corpul funcției) |
| `create_ajustare_stoc(…, p_cultura)` | 31 | nu | da | din sesiune | proprietar sau `operator_can_write('comenzi')` |
| `create_pierdere_stoc(…)` | 33 `20261125100000` (neaplicată) | `revoke` în migrare | `grant` în migrare | din sesiune | proprietar sau `operator_can_write('comenzi')` |

Migrările 29 (capcane) și 30 (planul) n-au funcții `SECURITY DEFINER`; nici `20261125110000`. Niciuna dintre funcțiile din
listă nu poate fi apelată de `anon`.

## 2. Migrările (NEAPLICATE), în ordinea de aplicare

Ambele sunt doar aditive: `drop` apare doar în comentariile de anulare, iar pe date nu există niciun `update`.

### 2.1 `supabase/migrations/20261125100000_pierderi_stoc_motiv.sql`

```sql
-- Pierderile din stoc cu motiv (promptul 33).
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Doar aditivă: o coloană nouă cu valoare implicită (Postgres o pune
-- pe rândurile vechi fără să le rescrie; niciun `update`), o constrângere nouă și o funcție nouă. Fără `drop`.
-- Cere migrarea 20261124100000 (`ajustari_stoc.cultura`, aplicată în producție: verificat pe 24.11.2026).
--
-- Ce face:
--   1. `ajustari_stoc.categorie_pierdere`: motivul unei pierderi — `stricat`, `consum_propriu`, `donat`, `altul`.
--      Rândurile vechi (și ajustările care nu sunt pierderi) primesc `nespecificat`.
--   2. `create_pierdere_stoc(...)`: scrie o pierdere (o scădere din stocul culturii). Aceleași drepturi ca
--      `create_ajustare_stoc`: proprietarul sau operatorul cu „Scrie” pe Comenzi. Aceeași gardă de stoc, dar o
--      pierdere care duce stocul sub zero trece dacă omul a confirmat (`p_sub_zero_confirmat`). Ferma vine din
--      sesiune (`current_tenant_id()`), nu din parametri. Deduplică pe cheia formularului (`client_sync_id`).
--      `consum_propriu` se scrie cu tipul `consum_propriu`; celelalte cu tipul `pierdere`. Nu e venit, nu e cheltuială.
--
-- Fără migrare: butonul „Pierdere” nu apare în Stocuri, iar „Ajustează stocul” păstrează plăcile Pierdere și
-- Consum propriu, ca înainte.
--
-- Anulare (doar dacă e nevoie):
--   drop function if exists public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean);
--   alter table public.ajustari_stoc drop constraint if exists ajustari_stoc_categorie_pierdere_check;
--   alter table public.ajustari_stoc drop column if exists categorie_pierdere;

-- 1. Motivul pierderii ------------------------------------------------------------------------------------------------

alter table public.ajustari_stoc
  add column if not exists categorie_pierdere text not null default 'nespecificat';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ajustari_stoc_categorie_pierdere_check'
       and conrelid = 'public.ajustari_stoc'::regclass
  ) then
    alter table public.ajustari_stoc
      add constraint ajustari_stoc_categorie_pierdere_check
      check (categorie_pierdere in ('nespecificat', 'stricat', 'consum_propriu', 'donat', 'altul'));
  end if;
end;
$$;

comment on column public.ajustari_stoc.categorie_pierdere is
  'Motivul unei pierderi (stricat, consum_propriu, donat, altul). nespecificat = rând vechi sau ajustare care nu e pierdere.';

-- 2. Scrierea unei pierderi ------------------------------------------------------------------------------------------

create or replace function public.create_pierdere_stoc(
  p_kg numeric,
  p_categorie text,
  p_detaliu text default null,
  p_data date default null,
  p_cultura text default null,
  p_client_sync_id uuid default null,
  p_sub_zero_confirmat boolean default false
)
returns public.ajustari_stoc
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_kg numeric := round(coalesce(p_kg, 0)::numeric, 2);
  v_categorie text := lower(btrim(coalesce(p_categorie, '')));
  v_detaliu text := nullif(btrim(coalesce(p_detaliu, '')), '');
  v_cultura text := nullif(btrim(coalesce(p_cultura, '')), '');
  v_tip text;
  v_summary record;
  v_available numeric;
  v_row public.ajustari_stoc;
begin
  if v_user_id is null then
    raise exception 'Neautorizat' using errcode = '42501';
  end if;

  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  -- Aceleași drepturi ca `create_ajustare_stoc`.
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only' using errcode = '42501';
  end if;

  if v_categorie not in ('stricat', 'consum_propriu', 'donat', 'altul') then
    raise exception 'Motivul pierderii nu e valid.' using errcode = '22023';
  end if;

  if v_categorie = 'altul' and v_detaliu is null then
    raise exception 'Scrie ce s-a întâmplat.' using errcode = '22023';
  end if;

  if v_kg <= 0 then
    raise exception 'Cantitatea pierderii trebuie să fie mai mare decât 0.' using errcode = '22023';
  end if;

  if p_data is not null and p_data > public.bucharest_today() then
    raise exception 'Ziua pierderii nu poate fi în viitor.' using errcode = '22023';
  end if;

  v_tip := case when v_categorie = 'consum_propriu' then 'consum_propriu' else 'pierdere' end;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  if p_client_sync_id is not null then
    select *
      into v_row
      from public.ajustari_stoc
     where tenant_id = v_tenant_id
       and client_sync_id = p_client_sync_id;

    if found then
      return v_row;
    end if;
  end if;

  -- Garda de stoc a `create_ajustare_stoc` (fără cultură, cultura zmeurei sau fermă fără zmeură), sărită doar când
  -- omul a confirmat că stocul trece sub zero.
  if not coalesce(p_sub_zero_confirmat, false)
     and (
       v_cultura is null
       or translate(lower(v_cultura), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
       or not exists (
         select 1
           from public.recoltari r
          where r.tenant_id = v_tenant_id
            and public.cultura_recoltare_stoc(r.observatii, r.parcela_id, v_tenant_id) like 'zmeur%'
       )
     ) then
    select *
      into v_summary
      from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available - v_kg < 0 then
      raise exception 'STOC_INSUFICIENT'
        using
          detail = format('necesar=%s;disponibil=%s', v_kg, v_available),
          errcode = 'P0001';
    end if;
  end if;

  insert into public.ajustari_stoc (
    tenant_id,
    data,
    delta_kg,
    tip,
    motiv,
    created_by,
    client_sync_id,
    cultura,
    categorie_pierdere
  )
  values (
    v_tenant_id,
    coalesce(p_data, public.bucharest_today()),
    -v_kg,
    v_tip,
    v_detaliu,
    v_user_id,
    p_client_sync_id,
    v_cultura,
    v_categorie
  )
  returning *
  into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean) from public, anon;
grant execute on function public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean) to authenticated, service_role;

comment on function public.create_pierdere_stoc(numeric, text, text, date, text, uuid, boolean) is
  'Pierdere din stoc cu motiv (promptul 33). Proprietarul sau operatorul cu Scrie pe Comenzi; ferma din sesiune.';
```

### 2.2 `supabase/migrations/20261125110000_parcele_mod_lastari.sql`

```sql
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
```

## 3. Decizii luate de mine

- **Ordinea stadiilor, peste tot.** Regula din răspunsul 14 (după `data_observata`, apoi ultimul înregistrat) e și în
  rezolvarea generală a stadiului curent (`resolveStadiuFenologicCurentParcela`), nu doar pe lăstari. O corecție „înapoi”
  cu o zi mai veche nu mai devine stadiul curent. Testul vechi „corecția înapoi” e rescris pe regula nouă.
- **Capcanele, doar pe anul curent.** „În coacere” la capcane citește în continuare doar stadiile din anul curent
  (`getStadiiCanoniceFerma(an)` și ruta de pe server), ca să nu se aprindă în ianuarie de la o „Recoltare” de anul trecut.
- **9.2, doar pe anul curent.** „fără dată de cules” se uită doar la stadiile notate anul acesta, din același motiv:
  stadiul de anul trecut se vede pe card, dar nu pornește eticheta.
- **`pastrat` e o cheie nouă**, nu `repaus_vegetativ`. Altfel, „Păstrez” din toamnă ar suprascrie, prin cheia unică
  `(parcelă, an, stadiu, sursă, cohortă)`, repausul notat primăvara. Pentru plan, `pastrat` contează ca `repaus_vegetativ`.
- **„Ajustează stocul” păstrează plăcile Pierdere și Consum propriu** cât migrarea pierderilor nu e aplicată; altfel n-ar
  mai exista nicio cale de a nota o pierdere.
- **Cheia stadiilor pe doi ani e `['stadii-ferma', an, 'doi-ani']`**: orice invalidare a `stadiiFerma(an)` o reîncarcă, iar
  capcanele și planul își păstrează cererile lor. Aceeași cheie, cu altă formă de date, ar fi amestecat rezultatele.
- **Funcția meteo:** locul din Setări întâi, apoi parcelele (înainte era invers), și fără Suceava implicită (`fara_loc`).
- **Cele două e2e vechi nu mai creează și nu mai șterg utilizatori cu service role**: conturile reale nu se testează automat
  pe baza de producție.
- În mesajul commit-ului `c154997` a dispărut un cuvânt (`mixt`, între backticks, interpretat de shell). Codul e corect;
  am lăsat istoricul cum e (fără rescriere).

## 4. Fiecare „Zmeurel” rămas

Rulat `node scripts/check-brand.mjs --lista`: 320 de apariții, toate intenționate. Pe categorii:

| Categorie | Câte | Unde / de ce rămâne |
|---|---|---|
| teste | 163 | fișierele `__tests__` / `*.test.ts(x)`: adrese de origine oarecare, datele magazinului și ale fermei lui Andrei |
| chei interne | 39 | `zmeurel_*` / `zmeurel:*` (localStorage, sessionStorage), `[zmeurel:…]` din note, `ZMEUREL_TECH_PLATFORM`, `zmeurel.permite_*` (setare SQL) |
| magazinul lui Andrei | 36 | `src/app/comanda/**` (27); `src/lib/shop/campaign-mock.ts`, `b2c-order-helpers.ts`, `pricing.ts` (7); `src/proxy.ts:53` și `src/app/manifest.ts:6` (2, hostul `comanda.zmeurel.ro`) |
| antetele interne | 26 | `x-zmeurel-*` (proxy, layout, rutele care le citesc) |
| comentarii | 25 | comentarii în cod (nu le vede omul) |
| conturile demo / operator | 16 | `@demo.zmeurel.local`, `@operator.zmeurel.local` |
| redirecționarea | 3 | `src/lib/redirect-domeniu.ts:18`, `:21`, `:23`: hosturile vechi `zmeurel.ro`, `www.zmeurel.ro`, `app.zmeurel.ro` |
| chei și etichete `zmeurel-…` | 3 | `zmeurel-association-cart-v1`, `zmeurel-google-push-pending:`, tag-ul push `zmeurel-<tip>` |
| alte rânduri anume | 9 | `src/app/manifest.ts:43`, `:44` (ramura magazinului); `src/components/landing/story.tsx:22` („— Andrei, Ferma Zmeurel”); `src/components/pwa/PWAInstallPrompt.tsx:65` (folosit doar de magazin); `src/lib/brand.ts:91` (`contact@zmeurel.ro` până la `NEXT_PUBLIC_CONTACT_EMAIL`); `src/lib/notifications/send-push.ts:9` (subiectul VAPID, intern); `src/lib/supabase/queries/produse.ts:68` (potrivește textul unei erori SQL; omul vede alt mesaj); `src/lib/ui/dialog-history.ts:2` (`__zmeurelDialog`, marcaj intern); `src/docs/gdpr-data-mapping.md:31` („fostul Zmeurel OS”, istoric) |

Lista completă, cu fișier:linie: `node scripts/check-brand.mjs --lista`.

În afara codului aplicației:
- `scripts/perf/*` (raportul intern de performanță) și scripturile de test cu parole sau proiecte de staging
  (`scripts/seed-production-test-account.mjs`, `test-tenant-isolation.ts`, `check-staging-readiness.mjs`): unelte interne.
- În bază rămân două texte de eroare în funcții SQL, pe care nu le-am schimbat (ar fi cerut `create or replace` pe funcții
  din producție):
  - „…în Zmeurel OS” (`enforce_produse_requires_legal_docs`): aplicația arată alt mesaj;
  - „Doar administratorul Zmeurel (superadmin)…” (`enforce_tenant_association_approval_superadmin_only`): apare doar la o
    încercare fără drept.

## 5. Ce n-am putut testa

- **Tot ce cere migrare:**
  - butonul „Pierdere” și formularul în aplicație (am doar testul de componentă și regulile);
  - funcția `create_pierdere_stoc` rulată pe bază (SQL-ul l-am verificat doar citindu-l, nu executat);
  - rândul „Cum lucrezi lăstarii” și schimbarea modului.
- **Vremea pe 3 zile, în aplicație**: funcțiile meteo nu sunt deployate. Agregarea e testată unitar, componenta la fel.
  „Pune locul fermei” nu l-am văzut live (demo-ul are parcele cu coordonate; îl acoperă testul de componentă).
- **Ciclul „Tai tot / Păstrez / Tăiat”, în browser**: smoke-ul verifică doar comutatorul lăstarilor la Maravilla. Butoanele
  ciclului apar doar după „După recoltare” pe lăstarul ales și nu le-am apăsat în browser; logica și scrierea celor două
  rânduri sunt testate unitar. Trecerea de an, doar în teste.
- **9.2 în browser** (eticheta din listă după stadiu): doar testele unitare.
- **Mementoul de 30 de zile**: n-am apelat cronul (doar testul de rută, cu baza simulată). Notificarea push reală și rândul
  din Acasă pe date reale nu le-am văzut; în demo n-am verificat dacă există comenzi neîncasate de peste 30 de zile.
- **Conturile reale**: email / Google, `/start/ferma`, „Primii pași” (nu creez conturi reale pe baza de producție).
- **Mesajele WhatsApp** pe un telefon real (doar textul, testat).
- **Redirecționarea în producție** și adresele cu `VERCEL_ENV=production` (doar teste).
- **Fereastra clopoțelului pe desktop** (smoke-ul rulează pe mobil). Foaia de pe telefon am verificat-o în panoul de browser
  prin structura paginii (titlul o dată, „Le-ai citit pe toate”, „Nicio notificare.”, „Vezi toate notificările”); captura
  era tăiată de scalarea panoului.

## 6. Verificările (pe codul final, rulate complet)

| Comanda | Rezultat |
|---|---|
| `npm run lint` | trece: 0 erori, 4 avertizări vechi (`chat-post-handler.ts`, `LivratorLivrariClient.tsx`, neatinse) |
| `npm run typecheck` | trece |
| `npm run check:kit` | trece: 356 de fișiere, fără abateri |
| `npm run check:brand` | trece: niciun „Zmeurel” nou (320 de apariții rămase intenționat) |
| `npm run test:critical:unit` | trece: 146 de fișiere, **1247 / 1247** (la prima rulare au picat 2 teste din `redesign-settings.test.ts`, care nu știau de grupul nou `pierderiMotiv`; reparate în `04e6e7c`) |
| `npm run build` | trece (EXIT 0). În log apar mesajele vechi „Dynamic server usage … cookies” de la paginile de Setări (neatinse); nu sunt erori |
| `npm run test:e2e:smoke` (local, `next start`, demo nou) | 19 / 19 |
| `e2e/onboarding-flows` + `e2e/demo-to-real-conversion` (local) | 6 / 6 |
| `e2e/operator-demo` (local) | 1 / 1 |

## 7. Commit-urile

```
8dfd6f7 docs(redesign): promptul 33 — resturile redenumirii, banii neîncasați, pierderile din stoc, vremea, lăstarii, audit final
b070adf fix(brand): originDinUrl acceptă doar http(s) cu host cu punct (localhost doar în afara producției, VERCEL_ENV); orice altceva → https://caietulfermei.ro
176e0f4 feat(brand): mesajele WhatsApp semnate cu numele fermei care trimite (fără nume: neutru); exportul GDPR caietul-fermei-date; check:brand în check:critical
b67848a feat(comenzi): mementoul „N comenzi neîncasate de peste 30 de zile · total X lei” în verificarea de dimineață și în Acasă (doar proprietarul)
5a8ee36 feat(stocuri): „Pierdere” pe cultură, cu motiv (stricat, consum propriu, donat, altul cu text), ziua și o notă; „Pierderi în sezon: X kg, din care stricat Y”
b8cf093 feat(notificari): foaia clopoțelului pe kit — BottomSheet pe telefon (titlul o singură dată), fereastră pe tokeni pe desktop, rândul comun cu pagina „Notificări”
2daa3e7 feat(parcele): lăstar an 1 / an 2 — logica, stadiul curent după dată și peste ani, planul cu pastrat/repaus din anul trecut, eticheta verde pe două rânduri (în lucru)
c154997 feat(parcele): foaia Stadiul pe lăstari — „Floricane · lăstar an 2 / Primocane · lăstar an 1” după modul de lucru, ciclul Tai tot / Păstrez / Tăiat, „Cum lucrezi lăstarii” pe fișă
47e6cf6 feat(parcele): „fără dată de cules” doar când contează — stadiul din anul acesta între „Legare fruct” și „Recoltare”, pe oricare lăstar
e6fb87d feat(acasa): vremea pe următoarele 3 zile pe cardul existent (min / max, ploaie mm, vânt), cu îngheț și ploaie mare; fără loc, „Pune locul fermei ca să vezi vremea ta”
982aba5 fix(demo): „Grădina casei” din demo-ul Fructe de pădure are cultura Zmeură (fără fila „Mix fructe” în Stocuri); e2e onboarding și conversia demo → fermă reală rescrise pe noul /start
2b79d6f test(smoke): pașii promptului 33 — vremea fără „Pune locul fermei”, foaia clopoțelului, Stocuri pe cultură fără „Mix fructe” (+ „Pierdere” doar cu migrarea), cele 4 taburi din Tratamente, raportul public fără cookie-uri și cu noindex, foaia Stadiul pe lăstari, Setări
756c9dc test(e2e): operatorul din link, într-un demo nou, nu vede bani, prețuri din Magazie sau actele fermei
04e6e7c test(schema-features): grupul pierderiMotiv (ajustari_stoc.categorie_pierdere, migrarea 20261125100000) în probele de dinainte și de după migrare
```

Plus commit-ul acestui raport (ultimul de pe branch).
