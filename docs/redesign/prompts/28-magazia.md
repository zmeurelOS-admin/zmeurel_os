# Prompt 28 — Tratamente, partea a doua (1/3): Magazia

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport.

**Branch:** `redesign/magazia-28`, din `main` (`9609582`). Commit-uri mici, push după fiecare bucată. Fără merge.

**Mockup aprobat** (toate recomandările acceptate de Andrei): `docs/redesign/mockups/tratamente-2.html` pe branch-ul `redesign/prompturi-11-12`. Citește-l cu `git show origin/redesign/prompturi-11-12:docs/redesign/mockups/tratamente-2.html`. Prompt-ul acesta face doar **capitolul „Unde stau” (partea cu Magazia) și capitolul 1, „Magazia”**. Capcanele și Planul vin în prompturile 29 și 30: nu adăuga acum taburile „Plan” și „Capcane”.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, modulul Tratamente (`src/app/(dashboard)/tratamente`, promptul 18), Cheltuieli (promptul 08, „+ Poză bon” din 12), Rapoarte (promptul 19), rapoartele 24–27. Formularele urmează modelul din Recoltări.

---

## 1. Datele (migrare aditivă, NEAPLICATĂ)

Citește întâi schema din producție (doar select): `produse_fitosanitare`, `aplicari_tratament`, `aplicari_tratament_produse` (`cantitate_totala`, `unitate_cantitate`, `produs_id`), cum se marchează un tratament făcut sau planificat, `cheltuieli_diverse` și categoriile ei.

**Nu folosi coloanele vechi `stoc_mutatie_id`.** Ele duc la `miscari_stoc`, adică la stocul de fructe. Nu le atingi și nu scrii nimic în `miscari_stoc`.

### Coloane noi pe `produse_fitosanitare`

- `unitate_stoc text` (check `kg` / `l` / `buc`, null până la prima intrare);
- `prag_pe_terminate numeric null`.

### Tabel nou `magazie_miscari`

| Coloană | Ce ține |
|---|---|
| `id`, `tenant_id`, `produs_id` | → `produse_fitosanitare`, `on delete cascade` |
| `tip` | check `intrare` / `iesire_tratament` / `corectie` |
| `cantitate numeric` | cu semn, în `unitate_stoc`: + la intrare, − la ieșire, ± la corecție |
| `data date` | data mișcării |
| `pret_total_lei numeric null` | doar la intrare |
| `furnizor text null` | doar la intrare |
| `bon_path text null` | bucket-ul privat existent `bonuri` |
| `cheltuiala_id uuid null` | → `cheltuieli_diverse`, `on delete set null` |
| `aplicare_produs_id uuid null unique` | → `aplicari_tratament_produse`, `on delete cascade`; doar la ieșiri |
| `nota`, `client_sync_id` | `client_sync_id` cu index unic parțial pe tenant |
| `created_by`, `created_at` | — |

### Ieșirile automate (trigger `SECURITY DEFINER`)

- Pe `aplicari_tratament_produse` și pe schimbarea stării sau datei din `aplicari_tratament`, ține sincronizat un singur rând `iesire_tratament` pe `aplicare_produs_id`:
  - tratament **făcut**, cu `produs_id` și `cantitate_totala` → ieșire = −cantitatea, convertită în `unitate_stoc`;
  - tratament planificat sau șters, produs fără cantitate, ori produs schimbat → rândul vechi se șterge sau se refolosește.
- **Conversii:** ml → l (/1000) și g → kg (/1000). Unitățile incompatibile (de ex. `buc` față de `l`) nu scad nimic; aplicarea apare marcată „nu s-a putut scădea” în fișă.
- **Tratamentele vechi nu scad.** Se scade doar pentru aplicările cu data ≥ data primei intrări sau corecții a produsului. La prima intrare a unui produs nu se recalculează retroactiv.
- Triggerul nu atinge alte tabele în afară de `magazie_miscari`.

### Stocul și prețul (RPC `magazie_stoc()`, `SECURITY DEFINER`)

- Întoarce pe produs, pentru tenantul curent:
  - stocul (suma cantităților);
  - unitatea;
  - pragul;
  - „ajunge pentru ~N aplicări” (stoc / cantitatea ultimei aplicări făcute);
  - starea „pe terminate”: sub prag, iar fără prag, sub cantitatea ultimei aplicări.
- **Prețul mediu ponderat** (Σ preț / Σ cantitate de la intrările cu preț) și valoarea în magazie le întoarce **doar proprietarului**; pentru operator sunt `null`.
- Verifică `auth.uid()` și `current_tenant_id()`; dă `revoke ... from public, anon` și `grant` către `authenticated`.

### RLS pe `magazie_miscari`

- **Citire:** proprietarul.
  - Operatorul citește stocul doar prin RPC.
  - Pentru mișcările din fișa produsului, fă un al doilea RPC, `magazie_miscari_produs(p_produs_id)`, cu prețurile `null` pentru operator.
- **Inserare:**
  - proprietarul;
  - operatorul cu `operator_can_write('tratamente')`, doar pentru `intrare` / `corectie` și doar fără `pret_total_lei` și fără `cheltuiala_id` (check în politică).
- **Modificare și ștergere:** proprietarul. Rândurile `iesire_tratament` le scrie doar triggerul.

## 2. Ecranele (kit, `check:kit`)

- **În Tratamente → Aplicări,** sus, rândul „Magazia: N produse · M pe terminate” (`/tratamente/magazie`). Intrare și în **Mai mult**.
- **Magazia** (`/tratamente/magazie`):
  - pentru proprietar: plăcile „Produse” și „Valoare în magazie”;
  - filtre: Toate / Pe terminate / Fertilizanți / Protecție (după `tip`-ul produsului);
  - rândurile, cu bara de nivel, cantitatea, „ajunge pentru ~N aplicări” și eticheta „pe terminate”;
  - butoanele „+ Am cumpărat” și „Am numărat”.
- **„+ Am cumpărat”** (`StepForm` sau foaie, cum se potrivește kitului): produsul (cu „+ Produs nou”, unde pui și pauza PHI), cantitatea, unitatea, prețul total, data, furnizorul, poza bonului și comutatorul „Trece și la cheltuieli” (pornit).
  - La salvare cu comutatorul pornit, se creează și cheltuiala: categoria „Tratamente” (sau cea existentă care se potrivește), suma = prețul total, același bon, legată prin `cheltuiala_id`.
  - Se trimite `client_sync_id` pentru ambele.
  - Butonul arată prețul pe unitate („Salvează · 16,48 lei/kg”).
  - Operatorul nu vede prețul și nici comutatorul.
- **„Am numărat”:** produsul și cantitatea reală → se salvează o corecție egală cu diferența.
- **Fișa produsului** (`/tratamente/magazie/[produsId]`):
  - cantitatea mare;
  - pragul „pe terminate”, cu „Schimbă”;
  - mișcările (+ cumpărat, − tratament cu legătură la aplicare, = corecție);
  - prețurile doar pentru proprietar.
- **Formularul de tratament** (promptul 18), la ultimul pas, pentru fiecare produs:
  - „în magazie X · rămân Y” sau „lipsesc Z”, cu avertizarea „Nu ajunge … Poți salva”;
  - butoanele „Salvează · făcut” și „Salvează ca planificat (nu scade)”, dacă formularul nu are deja alegerea asta;
  - costul estimat, doar pentru proprietar.
  
  Pe lista de aplicări, fiecare aplicare făcută arată „−1,2 kg din magazie”.
- **Rapoarte** (proprietar):
  - linia „Tratamente: X lei în sezon”, din prețul mediu × cantitățile scăzute;
  - **nu se scade a doua oară din profit**: cumpărăturile trecute la cheltuieli sunt deja acolo. Linia e informativă și o spui în text („inclus în cheltuieli”).
  - în Exportă, „Magazia” (Excel: stocul + mișcările sezonului).

## 3. Notificarea „pe terminate”

- O dată pe săptămână, **luni**, în verificarea de dimineață existentă (fără cron nou): „N produse pe terminate”.
- Doar proprietarului; push + în aplicație; respectă liniștea 22–6 și preferințele.
- Comutator în Setări → Notificări: „Produse pe terminate”, pornit.

## 4. Demo

Seed-ul pentru demo-urile **noi**:
- intrări cu preț pe 4–5 produse;
- o corecție;
- ieșiri rezultate din tratamentele demo făcute după prima intrare;
- unul sau două produse pe terminate.

Reîncărcarea demo-ului curăță mișcările demo. Datele existente nu se ating.

## 5. Verificări și raport

- **Kitul:** folderele noi intră în `KIT_RULE_DIRS`.
- **Teste unitare:**
  - conversiile de unități;
  - regula „tratamentele vechi nu scad”;
  - sincronizarea ieșirii la făcut / planificat / șters / editat (logica pură, plus SQL-ul descris în raport);
  - „ajunge pentru N” și „pe terminate”;
  - prețul mediu;
  - prețurile ascunse operatorului;
  - linia din Rapoarte care nu dublează cheltuiala.
- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`, `npm run test:e2e:smoke`: toate trec. Adaugă la smoke un pas: „+ Am cumpărat” → un tratament făcut cu acel produs → stocul scade.
- **Test în browser doar într-un demo nou** (verifici întâi delogarea). Fără migrare, aplicația trebuie să meargă ca azi: Magazia arată „după actualizarea bazei de date”, iar formularul de tratament nu se strică. Notezi tenantul.
- **Migrările:** scrise, aditive, NEAPLICATE. Spui ordinea, dacă aplicația merge fără ele și dacă se aplică înainte sau după merge. Din baza de date doar citești (select).
- **Raport** în `docs/redesign/raport-28-magazia.md`: 10 rânduri pentru Andrei, apoi ce ai schimbat, migrările cu SQL complet, cum lucrează triggerul, ce n-ai putut testa, verificările, hash-urile commit-urilor. Actualizezi `CLAUDE.md`.

## Ce NU atingi

- stocul de fructe (`miscari_stoc`, `ajustari_stoc`, Stocuri);
- taburile Plan și Capcane;
- Asociația, magazinul, chatul AI, `/start`, Login, Admin;
- logica de profit, în afară de linia informativă;
- variabilele din Vercel, `public/sw.js`, cronurile (nu le apelezi).

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
