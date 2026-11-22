# Raport 26 — Analizele la fructe, mementoul dinainte de cules, „Atestat de producător”

Branch: `redesign/analize-26`, pornit din `main` (`e1384fd`, care conține `docs/redesign/raport-25-decizii.md`). Fără merge.
Două migrări scrise, **neaplicate**. Din baza de date am citit doar cu `select` (`information_schema.columns`, `pg_policies`,
`pg_proc`, `storage.buckets`, valorile distincte din `parcele.rol` și `stadii_fenologice_parcela.stadiu`). Cronurile nu au
fost apelate. `public/sw.js` nu e atins (modificarea locală din el nu e a mea și nu e comisă).

## Rezumat pentru Andrei

1. **„Atestat de producător”** peste tot (Actele fermei, foaia, bannerul, Setări, cronul `farmer-legal-docs-check`), „valabil până la” în loc de „viza”, iar confirmarea spune exact ce apare public. În bază rămân `certificat_producator` și `certificate_*`. Nicio pagină publică nu arată numărul sau poza atestatului.
2. **Widgetul beta** e un punct mic în colțul de sus și se deschide doar la atingere. Stă sub foi și sub formularele pe pași.
3. **Tratamente → „Analize”**: lista, „Analiză nouă” pe 2 pași (cu `client_sync_id`), fișa analizei (etapele, plus tratamentele din cele 30 de zile dinainte, cu pauza respectată sau nu), rezultatul și raportul (link, PDF, afiș A4 cu QR, „Ce apare în raport”).
4. **Raportul public `/a/<token>`**: fără cont, `noindex`, 404 dacă analiza nu e conformă sau linkul e oprit. Câmpurile interzise sunt filtrate într-un singur loc și testate.
5. **Mementoul dinainte de cules**: notificare doar pentru proprietar, la 21, 14, 7 și 3 zile, apoi zilnic. Are butoanele „Am trimis” (deep link) și „Amână 3 zile” (POST cu cookie-ul sesiunii), adăugate în `public/push-handlers.js`, nu în `sw.js`.
6. **Programarea**: niciun cron nou. Rulează în verificarea de dimineață existentă (05:00 UTC, adică 8:00 vara și 7:00 iarna).
7. **Acasă**: cardul „Analiza la fructe · culesul în N zile” (primul), foaia „Analiza dinainte de cules” și avertizarea roșie la o analiză neconformă. **Fișa parcelei**: culesul estimat, cu „Schimbă”, și rândul analizei.
8. **Setări → Notificări**: comutatorul, zilele, „Zilnic din ziua culesului” și „Anul acesta nu fac analize”. În formularul de tratament apare avertizarea „Pauza trece de începutul culesului”, care doar avertizează. În Rapoarte e noul export „Analizele sezonului”.
9. **Ordinea migrărilor**: întâi merge, apoi `20261122110000` (analizele), apoi `20261122111000` (mementoul). Fără ele aplicația merge ca azi, iar Analizele arată „după actualizarea bazei de date”.
10. **Ce n-am putut testa în browser**: tot ce scrie în tabelele noi (migrările nu sunt aplicate). Logica e acoperită de teste unitare. În browser am verificat ce se vede fără migrări (§6).

## 1. Ce am schimbat, pe bucăți

### A. „Atestat de producător”

- `src/lib/acte/atestat.ts` (nou): eticheta, textul confirmării și cele trei notificări din cron (sursa unică, testată).
- `LEGAL_TYPE_OPTIONS` / `LEGAL_TYPE_LABELS`: „Atestat de producător”. Erorile de validare spun „Seria/Numărul atestatului”.
- `stareActe`: „numărul atestatului”, „seria atestatului”, „valabilitatea”, „poza atestatului” (deci și bannerul și rândul din Setări).
- Foaia actelor: titlul „Atestat de producător”, câmpul „Valabil până la”, „Poza atestatului”. Ecranul arată „valabil până la 15.07.2031”, iar avertizările spun „Atestatul a expirat” / „Atestatul expiră curând”, cu „A fost valabil până la …”.
- **Confirmarea**: „Confirm că datele sunt corecte” și, dedesubt, textul cerut întocmai: „Când magazinul și asociația revin, public apar doar numele fermei, localitatea, seria și valabilitatea atestatului și telefonul de contact. Numărul și poza atestatului nu se afișează.”
- Setări: „Atestatul a expirat / expiră pe …”; Ferma: „Formă juridică, atestat de producător, contact”.
- **Verificarea paginilor publice**: am căutat `certificate_number`, `certificate_photo_url`, `certificate_series` și `farmer_legal_docs` în tot `src`. Le folosesc doar ecranul Actele fermei, `/api/legal-docs` (autentificat), cronul, seed-ul demo și noul `raport-server.ts`. Acesta din urmă cere doar `legal_type, certificate_series, certificate_expiry, locality, phone`. Magazinul (`/magazin`, `/comanda`) și asociația nu citesc actele fermei. **Nicio pagină publică nu arată numărul sau poza atestatului.**

### A2. Widgetul „Ești în beta”

`src/components/beta-widget.tsx` e rescris. Acum e un punct de 10 px într-un buton de 28 px, în colțul din dreapta sus al carcasei (`top: safe-area + 4px`). La atingere deschide caseta de acum („Ai o problemă sau o sugestie?” și „Scrie-mi pe WhatsApp”), care se închide cu X, cu Esc sau cu o atingere în afară. Nu se mai deschide singur, deci contorul de sesiuni din `localStorage` a dispărut. Stratul e `z-fab`, sub `z-overlay` / `z-modal`, deci foile și formularele pe pași stau deasupra. Fiindcă stă sus, nu mai acoperă bara de jos și butoanele fixate jos.

### B. Analizele la fructe

**Date** (migrarea `20261122110000`, §4): `analize_fructe`, `analize_fructe_parcele` (mai multe parcele pe o analiză), `analize_fructe_substante`, funcția `operator_can_read(p_module)`, RLS (citire pentru proprietar și operatorul cu „Tratamente”, scriere pentru proprietar și `operator_can_write('tratamente')`, ștergere doar pentru proprietar), bucketul privat `analize` cu politici pe prefixul tenantului și `tenant_settings.analize_public_implicit` (implicitele raportului pe fermă). Laboratoarele folosite se propun din analizele anterioare (`laboratoareFolosite`), fără tabel nou.

**Logica** (`src/lib/analize/`, fără React, testată):
- `model.ts`: forma rândului, opțiunile publice (implicitele: substanțe, tratamente, numere și telefon pornite, poza buletinului oprită), `optiuniEfective` (aplicație ← fermă ← analiză).
- `lista.ts`: ordinea (cele la laborator sus), „Ultima analiză”, titlurile („Maravilla 1 + 2 · prelevată 3 iul.”), rândul de pe fișa parcelei, neconformele încă deschise.
- `tratamente-inainte.ts`: tratamentele din cele 30 de zile dinainte de prelevare, pe parcelele analizei (aplicările noi și tratamentele vechi din Activități), grupate pe lot, cu „pauza de 7 zile respectată” sau „… nu era încheiată la prelevare”.
- `raport.ts`: `construiesteRaport` alege **doar** câmpurile permise și întoarce `null` pentru neconform, la laborator sau link oprit. Tot aici sunt HTML-ul pentru PDF și pentru afișul A4 (text scăpat).
- `raport-server.ts`: citirea cu service role pentru pagina publică și pentru raportul din aplicație. Verifică întâi starea, apoi citește restul.

**Ecranele** (`src/components/analize/`, kit, `check:kit` trece):
- În `/tratamente`, un `Segments` „Aplicări / Analize” (`?tab=analize`). Sus e „Ultima analiză” (verdict, parcele, data buletinului), dedesubt lista, cu cele „la laborator” sus și în albastru. Butonul „Analiză nouă” stă jos pe telefon și în pagină pe desktop.
- **„Analiză nouă”** (`StepForm`, 2 pași):
  1. parcelele de vânzare (bifare multiplă, plus „Toate parcelele de vânzare”), data prelevării (`CalendarPanel`);
  2. PV-ul (numărul și poza), cine a prelevat, laboratorul (cu propuneri), data predării (aceeași zi / altă zi), nota.

  Trimite `client_sync_id`, iar un 23505 pe cheie se tratează ca reușită. La închiderea cu ceva nesalvat apare confirmarea. Deep link: `/tratamente?tab=analize&noua=1&parcele=<id,id>`. Același formular face și „Editează prelevarea”.
- **Fișa analizei** (`BottomSheet`): etapele (Prelevată / Predată / Rezultat, cu linkul semnat spre poza PV), tratamentele din cele 30 de zile dinainte și butoanele „Adaugă rezultatul” (sau „Editează rezultatul”), „Editează prelevarea” și „Vezi raportul”. Foaia se închide înainte să se deschidă un formular.
- **„Rezultatul”**: Conform / Neconform, numărul și data buletinului, buletinul (poză micșorată sau PDF), „Ce s-a analizat (din buletin)”, substanțele cu „+ Substanță” și „Restul substanțelor analizate: nedetectate”. „Neconform” oprește linkul public (`public_activ = false`). „Salvează și fă raportul” deschide apoi raportul.
- **Raportul** (`RaportSheet`): raportul din `/api/analize/<id>/raport` (aceleași câmpuri ca pagina publică), „Distribuie linkul” (Web Share, cu WhatsApp ca rezervă), „Descarcă PDF” și „Afiș A4 cu QR” (fereastra de tipărire, ca exportul din Rapoarte). Urmează „Ce apare în raport”, cu comutatoarele din mockup și „Linkul public e activ”, salvate pe analiză. Proprietarul are și „Folosește aceste alegeri la toate analizele”, care le salvează ca implicite pe fermă.
- **Fișa parcelei**: „Ultima analiză: conform · vezi raportul” (deschide direct raportul, `?raport=<id>`), „Analiza sezonului: la laborator” sau „netrimisă”. La neconform apare o avertizare roșie.
- **Acasă**: avertizarea roșie „Analiză neconformă · …”. Dispare când fiecare parcelă are o analiză conformă prelevată după ea.
- **Rapoarte → Exportă**: „Analizele sezonului” (Excel + PDF), o listă cu analizele prelevate în perioada aleasă.

**Pagina publică `/a/[token]`**: server component, citire cu service role, `dynamic = 'force-dynamic'`, `robots: noindex, nofollow`. Există doar pentru `status = 'conform'` și `public_activ`, altfel `notFound()`. Tokenul se validează (`[A-Za-z0-9_-]{10,64}`) înainte de orice citire. Ruta e în `isPurePublicNoAuthBypassRoute` din `proxy.ts` (fără sesiune; cookie-urile se șterg din cerere) și în lista rutelor publice. Conținutul: numele fermei și localitatea, „Atestat de producător seria X · valabil până la …” (doar dacă forma e atestat), parcelele și soiul, prelevarea (data, PV, cine), laboratorul, buletinul (număr, dată), „Analiza: …”, substanțele (găsit / limită) cu „restul nedetectate”, tratamentele din cele 30 de zile dinainte cu pauza respectată, telefonul (după opțiuni) și codul QR spre același link. Dependența nouă e `qrcode` (+ `@types/qrcode`).

### C. Mementoul dinainte de cules

- **Când începe culesul** (`estimeazaCules`): întâi data pusă de mână pe fișa parcelei, pe sezon. Am refolosit `configurari_parcela_sezon` (are deja cheia `(parcela_id, an)` și drepturile Parcele), cu coloana nouă `data_inceput_cules`. Altfel, ziua primei recoltări de anul trecut, mutată în anul curent (29.02 devine 28.02). Altfel nimic, iar fișa arată „Pune data culesului”.
- **Ajustarea după stadiu: sărită.** `stadii_fenologice_parcela` are doar stadiul și ziua observată (valorile din producție: `buton_verde`, `inflorit`, `fruct_verde`, `parga`, `maturitate` …), fără durate pe soi. Nu există o regulă clară „stadiul X ⇒ culesul peste N zile”.
- **Calendarul** (`calculeazaMemento`, aceeași funcție în cron și în aplicație): cel mai apropiat început de cules dintre parcelele de vânzare fără analiză. Grupează parcelele care încep în aceeași săptămână (7 zile). Trimite la 21, 14, 7 și 3 zile (zilele se schimbă din Setări), apoi zilnic din ziua culesului (cel mult 45 de zile). „Amână” 1, 3 sau 7 zile suspendă totul până în ziua aceea, iar în ziua respectivă pleacă din nou. Se oprește la o analiză cu prelevarea între „începutul culesului − 60 de zile” și sfârșitul anului, pe acele parcele, la „Nu fac analize anul acesta” (doar sezonul curent) sau din comutator.
- **Doar proprietarul**: cronul trimite cu `createNotificationForTenantOwner`. Rutele „Amână” și „Nu anul acesta” verifică `isFarmOwner`, iar RLS-ul tabelului de stare e doar pentru proprietar. Operatorul nu vede cardul.
- **Liniștea 22–6**: tipul `analize_memento` are comutatorul `analize` în „Ce primești”. `permitePush` oprește push-ul noaptea, iar notificarea rămâne oricum în listă.
- **Textul**: „Peste 21 de zile începe culesul” / „Maravilla 1 și 2. Programează analiza la fructe și evită acum produsele cu pauză lungă (2 în fermă).” Produsele fermei înseamnă catalogul propriu plus produsele folosite în tratamente. Lista include pauza **mai lungă** decât zilele rămase și, ca în mockup, pe cea **egală**, marcată „la limită”. Ambele intră în număr. Din ziua culesului intră orice produs cu pauză.
- **Cardul din Acasă** (primul, pe orice ecran): „Analiza la fructe · culesul în N zile”, cu „Am trimis” și „Amână”. Stă până la trimitere, amânare sau dezactivare.
- **Foaia „Analiza dinainte de cules”** (`BottomSheet`, din card sau din notificare: `/dashboard?memento=analize`): „Culesul începe în ~N zile”, parcelele și data estimată, „Produse de evitat acum”, amânarea 1 / 3 / 7 și butoanele „Am trimis la analize”, „Amână N zile”, „Nu fac analize anul acesta”.
- **Setări → Notificări** („Ce primești”, doar proprietarul): „Analiza dinainte de cules” (comutator), „Cu câte zile înainte” (21 / 14 / 7 / 3 / 1, mai multe deodată), „Zilnic din ziua culesului”, „Anul acesta nu fac analize”. Primele trei stau în `notificari_preferinte.tipuri` (`analize`, `analize_zile`, `analize_zilnic`), fără migrare. Ultimul stă în `memento_analize_sezon`.
- **Avertizarea la tratament**: în formularul de tratament, când pauza produselor alese trece de începutul culesului estimat al unei parcele alese, apare textul din mockup („Pauza trece de începutul culesului · Culesul la Maravilla 1 e estimat peste 21 de zile; pauza ține 28. Poți salva, dar fructele n-ar trebui culese și analizate înainte de 29 iunie.”). **Doar avertizează.** Apare în pasul cu produsele, lângă avertismentele FRAC / interval, și ține cont de ziua tratamentului (azi, altă zi sau planificat).

### D. Demo

`src/lib/demo/demo-analize.ts`, chemat din seed doar pentru demo-urile noi „Fructe de pădure”. Adaugă:
- o analiză conformă pe Maravilla + Delniwa Nord (PV 1180, DSVSA, LSVSA Suceava, buletin 4415), cu 2 substanțe marcate „(exemplu)” și linkul public activ;
- data culesului pe fiecare parcelă de vânzare (Maravilla 22 iunie, Delniwa 1 iulie, restul 10 iulie, în anul curent).

Fără migrări nu scrie nimic și nu oprește demo-ul. Datele existente nu se ating. Limitare: la **reîncărcarea** unui demo, analiza veche rămâne fără parcele (parcelele se șterg, legăturile pleacă în cascadă) și se adaugă una nouă. Am lăsat așa, fiindcă reîncărcarea șterge doar rândurile marcate demo, iar analizele n-au marcaj.

## 2. Cum se programează mementoul

- **Fără cron nou.** E un pas în plus în `/api/cron/notificari-dimineata` (deja zilnic la 05:00 UTC în `vercel.json`, adică 8:00 vara și 7:00 iarna, ora României). Culesul e vara, deci notificarea pleacă la 8:00. Planul Hobby nu e afectat (același număr de cronuri, o dată pe zi). `vercel.json` nu e schimbat.
- Pentru fiecare fermă reală (aceeași regulă ca restul verificării: fără demo, fără conturi de test), `decizieMementoFerma` doar citește. Dacă `trimiteAzi`, se trimite o notificare proprietarului, cu cheia `analize:<fermă>:<zi>` (dublurile se sar). După trimitere, ziua se notează în `memento_analize_sezon.ultima_trimitere`.
- Fără migrarea `20261122111000` pasul nu trimite nimic (`motiv: indisponibil`), fiindcă amânarea nu s-ar putea ține minte.
- Cronul n-a fost apelat. Testul de rută simulează o fermă: pleacă o singură notificare la 21 de zile, cu butoanele, iar a doua rulare din aceeași zi e dublură.

## 3. Acțiunile din notificare

`public/sw.js` se generează de `next-pwa`, iar handlerele push vin din `public/push-handlers.js` (`importScripts` din `next.config.js`). **Acțiunile s-au putut adăuga acolo, fără să ating `sw.js`.**
- Serverul: `notifications.data.push_actions` (pus doar de cod) → `pushActionsDinDate` (doar căi relative din aplicație, cel mult două) → câmpul `actions` din payload. Până acum era mereu `[]`.
- Service worker-ul arată cele două butoane. „Am trimis” deschide `/tratamente?tab=analize&noua=1&parcele=…`. „Amână 3 zile” face `fetch('/api/analize/memento/amana', { method: 'POST', credentials: 'include' })`, adică autentificat cu cookie-ul sesiunii, fără token în URL. Dacă cererea pică (fără sesiune sau fără internet), deschide aplicația pe foaia mementoului.
- Atingerea notificării (fără buton) deschide `/dashboard?memento=analize`, adică foaia cu toate opțiunile.
- Ruta verifică originea (`validateSameOriginMutation`; service worker-ul trimite `Origin`) și că utilizatorul e proprietarul.
- **Netestat pe un telefon real** (§5): butoanele și cererea din service worker se văd doar cu push activ pe Android.

## 4. Migrările (scrise, neaplicate) și ordinea lor

**Ordinea:**
1. merge;
2. `20261122110000_analize_fructe.sql`;
3. `20261122111000_cules_memento_analize.sql`.

Amândouă sunt aditive (tabele, coloane, o funcție, un bucket și politici noi) și nu ating date existente. Se pot rula de mai multe ori (`if not exists` / `drop policy if exists`).

| Migrarea | Aplicația fără ea |
|---|---|
| `20261122110000` | Merge. Tab-ul „Analize” arată „Analizele vor merge după actualizarea bazei de date” (fără „Analiză nouă”), `/a/<token>` dă 404, cardul din Acasă și rândul analizei de pe fișă lipsesc, iar exportul „Analizele sezonului” e gol. Restul aplicației merge ca azi. |
| `20261122111000` | Merge. Culesul se estimează doar din prima recoltare de anul trecut (pe fișă, „Schimbă” arată „Se poate salva după actualizarea bazei de date”). „Amână” / „Nu fac analize anul acesta” răspund „după actualizarea bazei de date”. Cronul nu trimite mementoul, fiindcă n-ar ține minte amânarea. |

### `supabase/migrations/20261122110000_analize_fructe.sql`

```sql
-- Analizele la fructe (promptul 26, partea B). Doar aditiv: 3 tabele noi, o funcție nouă, un bucket privat,
-- o coloană nouă în `tenant_settings`. Nu atinge date existente.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de 20261122111000 (mementoul), dar se rulează înaintea ei
-- (mementoul citește `analize_fructe` ca să știe când să se oprească).
-- Schema de pornire citită din producție pe 22.11.2026 (`information_schema.columns`, `pg_policies`, `pg_proc`).
--
-- Ce adaugă:
--   * `analize_fructe`: o analiză (prelevarea, rezultatul, linkul public). Fără tip de analiză: ce s-a analizat
--     se scrie din buletin în `ce_s_a_analizat`.
--   * `analize_fructe_parcele`: parcelele unei analize (mai multe pe o analiză; aplicația oferă doar parcelele
--     comerciale, nu pe cele „Personal”).
--   * `analize_fructe_substante`: substanțele găsite (opționale), cu valoarea și limita.
--   * `operator_can_read(p_module)`: proprietarul sau operatorul cu „Citește” / „Scrie” pe modul. Pentru
--     `tratamente` respectă compatibilitatea din `resolveFarmMemberAccess`: un rând vechi cu `activitati` și fără
--     `tratamente` primește citire; un `{ module: 'tratamente', level: 'none' }` explicit o refuză.
--   * RLS: citire pentru proprietar și operatorul cu „Tratamente” (citește sau scrie); scriere pentru proprietar
--     și `operator_can_write('tratamente')`; ștergere doar proprietarul. Toate pe `tenant_id = current_tenant_id()`.
--   * Bucket privat `analize` (poza PV-ului, buletinul): politici pe prefixul tenantului (`<tenant_id>/...`),
--     ca `bonuri`, cu aceleași drepturi ca tabelul.
--   * `tenant_settings.analize_public_implicit jsonb`: ce apare implicit în raportul public, pe fermă.
--
-- Pagina publică `/a/<token>` citește cu service role (fără politică pentru `anon`), doar pentru
-- `status = 'conform'` și `public_activ = true`, și doar câmpurile permise.
--
-- Până la aplicare: tab-ul „Analize” din Tratamente arată „Analizele vor merge după actualizarea bazei de date”
-- (eroarea „tabelul lipsește” e prinsă), `/a/<token>` dă 404, mementoul nu pornește, fișa parcelei nu arată rândul
-- analizei, iar exportul „Analizele sezonului” iese gol. Restul aplicației merge ca azi.
--
-- Anulare (doar dacă e nevoie; pierde analizele salvate):
--   drop table if exists public.analize_fructe_substante;
--   drop table if exists public.analize_fructe_parcele;
--   drop table if exists public.analize_fructe;
--   drop function if exists public.operator_can_read(text);
--   alter table public.tenant_settings drop column if exists analize_public_implicit;
--   -- bucketul `analize` și politicile lui din storage.objects se șterg din panoul Supabase.

begin;

-- ─── Dreptul de citire pe un modul ────────────────────────────────────────────────────────────────

create or replace function public.operator_can_read(p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_access jsonb;
begin
  if auth.uid() is null then
    return false;
  end if;

  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then
    return false;
  end if;

  if public.is_tenant_owner(v_tenant_id) then
    return true;
  end if;

  select fm.modules_access
  into v_access
  from public.farm_members fm
  where fm.user_id = auth.uid()
    and fm.tenant_id = v_tenant_id
    and fm.is_active = true
    and fm.role = 'operator'
  order by fm.created_at asc
  limit 1;

  if not found or v_access is null or jsonb_typeof(v_access) <> 'array' then
    return false;
  end if;

  -- Dreptul explicit pe modul.
  if exists (
    select 1 from jsonb_array_elements(v_access) as item(value)
    where item.value ->> 'module' = p_module
      and item.value ->> 'level' in ('read', 'write')
  ) then
    return true;
  end if;

  -- Compatibilitatea Tratamente: rândurile vechi aveau doar `activitati`. Un refuz explicit (`none`) câștigă.
  if p_module = 'tratamente'
    and not exists (
      select 1 from jsonb_array_elements(v_access) as item(value)
      where item.value ->> 'module' = 'tratamente'
    )
    and exists (
      select 1 from jsonb_array_elements(v_access) as item(value)
      where item.value ->> 'module' = 'activitati'
        and item.value ->> 'level' in ('read', 'write')
    ) then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.operator_can_read(text) from public, anon;
grant execute on function public.operator_can_read(text) to authenticated, service_role;

comment on function public.operator_can_read(text) is
  'Proprietarul sau operatorul cu citire/scriere pe modul (tratamente: și rândurile vechi cu doar activitati).';

-- ─── analize_fructe ───────────────────────────────────────────────────────────────────────────────

create table if not exists public.analize_fructe (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_sync_id uuid null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prelevarea
  data_prelevare date not null,
  pv_numar text null,
  pv_poza_path text null,
  prelevat_de text null check (prelevat_de is null or prelevat_de in ('dsvsa', 'laborator', 'eu')),
  laborator text null,
  data_predare date null,
  nota text null,

  -- Rezultatul
  status text not null default 'la_laborator' check (status in ('la_laborator', 'conform', 'neconform')),
  buletin_numar text null,
  buletin_data date null,
  buletin_path text null,
  ce_s_a_analizat text null,
  rest_nedetectate boolean null,

  -- Publicul
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  public_activ boolean not null default true,
  public_optiuni jsonb null,

  constraint analize_fructe_public_token_len check (char_length(public_token) >= 10)
);

comment on table public.analize_fructe is 'Analizele la fructe (reziduuri): prelevarea, rezultatul din buletin, linkul public.';
comment on column public.analize_fructe.public_token is
  'Tokenul linkului public /a/<token>: aleator (32 de caractere hex), negăsibil. Pagina există doar pentru conform + public_activ.';
comment on column public.analize_fructe.public_optiuni is
  'Suprascrierea pe analiză a implicitelor fermei (tenant_settings.analize_public_implicit): substante, tratamente, numere, poza_buletin, telefon.';

create unique index if not exists analize_fructe_tenant_client_sync_key
  on public.analize_fructe (tenant_id, client_sync_id)
  where client_sync_id is not null;

create index if not exists idx_analize_fructe_tenant_prelevare
  on public.analize_fructe (tenant_id, data_prelevare desc);

alter table public.analize_fructe enable row level security;

drop policy if exists analize_fructe_select on public.analize_fructe;
create policy analize_fructe_select on public.analize_fructe for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists analize_fructe_insert on public.analize_fructe;
create policy analize_fructe_insert on public.analize_fructe for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_update on public.analize_fructe;
create policy analize_fructe_update on public.analize_fructe for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_delete on public.analize_fructe;
create policy analize_fructe_delete on public.analize_fructe for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── analize_fructe_parcele ───────────────────────────────────────────────────────────────────────

create table if not exists public.analize_fructe_parcele (
  analiza_id uuid not null references public.analize_fructe(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (analiza_id, parcela_id)
);

comment on table public.analize_fructe_parcele is 'Parcelele unei analize (o probă comună sau toate parcelele din același PV).';

create index if not exists idx_analize_fructe_parcele_tenant_parcela
  on public.analize_fructe_parcele (tenant_id, parcela_id);

alter table public.analize_fructe_parcele enable row level security;

drop policy if exists analize_fructe_parcele_select on public.analize_fructe_parcele;
create policy analize_fructe_parcele_select on public.analize_fructe_parcele for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists analize_fructe_parcele_insert on public.analize_fructe_parcele;
create policy analize_fructe_parcele_insert on public.analize_fructe_parcele for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_parcele_delete on public.analize_fructe_parcele;
create policy analize_fructe_parcele_delete on public.analize_fructe_parcele for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

-- ─── analize_fructe_substante ─────────────────────────────────────────────────────────────────────

create table if not exists public.analize_fructe_substante (
  id uuid primary key default gen_random_uuid(),
  analiza_id uuid not null references public.analize_fructe(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  substanta text not null,
  valoare_mg_kg numeric null check (valoare_mg_kg is null or valoare_mg_kg >= 0),
  lmr_mg_kg numeric null check (lmr_mg_kg is null or lmr_mg_kg >= 0),
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.analize_fructe_substante is 'Substanțele găsite într-o analiză (opțional): valoarea și limita maximă (LMR), în mg/kg.';

create index if not exists idx_analize_fructe_substante_analiza
  on public.analize_fructe_substante (analiza_id, ordine);
create index if not exists idx_analize_fructe_substante_tenant
  on public.analize_fructe_substante (tenant_id);

alter table public.analize_fructe_substante enable row level security;

drop policy if exists analize_fructe_substante_select on public.analize_fructe_substante;
create policy analize_fructe_substante_select on public.analize_fructe_substante for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists analize_fructe_substante_insert on public.analize_fructe_substante;
create policy analize_fructe_substante_insert on public.analize_fructe_substante for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_substante_update on public.analize_fructe_substante;
create policy analize_fructe_substante_update on public.analize_fructe_substante for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_substante_delete on public.analize_fructe_substante;
create policy analize_fructe_substante_delete on public.analize_fructe_substante for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

-- ─── Implicitele raportului public, pe fermă ──────────────────────────────────────────────────────

alter table public.tenant_settings
  add column if not exists analize_public_implicit jsonb null;

comment on column public.tenant_settings.analize_public_implicit is
  'Ce apare implicit în raportul public al analizelor: {substante, tratamente, numere, poza_buletin, telefon}. Null = implicitele aplicației.';

-- ─── Storage: bucket privat `analize` ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('analize', 'analize', false)
on conflict (id) do nothing;

drop policy if exists "Analize: citire pe tenant" on storage.objects;
create policy "Analize: citire pe tenant" on storage.objects for select to authenticated
  using (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_read('tratamente')
  );

drop policy if exists "Analize: urcare pe tenant" on storage.objects;
create policy "Analize: urcare pe tenant" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  );

drop policy if exists "Analize: înlocuire pe tenant" on storage.objects;
create policy "Analize: înlocuire pe tenant" on storage.objects for update to authenticated
  using (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  )
  with check (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  );

drop policy if exists "Analize: ștergere pe tenant" on storage.objects;
create policy "Analize: ștergere pe tenant" on storage.objects for delete to authenticated
  using (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  );

commit;
```

### `supabase/migrations/20261122111000_cules_memento_analize.sql`

```sql
-- Mementoul dinainte de cules (promptul 26, partea C). Doar aditiv: o coloană nouă și un tabel nou.
--
-- NEAPLICATĂ: o rulează Andrei, după merge și după 20261122110000 (analizele).
-- Schema de pornire citită din producție pe 22.11.2026.
--
-- Ce adaugă:
--   * `configurari_parcela_sezon.data_inceput_cules date null`: data pusă de mână pe fișa parcelei
--     („Culesul începe pe ~… · Schimbă”), pe parcelă și pe sezon (`an`). Tabelul are deja cheia unică
--     `(parcela_id, an)` și politicile pe drepturile Parcele (`operator_can_write('parcele')`), deci data se
--     salvează cu `upsert` pe `(parcela_id, an)`, fără politici noi.
--   * `memento_analize_sezon`: starea mementoului pe fermă și sezon: amânat până la, „Nu fac analize anul acesta”,
--     ultima trimitere. Doar proprietarul (el primește mementoul) citește și scrie. Cronul de dimineață citește cu
--     service role.
--
-- Setările (comutatorul, „Cu câte zile înainte”, „Zilnic din ziua culesului”) stau în preferințele de notificări
-- existente (`notificari_preferinte.tipuri`: cheile `analize`, `analize_zile`, `analize_zilnic`), fără migrare.
--
-- Până la aplicare: data culesului se estimează doar din prima recoltare de anul trecut (fișa nu poate salva data
-- pusă de mână și arată „Schimbă” dezactivat cu explicație), „Amână” și „Nu fac analize anul acesta” răspund
-- „după actualizarea bazei de date”, iar cronul nu trimite mementoul (nu poate ține minte amânarea).
--
-- Anulare (doar dacă e nevoie; pierde datele de cules puse de mână și amânările):
--   drop table if exists public.memento_analize_sezon;
--   alter table public.configurari_parcela_sezon drop column if exists data_inceput_cules;

begin;

alter table public.configurari_parcela_sezon
  add column if not exists data_inceput_cules date null;

comment on column public.configurari_parcela_sezon.data_inceput_cules is
  'Începutul culesului pus de mână pe fișa parcelei, pentru sezonul `an`. Null = se estimează din prima recoltare de anul trecut.';

create table if not exists public.memento_analize_sezon (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  an integer not null check (an between 2000 and 2100),
  amanat_pana date null,
  dezactivat boolean not null default false,
  ultima_trimitere date null,
  ultima_cheie text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, an)
);

comment on table public.memento_analize_sezon is
  'Mementoul „analiza dinainte de cules”, pe fermă și sezon: amânat până la, dezactivat pe sezon, ultima trimitere.';

alter table public.memento_analize_sezon enable row level security;

drop policy if exists memento_analize_sezon_select on public.memento_analize_sezon;
create policy memento_analize_sezon_select on public.memento_analize_sezon for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

drop policy if exists memento_analize_sezon_insert on public.memento_analize_sezon;
create policy memento_analize_sezon_insert on public.memento_analize_sezon for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

drop policy if exists memento_analize_sezon_update on public.memento_analize_sezon;
create policy memento_analize_sezon_update on public.memento_analize_sezon for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

commit;
```

## 5. Ce n-am putut testa

- **Tot ce scrie în tabelele noi**: analiza pe 2 parcele, rezultatul conform cu raportul, PDF-ul, afișul, linkul public deschis fără cont, neconform fără link, data culesului salvată pe fișă, „Amână” și „Nu anul acesta”. Migrările nu sunt aplicate și nu am voie să le aplic. Logica acestor fluxuri e acoperită de teste unitare (§7): pagina publică dă 404 pentru neconform / la laborator / link oprit, câmpurile interzise nu apar în raport, PDF sau afiș, iar calendarul mementoului și cronul sunt testate.
- **Operatorul cu „Tratamente: Citește”**: politicile RLS noi există doar după migrare. În cod, butoanele de scriere (Analiză nouă, Adaugă / Editează rezultatul, Editează prelevarea, „Ce apare în raport”) sunt ascunse când `poateScrie` e fals, ca în restul Tratamentelor, și n-am găsit nicio cale de scriere fără ele. N-am creat un operator de test, fiindcă fără migrare n-aveam ce verifica.
- **Cardul din Acasă și foaia mementoului**: apar doar cu tabelele analizelor. Sunt verificate prin funcția pură (`calculeazaMemento`, cu data simulată) și prin testul cronului, nu vizual.
- **Butoanele din notificare pe un telefon real** (Android, push activ): handlerul din `push-handlers.js` e verificat doar ca sintaxă (`vm.createScript`) și prin testul formei payload-ului. Clicul real pe „Amână 3 zile” n-a putut fi încercat.
- **Avertizarea la tratament în browser**: demo-ul nu are recoltări de anul trecut, iar data culesului nu se poate salva fără migrare, deci estimarea lipsește și avertizarea nu apare. E verificată în teste (textul exact din mockup).
- **Ajustarea culesului după stadiu**: sărită, fiindcă nu există o regulă clară (§1, C).

## 6. Testul în browser (doar într-un demo nou)

Server: `next build` + `next start` (configurația `prod`). **Delogarea verificată întâi**: `/dashboard` → redirect la `/login`, fără sesiune. Demo nou: `/start` → „Continuă fără cont” → „Fructe de pădure”. **Tenant: `ec6111d0-3411-4013-99a2-05da1b23f176`** (`tenant_demo_e6415f20`, creat la 22.11.2026 14:48 UTC, 6 parcele). Seed-ul demo a mers fără tabelele noi (pasul analizelor a fost sărit, fără eroare). Telefon (375 × 812):

| Ce | Rezultat |
|---|---|
| `/a/<token>` fără cont (token valid ca formă, inexistent; token scurt; `<script>`) | 404, `noindex`, fără redirect la login, fără `Set-Cookie` |
| Actele fermei | „Atestat de producător · Suceava”, „Nr. … · seria SV · valabil până la 22.11.2027”, „Poza atestatului”, confirmarea cu textul cerut. În foaie: „Valabil până la”. |
| Widgetul beta | Punct de 28 px în colțul din dreapta sus (y = 4), `z-index` 60. Închis la încărcare, se deschide la atingere („Ești în beta / Scrie-mi pe WhatsApp”). |
| Tratamente → Analize | `Segments` „Aplicări / Analize”. Fără migrare: „Analizele vor merge după actualizarea bazei de date”. **Bug găsit și reparat** (`8bcccd2`): înainte apărea butonul „Analiză nouă”, iar „Salvează” arăta eroarea PostgREST în engleză. Acum butonul e ascuns, iar orice eroare „tabel lipsă” e în română. Reverificat după build. |
| „Analiză nouă” (înainte de reparație) | Pasul 1: doar parcelele de vânzare (fără „Grădina casei” și „Afine”, care sunt personale), bifare multiplă, „Toate parcelele de vânzare”, calendarul în pas. Pasul 2 ca în mockup. |
| Setări → Notificări | Secțiunea „Analiza la fructe”: comutatorul, zilele 21 / 14 / 7 / 3 / 1, „Zilnic din ziua culesului”, „Anul acesta nu fac analize”. Bifat „1” → în baza demo-ului: `tipuri = {analize: true, analize_zile: [21,14,7,3,1], analize_zilnic: true}`. |
| Fișa parcelei Maravilla | „Pune data culesului · Schimbă”. Foaia „Când începe culesul?” are anunțul „Se poate salva după actualizarea bazei de date”, iar butonul e dezactivat. Rândul analizei e ascuns fără migrare. |
| Tratamente → Aplicări | Jurnalul, pauza și filtrele, ca înainte. |

## 7. Verificările

| Comandă | Rezultat |
|---|---|
| `npm run lint` | trece (0 erori; 4 avertismente vechi, în `chat-post-handler.ts` și `LivratorLivrariClient.tsx`) |
| `npm run typecheck` | trece |
| `npm run check:kit` | trece: 259 de fișiere, fără abateri (folderele noi: `src/components/analize`, `src/lib/analize`, `src/app/a`) |
| `npm run test:critical:unit` | trece: 120 de fișiere, **992 de teste** |
| `npm run build` | trece (`/a/[token]` dinamic), refăcut după ultima reparație |

Testele noi:
- `src/lib/analize/__tests__/cules.test.ts`: cele 3 surse, 29 februarie, mai multe parcele.
- `src/lib/analize/__tests__/memento.test.ts`: 21 / 14 / 7 / 3, fereastra cardului, gruparea, zilnic, zilele din Setări, amânarea, oprirea la analiză, analiza veche care nu contează, „nu anul acesta”, comutatorul, liniștea 22–6, produsele de evitat, textele, butoanele (fără token, doar căi relative, cel mult două), avertizarea la tratament.
- `src/lib/analize/__tests__/raport.test.ts`: 404 pentru neconform / la laborator / inactiv, câmpurile interzise niciodată în raport, PDF sau afiș, opțiunile, textul scăpat, lista, laboratoarele, tratamentele din cele 30 de zile, exportul.
- `src/lib/acte/__tests__/atestat.test.ts`: textele „Atestat”.
- `src/app/api/cron/__tests__/notificari-zilnice.route.test.ts`: mementoul în cron (o singură trimitere, butoanele, ultima trimitere notată). Mock-ul a primit `maybeSingle` / `gte` / `lte` / `upsert`.

## 8. Commit-urile

| Commit | Ce |
|---|---|
| `ee0f0db` | A: „Atestat de producător”, „valabil până la”, confirmarea |
| `8bd010b` | A2: widgetul beta, punct mic sus |
| `5be5f0d` | Migrările (neaplicate) |
| `fccf567` | Logica (cules, memento, raport), stratul de date, rutele memento, pasul din cron, butoanele push, testele |
| `cd9d020` | Pagina publică `/a/[token]` și `/api/analize/[id]/raport` |
| `fb27e94` | Tab-ul „Analize”: lista, formularul, fișa, rezultatul, raportul |
| `4d98241` | Acasă (card, foaie, neconform), fișa parcelei |
| `5970fdf` | Setări → Notificări, avertizarea la tratament |
| `05a2108` | Rapoarte: „Analizele sezonului” |
| `f73508d` | Demo: analiza conformă și datele de cules |
| `600588f` | Culesul pe fișă și fără tabelele analizelor; `CLAUDE.md` |
| `2d54163` | Testele cronului |
| `8bcccd2` | Reparațiile din testul în demo |
| *(acest raport)* | `docs/redesign/raport-26-analize.md` |

`fccf567` a fost creat de o rulare întreruptă: obiectul commit-ului s-a scris, dar mutarea branch-ului nu. Am verificat că arborele lui e identic cu ce aveam în index, am scos fișierele de blocare rămase (`.git/HEAD.lock`, `.git/refs/heads/redesign/analize-26.lock`) și am mutat branch-ul cu `git update-ref` (cu verificarea valorii vechi).
