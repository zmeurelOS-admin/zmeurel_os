# Raport 25 — Deciziile după noaptea 24, viteză, desktop

Branch: `redesign/decizii-25`, pornit din `main` (`95b5f65`). Fără merge. Două migrări scrise, **neaplicate**. Din baza de date
am citit doar cu `select` (`pg_policies`, `pg_proc`, `information_schema`, numărători) și cu proba locală (doar citire).

## Rezumat pentru Andrei

1. **Curățarea demo-urilor n-a șters nimic pentru că ruta pica (500) în ambele moduri**: reverificarea citea o coloană care nu există (`shop_order_erp_links.id`). Reparat. Proba de azi: **113 demo-uri de șters, 0 semne de fermă reală**.
2. Regula nouă: o fermă cu semn de fermă reală **se sare și se raportează** (`sariteFermaReala` + Sentry), restul lotului se șterge. Testat.
3. **Banii și actele: le citește doar proprietarul** (migrare `20261122100000`). Operatorul cu „Scrie” pe Recoltări citește doar rândul automat „Manoperă cules”.
4. Comenzi și Livrări arată starea plății și pentru operator, printr-un RPC nou, restrâns (`comenzi_stare_plata`), nu prin tabelul `vanzari`.
5. **Material săditor: scrie doar proprietarul** (migrare `20261122101000`).
6. **Limita AI din „Din mesaj” funcționează**: se verifică cu sesiunea utilizatorului; dacă nu se poate verifica, cererea e refuzată (503). Testul `parse-order` reparat și pus în `test:critical:unit`.
7. **Operatorul vede doar modulele lui** în bara de jos și în bara laterală (+ „Mai mult”); fără „+” unde are doar „Citește”.
8. **Viteza:** nicio pagină măsurată nu trece de 15 cereri (3–10), deci n-am schimbat nimic. **Desktopul:** două reparații (widgetul beta acoperea bara laterală; Acasă ieșea din pagină la 1024 px) și un mesaj greșit în Echipa.
9. **Ordinea migrărilor:** întâi merge, apoi `20261122100000` (codul nou tolerează lipsa RPC-ului); `20261122101000` oricând.
10. Toate verificările trec (§10). Demo de test: `6454f8dc-…`, operatorul de test dezactivat.

## 1. De ce n-a rulat curățarea demo-urilor

**Cauza reală nu era niciuna din cele două bănuite.** Reverificarea (`reverifica` → `citesteStareaFermei`) cerea
`shop_order_erp_links.id`, o coloană care nu există. PostgREST răspundea cu eroare, ruta pica cu **500 în ambele moduri**
(și în `proba`, și în `sterge`), deci în noaptea 21→22.11 nu s-a ajuns nici la numărare, nici la ștergere. Reparat în
`26bdd7c` (coloana corectă; clientul fals din test refuză acum coloanele care nu există în tipuri, ca să nu se repete).

**Proba locală de azi** (`scripts/demo-cleanup-proba.ts`, doar citire: `select`, `listUsers`, `getUserById`; ruta de cron
n-a fost apelată), 22.11.2026, 09:52 UTC:

| | |
|---|---:|
| Ferme în total | 169 |
| De șters (demo mai vechi de 24 h) | **113** |
| Reverificate (primul lot de 50, apoi toate cu `--tot`) | 50 / 113 |
| Dispărute între timp | 0 |
| Protejate | 10 (`prea_noua`: sub 24 h) |
| Cel mai vechi demo | 20.03.2026 |
| Cel mai nou dintre cele de șters | 21.11.2026 08:38 UTC |
| **Candidați cu semn de fermă reală** | **0** |

Niciun semn de fermă reală, deci nici semne false de reparat (operator ascuns dezactivat, redenumire etc.).

**Regula nouă** (`26bdd7c`): în `sterge`, o fermă cu semn de fermă reală se sare (nu se atinge nimic din ea), apare în
răspuns la `sariteFermaReala` și în Sentry; restul lotului se șterge. În `proba`, aceleași ferme apar la `semneFermaReala`.
Teste: `src/app/api/cron/__tests__/demo-tenant-cleanup.route.test.ts` (lot cu un candidat suspect → ceilalți se șterg,
suspectul rămâne în `sariteFermaReala`; și cazurile cu mai mulți suspecți).

**Ce rămâne de făcut de tine:** `DEMO_CLEANUP_MODE` e o variabilă din Vercel (n-am atins-o). După merge, prima rulare în
`proba` trebuie să întoarcă `ok: true` cu ~113 ferme (în jurnale: `[demo-tenant-cleanup] proba`); apoi treci pe `sterge`.
Cu 50 pe rulare, coada se golește în 3 nopți.

Rularea probei: `JITI_ALIAS='{"@":"<calea repo-ului>/src"}' node --env-file=.env.local node_modules/jiti/lib/jiti-cli.mjs scripts/demo-cleanup-proba.ts [--tot]`
(jiti nu citește aliasul `@/` din tsconfig; comanda din antetul scriptului e acum corectă, `635963a`).

## 2. Banii și actele: le citește doar proprietarul

**Ce citea un operator din cele patru tabele** (căutat în cod: Comenzi, Livrări, Recoltări, Acasă, notificări, Rapoarte,
Clienți; și în `pg_proc` funcțiile care le citesc):

| Unde | Ce citește | Ce am făcut |
|---|---|---|
| Comenzi, Livrări | starea plății comenzii livrate, din `vanzari` prin `comenzi.linked_vanzare_id` (`select` cu `vanzare:vanzari!…`) | RPC nou `comenzi_stare_plata` (SECURITY DEFINER): doar `status_plata`, `data_incasare`, `cantitate_kg`, `pret_lei_kg`, `suma_incasata_partial_lei`, doar pentru comenzile cerute din ferma apelantului, doar cu drept pe Comenzi sau Livrări. Codul îl cheamă **doar** când legătura vine goală (operator după migrare); proprietarul nu face nicio cerere în plus. Fără migrare (`PGRST202`) comenzile rămân cum au venit. |
| Recoltări → manopera automată | caută, actualizează sau șterge rândul `[AUTO_MANOPERA]` din `cheltuieli_diverse` (UPDATE/DELETE cu filtru cer și citire) | Politica de citire îi lasă operatorului cu „Scrie” pe Recoltări **doar** acel rând (aceleași condiții ca politicile de scriere din `20261122091000`). |
| Acasă | — | operatorul nu ajunge acolo (proxy-ul îl trimite la primul modul permis), deci nu vede bani. |
| Notificări (bani de încasat) | `vanzari`, prin cron cu service role, trimise doar proprietarului | neschimbat |
| Rapoarte | — | nu e modul de operator |
| Clienți (fișa clientului) | toate vânzările, pentru cifrele clientului | după migrare, operatorul cu Clienți vede cifrele doar din comenzi (fără vânzări). Nu se strică nimic; e consecința deciziei. |
| `livreaza_si_copiaza_comanda`, `set_comanda_delivered`, `mark_comanda_incasata`, `adauga_plata_vanzare`, cronurile | SECURITY DEFINER / service role | neschimbat |

Vederile `vanzari_extended` și `vanzari_butasi_extended` sunt `security_invoker`, deci urmează politicile noi.
Migrarea `20261122091000` (scrierile după drepturi, din raportul 24) **e deja aplicată** în producție (văzut în `pg_policies`).

**Test în browser:** n-am putut verifica „0 rânduri” pentru operator: migrarea nu e aplicată (regula). Verificările de după
aplicare sunt la finalul fișierului. Testat unitar: `src/lib/comenzi/__tests__/stare-plata.test.ts` (proprietar: nicio
cerere; operator: completare doar pentru comenzile cu vânzare legată; fără migrare / eroare: comenzile rămân; loturi de 500).

## 3. Material săditor: scrie doar proprietarul

Tabelele modulului sunt doar `vanzari_butasi` și `vanzari_butasi_items` (verificat în `pg_class` și în
`src/lib/supabase/queries/vanzari-butasi.ts`). Migrarea `20261122101000` face INSERT / UPDATE / DELETE doar pentru
proprietar; citirea, triggerele, cronul de mementouri (service role) și curățarea rămân. Modulul nu e refăcut.

## 4. Limita AI la „Din mesaj”

- **Înainte:** doar `parse-order` chema `check_and_log_ai_usage`, cu clientul service role. Funcția cere
  `auth.uid() = p_user_id`; cu service role `auth.uid()` e `null` → `UNAUTHORIZED` → ruta „lasă să treacă”. Celelalte
  `paste-to-*` aveau doar limita din memorie (nu funcționează pe Vercel).
- **Acum** (`5f5c02d`): limita stă în fabrica comună (`src/lib/ai/paste-to-x-handler-factory.ts`, `checkPersistentAiLimit`),
  pentru toate rutele: `parse-order` (feature `parse_order`), `paste-to-cheltuieli`, `paste-to-investitii`,
  `paste-to-recoltari` (`paste_to_<modul>`). Se cheamă cu **sesiunea utilizatorului** (`createClient()`), după validarea
  mesajului (un mesaj gol nu consumă) și chiar înainte de model.
  - peste limită → `429 RATE_LIMITED` cu `Retry-After`;
  - eroare, răspuns fără `allowed` sau cererea aruncă → **refuz**: `503 AI_LIMIT_UNAVAILABLE`, „Nu am putut verifica limita
    de folosire a AI. Încearcă din nou peste puțin.”
- Funcția **nu** s-a deschis pentru `anon` (are `EXECUTE` doar `authenticated`, verificat). Fără migrare.
- **Limitele:** cele din funcție, neschimbate (20 cereri / 10 min pe utilizator, 100 / oră pe fermă). Limitele din `CLAUDE.md`
  (20 / 60 pe zi) sunt ale chatului AI și n-au fost atinse; am adăugat în `CLAUDE.md` un rând despre limita „Din mesaj”.
- **Testul `parse-order`** pica pe `main` (11 cazuri): modelul de test nu avea `pret_per_kg` (schema e strictă → 502), iar
  cheile și limitele din memorie se schimbaseră. Reparat și pus în `test:critical:unit` (19 cazuri, între ele: sesiunea
  utilizatorului, nu service role; peste limită → 429; trei feluri de „nu se poate verifica” → 503; mesajul gol nu consumă).
  Am pus și `paste-to-recoltari` în lista testelor critice (trecea, dar nu rula).
- **Notă (neschimbat):** `check_and_log_ai_usage` nu verifică `p_tenant_id`; un cont logat ar putea, chemând funcția direct,
  să umple limita de 100 / oră a altei ferme. Reparația ar fi `p_tenant_id = current_tenant_id()` în funcție; n-am făcut-o
  (o nepotrivire între `current_tenant_id()` și ferma din rută ar bloca „Din mesaj”).

## 5. Operatorul vede doar modulele lui

`9bcd446`, regula în `src/lib/farm-members/nav.ts`:

- **Bara de jos:** operatorul vede modulele cu „Citește” / „Scrie”, cel mult 4, în ordinea Livrări, Recoltări, Comenzi,
  Parcele, Lucrări, Tratamente, Clienți, Culegători, Produse, plus „Mai mult”. Restul rămân pe „Mai mult” (care filtra deja).
- **Bara laterală (desktop):** doar legăturile modulelor lui; fără „Dashboard” și „Setări” (rute blocate pentru operator),
  cu „Mai mult” în subsol. Tratamentele apar pentru operatorul care le are (proprietarul nu avea Tratamente în bara laterală
  nici înainte; n-am schimbat asta).
- **Butonul „+”:** ascuns când operatorul are doar „Citește” pe modulul curent (regula e în `UnifiedMobileFab`, deci
  acoperă și paginile care înregistrează acțiunea oricum).
- **Proprietarul:** aceleași bare ca azi (test).
- **Test unitar:** `src/components/app/__tests__/BottomTabBar.operator.test.tsx` (operator doar cu Recoltări → Recoltări +
  Mai mult; operator cu 5 module → 4 + Mai mult; „+” pe Citește / Scrie; proprietarul neschimbat).
- **Test în browser** (demo nou, operator din link „Test Recoltari”, doar Recoltări pe „Scrie”): bara de jos are
  **Recoltări + Mai mult**; bara laterală la 1280 px are doar Recoltări și Mai mult (plus sigla).
  Capturi: `screenshots/25/operator-doar-recoltari-bara-jos.jpg`, `operator-doar-recoltari-bara-laterala-1280.jpg`.

## 6. Viteza paginilor

Build de producție local (`next start`), demo nou, 375 × 812, încărcare completă a fiecărei pagini. Număr: cererile din
browser spre `*.supabase.co` (`performance.getEntriesByType('resource')`). Timp: de la navigare până la ultimul răspuns
Supabase. Panoul de browser era în fundal (cadrele se forțează cu capturi), deci timpii sunt orientativi; numărul e exact.

| Pagina | Cereri | Din care | Pagina HTML | Ultimul răspuns de date |
|---|---:|---|---:|---:|
| Comenzi | 7 | comenzi, clienti, stoc (RPC), shop_orders, tenant_settings, 2 × analytics | 1,72 s | 3,26 s |
| Livrări | 5 | comenzi, clienti, shop_orders, 2 × analytics | 1,19 s | 1,81 s |
| Recoltări | 6 | recoltari, parcele, culegatori, shop_orders, 2 × analytics | 0,65 s | 1,16 s |
| Stocuri | 7 | recoltari, parcele, ajustari_stoc, stoc (RPC), shop_orders, 2 × analytics | 0,80 s | 1,30 s |
| Tratamente | 9 | aplicari_tratament, parcele ×2, produse_fitosanitare, activitati_agricole, meteo, shop_orders, 2 × analytics | 0,80 s | 2,09 s |
| Parcele | 10 | parcele, recoltari, activitati_agricole ×2, aplicari_tratament, stadii, configurări sezon, shop_orders, 2 × analytics | 0,71 s | 1,43 s |
| Lucrări | 5 | activitati_agricole, parcele, shop_orders, 2 × analytics | 0,89 s | 1,53 s |
| Rapoarte | 3 | shop_orders, 2 × analytics (datele vin din server) | 0,61 s | 1,12 s |
| Clienți | 7 | comenzi, vanzari, tenant_settings ×2, shop_orders, 2 × analytics | 0,74 s | 1,44 s |

**Nicio pagină nu trece de 15 cereri**, deci n-am schimbat nimic (înainte = după). Prima pagină (Comenzi) a fost și prima
deschisă după crearea demo-ului (cache rece), de aici cele 3,26 s. Nu se văd cererile de rezolvare a tenantului
(`farm_members`, `tenants`): tenantul vine deja din layout (raportul 22). **Nemăsurat:** cererile făcute pe server
(Rapoarte și Clienți citesc o parte din date în `page.tsx`), telefonul real, Vercel.

## 7. Desktopul

Trecut prin Acasă, Recoltări, Comenzi, Livrări, Clienți, Culegători, Cheltuieli, Investiții, Vânzări, Mai mult,
Notificări, Setări, Stocuri (la 1280 px) și Tratamente, Produse, Rapoarte, Parcele, Lucrări, Echipa, Actele fermei, Acasă,
Comenzi (la 1024 px). Pentru fiecare: captură + verificare automată a elementelor care ies din pagină în dreapta.
Foile: „Ajustează stocul” (BottomSheet, 1280) și „Comandă nouă” (StepForm, 1024) se deschid centrat, **peste** bara
laterală (fundalul o acoperă), și se închid cu Esc, respectiv cu X.

| Problemă | Unde | Reparat |
|---|---|---|
| Widgetul „Ești în beta” stătea peste josul barei laterale: acoperea Finanțe, Administrare, Setări (nu se puteau apăsa până la închiderea widgetului) | toate paginile, 1024 și 1280 | da (`ca99faf`): pe desktop stă lângă bara laterală (`left: calc(var(--sidebar-width) + 1.5rem)`) |
| Acasă: în „Venituri și sezon”, plăcile aveau 72 px, iar suma („−2.259 RON”) ieșea cu 19 px din pagină → derulare orizontală | Acasă, 1024 px | da (`ca99faf`): placa se poate strânge, suma trece sub etichetă |
| Mesajul „<nume> a fost dezactivat” apărea ca „Recoltare salvată” (normalizatorul de mesaje rescria orice text cu „recolt”, „comand”, „parcel”…, inclusiv numele membrului) | Echipa (și orice ecran) | da (`5402ca7`), cu test |

Restul modulelor: nimic tăiat, suprapus sau neapăsabil. Tabelele largi nu există în modulele refăcute (liste pe o coloană).

**Rămase, nereparate:**
- Widgetul beta deschis acoperă în continuare o bucată din conținut (pe desktop în colțul din stânga-jos al paginii, pe
  telefon peste butonul principal, de ex. „Invită pe cineva” din Echipa, unde clicul a nimerit WhatsApp-ul). Se închide cu X
  și rămâne un buton rotund de 40 px. Mutarea lui e o decizie de aspect (raportul 24 îl avea deja pe listă).
- Captura „după” la 1280 px a ieșit decupată (panoul de browser și-a schimbat mărimea); poziția am verificat-o din cod:
  widgetul la 264 px, bara laterală până la 240 px. Capturile „după” la 1024 px sunt întregi.

Capturi în `docs/redesign/screenshots/25/`: `inainte-1280-comenzi-widget-beta-peste-bara.jpg`,
`inainte-1024-rapoarte-widget-beta.jpg`, `inainte-1024-acasa-iese-din-pagina.jpg`, `dupa-1024-rapoarte-widget-langa-bara.jpg`,
`dupa-1024-acasa-suma-in-placa.jpg`, `dupa-1280-comenzi-bara-libera-decupata.jpg`, `ok-1280-stocuri-foaie-peste-bara.jpg`,
`ok-1024-comenzi-formular.jpg`.

## 8. Migrările (neaplicate)

**Ordinea:** întâi **merge**, apoi `20261122100000_citire_bani_acte_doar_proprietar.sql`; `20261122101000_material_saditor_scrie_proprietarul.sql`
oricând (independentă). Amândouă se pot rula de mai multe ori.

| Migrarea | Aplicația fără ea | Cu ea, pe codul de azi din `main` | Cu ea, pe acest branch |
|---|---|---|---|
| `20261122100000` | merge ca azi (operatorul vede banii) | merge; proprietarul nu vede nicio diferență; **operatorul vede comenzile livrate fără „Încasat” / „De încasat”** și fișa clientului fără vânzări | merge; operatorul vede starea plății prin RPC |
| `20261122101000` | merge ca azi | merge; doar scrierile prin API ale unui operator primesc `42501` | la fel |

De aceea `20261122100000` vine **după** merge. Tipurile din `src/types/supabase.ts` nu trebuie regenerate (codul cheamă RPC-ul
prin tip propriu).

### `supabase/migrations/20261122100000_citire_bani_acte_doar_proprietar.sql`

```sql
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
```

### `supabase/migrations/20261122101000_material_saditor_scrie_proprietarul.sql`

```sql
-- Material săditor: scrie doar proprietarul (promptul 25, partea 3; decizia lui Andrei).
--
-- NEAPLICATĂ: o rulează Andrei. Independentă de 20261122100000; ordinea doar urmează promptul.
--
-- Azi, pe `vanzari_butasi` și `vanzari_butasi_items`, INSERT / UPDATE / DELETE cereau doar
-- `tenant_id = current_tenant_id()`: orice operator (și unul doar-citire, și unul fără niciun drept) putea crea,
-- schimba sau șterge comenzi de material săditor prin API. Modulul nu e al operatorului (nu are drept pe el în
-- Echipa, ruta `/vanzari-butasi` nu e pe lista lui), deci interfața oricum nu-l lasă.
--
-- Ce se schimbă: scrierile devin `tenant_id = current_tenant_id() and is_tenant_owner(tenant_id)`.
-- Ce NU se schimbă: citirea (`vanzari_butasi_select`, `vanzari_butasi_items_select`), triggerele
-- (`set_vanzari_butasi_tenant_and_public_id`, `enforce_vanzari_butasi_items_tenant`, SECURITY DEFINER),
-- cronul de mementouri (service role), curățarea demo-urilor și resetul fermei (service role / definer).
-- Tabelele modulului: doar acestea două (verificat în `pg_class` și în `src/lib/supabase/queries/vanzari-butasi.ts`).
-- `merge_clienti_duplicates` (invoker) schimbă și `vanzari_butasi.client_id`, dar aplicația nu o cheamă.
--
-- Aplicația merge fără migrare (ca azi) și cu ea, pe codul de azi din `main`: proprietarul nu vede nicio
-- diferență; doar scrierile prin API ale unui operator primesc `42501` (sau 0 rânduri la update/delete).
-- Ordinea față de merge nu contează.
--
-- Aditivă pentru date: doar politici. Se poate rula de mai multe ori (drop if exists + create).

do $$
declare
  t text;
begin
  foreach t in array array['vanzari_butasi', 'vanzari_butasi_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_delete', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verificarea de după aplicare:
--   select tablename, policyname, cmd, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename in ('vanzari_butasi', 'vanzari_butasi_items') order by 1, 3;
--   Așteptat: insert / update / delete cu `is_tenant_owner(tenant_id)`; select neschimbat.
--   În demo: proprietarul adaugă, editează, livrează și șterge o comandă de material săditor (merge);
--   operatorul din link, prin API: `insert` în `vanzari_butasi` → 42501.
```


## 9. Ce n-am putut testa

- **RLS-ul nou (părțile 2 și 3):** migrările nu sunt aplicate, deci n-am putut arăta în browser că `select` pe `vanzari` /
  `investitii` / `farmer_legal_docs` întoarce 0 rânduri pentru operator. Verificările sunt la finalul fiecărui fișier.
  Recomand aplicarea întâi pe un branch Supabase.
- **Operatorul cu Comenzi + Recoltări (livrare, recoltare cu manoperă automată):** n-am făcut fluxul în browser; fără
  migrare ar fi trecut oricum (scrierile sunt deja legate de drepturi). Am testat doar operatorul cu Recoltări (navigarea).
- **Limita AI cap-coadă:** doar prin teste unitare (n-am trimis mesaje la model).
- **Viteza pe telefon real / pe Vercel** și cererile făcute pe server.
- **Desktop:** captura „după” la 1280 px e decupată (vezi §7).
- **Demo-ul de test:** tenant `6454f8dc-57fe-4b8a-b088-d1d6f67a821c` (creat 22.11.2026 10:14 UTC, „Fructe de pădure”).
  Operatorul ascuns „Test Recoltari” (`@operator.zmeurel.local`) e legat doar de acest demo și e **dezactivat** (verificat:
  `is_active = false`, o singură apartenență). Am ieșit din sesiunea veche de operator din browserul Playwright. În demo
  n-am salvat nimic în afară de invitație și dezactivare.

## 10. Verificările

Rulate pe codul final:

| Comanda | Rezultat |
|---|---|
| `npm run lint` | 0 erori, 4 avertismente (aceleași ca în raportul 24) |
| `npm run typecheck` | trece |
| `npm run check:kit` | OK, 238 de fișiere |
| `npm run test:critical:unit` | 116 fișiere, 942 de teste, toate trec (raportul 24: 111 / 901) |
| `npm run build` | trece |

`public/sw.js` nu e comis (îl rescrie build-ul). N-am apelat niciun cron. N-am aplicat nicio migrare. Din baza de date doar
`select`; nicio scriere directă (singurele scrieri sunt cele din interfața demo-ului nou: invitația și dezactivarea).

## 11. Commit-uri

| Hash | Ce |
|---|---|
| `26bdd7c` | fix(demo-cleanup): coloana inexistentă din reverificare; ferma suspectă se sare, nu oprește lotul |
| `635963a` | chore(demo-cleanup): comanda de rulare a probei locale cu aliasul `@/` |
| `c0e39f0` | feat(db): vânzările, cheltuielile, investițiile și actele le citește doar proprietarul (migrare + RPC + completarea din cod) |
| `d771fa3` | feat(db): Material săditor — scrie doar proprietarul (migrare) |
| `5f5c02d` | fix(ai): limita din „Din mesaj” se aplică; testul `parse-order` reparat |
| `9bcd446` | feat(operator): barele arată doar modulele operatorului; fără „+” pe doar-citire |
| `ca99faf` | fix(desktop): widgetul beta lângă bara laterală; Acasă nu mai iese din pagină la 1024 px |
| `5402ca7` | fix(toast): „<nume> a fost dezactivat” nu mai devine „Recoltare salvată” |
| *(acest commit)* | docs: raportul 25 și capturile |
