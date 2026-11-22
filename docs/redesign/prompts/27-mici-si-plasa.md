# Prompt 27 — Reparații mici după 26, igiena bazei, plasă de teste e2e

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport.

**Branch:** `redesign/mici-27`, din `main` (`e85656a`). Commit-uri mici, push după fiecare bucată. Fără merge.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, rapoartele 24–26.

**Ordinea:** A, B, C, D.

---

## A. Raportul public și demo-ul (văzute în producție)

1. **Soiurile dublate.** Pe `/a/[token]`, rândul soiurilor arată „Zmeure Delniwa, Zmeure Maravilla Zmeure Delniwa, Zmeure Maravilla · parcelele Delniwa Nord și Maravilla”: lista e repetată și lipsește separatorul. Fiecare soi apare o singură dată, deduplicat, cu virgulă între ele. Același lucru în PDF și în afiș. Test unitar.
2. **Numele fermei.** În demo apare „tenant_demo_4723a180”. Raportul (pagina, PDF-ul, afișul) folosește numele afișat al fermei (`nume_ferma`). Dacă lipsește sau arată ca un nume intern (`tenant_demo_…`, `tenant_…`), scrie „Ferma demo” pentru demo, altfel „Ferma”. Caută și alte locuri vizibile unde poate apărea un nume intern (Acasă, Mai mult, Setări, notificări) și aplică aceeași regulă.
3. **Analiza orfană la reîncărcarea demo-ului** (raportul 26): reîncărcarea (`seed_demo_for_tenant` / `delete_demo_for_tenant` sau ruta de reload) șterge întâi analizele demo-ului, cu tot cu parcele și substanțe, apoi pune una nouă. Dacă trebuie atinsă o funcție SQL: migrare aditivă (`create or replace` pornind de la `pg_get_functiondef` din producție), cu aceleași verificări de acces. Atinge doar rândurile marcate ca demo, nimic altceva.
4. **`get_public_farmer_card`** întoarce eticheta „Certificat producător”. Devine „Atestat de producător”, în aceeași migrare.
   - Verifică faptul că funcția nu întoarce numărul atestatului și nici poza.
   - Câmpurile publice permise: numele fermei, localitatea, seria, valabilitatea, telefonul.
   - Dacă întoarce altceva, îl scoți și verifici că nimic din magazin nu se strică.

## B. Data culesului, la vedere

- Pe lista de parcele, parcelele de vânzare fără dată de cules (nici pusă de mână, nici din anul trecut) au o etichetă mică „fără dată de cules”. Atinsă, deschide foaia „Schimbă” de pe fișă.
- În foaia „Analiza dinainte de cules” și pe fișa parcelei: dacă nicio parcelă nu are dată, mesajul „Pune data culesului pe parcele ca să primești mementoul.”
- Fără card nou în Acasă.

## C. Igiena bazei de date (migrare aditivă, NEAPLICATĂ)

Pornești din producție, doar cu citire (`pg_catalog`, `pg_policies`, `pg_proc`).

1. **Indexuri pe cheile străine folosite în filtre și RLS.** Adaugi index pe fiecare `tenant_id` și pe fiecare cheie străină după care se face join des (`parcela_id`, `comanda_id`, `client_id`, `analiza_id` etc.) care n-are deja un index ce o acoperă. Folosești `create index if not exists`, fără `concurrently` (migrarea rulează într-o tranzacție). Nu adaugi indexuri pe `created_by` / `updated_by`. Listezi în raport ce ai adăugat și de ce.
2. **`is_legal_docs_complete(p_tenant_id)`** poate fi chemată de orice cont logat pentru orice fermă. Restrângi accesul: proprietarul fermei, membrii activi ai fermei, superadminul și rolurile de asociație care au nevoie de ea (vezi `list_association_farmer_legal_status` și cine o cheamă în `src`). Altfel întoarce `false`. Verifică cine o cheamă, ca să nu strici asociația.
3. **`clienti_merge_audit`** are RLS fără nicio politică. Verifică cine scrie în tabel. Dacă îl scrie doar serverul sau o funcție `SECURITY DEFINER`, lasă-l așa și notează. Dacă îl citește aplicația cu sesiunea utilizatorului, adaugă o politică de citire pentru proprietar.
4. **Nu schimbi altceva.**
   - Nu modifici funcțiile `SECURITY DEFINER` chemate de aplicație: sunt intenționat accesibile utilizatorilor logați și au verificările lor.
   - Nu rescrii politicile pentru performanță (`(select auth.uid())`); doar listezi în raport câte ar beneficia.

## D. Plasă de teste e2e (Playwright), pe demo

- Un set „smoke” nou: `e2e/smoke/*.spec.ts` și scriptul `npm run test:e2e:smoke`. Rulează pe serverul local (build de producție) și creează singur un demo nou, prin `/start` → „Continuă fără cont” → „Fructe de pădure”.
- **Pașii testați:**
  1. Acasă se încarcă fără erori de consolă din aplicație;
  2. o recoltare (culegător, kg) → apare în listă;
  3. o comandă → „Pune în livrare” → livrată cu plată → stocul scade;
  4. o vânzare rapidă;
  5. o cheltuială fără bon;
  6. Tratamente → Analize: analiza din demo și raportul public deschis fără cont;
  7. pe mobil (375 px), bara de jos are 5 taburi.
- Nu se rulează în CI și nu scrie decât în demo-ul creat. La final iese din cont (`POST /api/auth/sign-out`).
- Testele trebuie să treacă local. Notezi în raport timpul de rulare.

## Verificări și raport

- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`, `npm run test:e2e:smoke`: toate trec.
- Test în browser doar într-un demo nou (verifici întâi delogarea). Notezi tenantul.
- **Migrările:** scrise, aditive, NEAPLICATE. Pentru fiecare spui dacă aplicația merge fără ea și dacă trebuie aplicată înainte sau după merge. Din baza de date doar citești (select).
- **Raport** în `docs/redesign/raport-27-mici.md`: 10 rânduri pentru Andrei, apoi ce ai schimbat, migrările cu SQL complet și ordinea lor, indexurile adăugate, ce n-ai putut testa, verificările, hash-urile commit-urilor.

## Ce NU atingi

Asociația, magazinul (în afară de verificarea de la A4), chatul AI, `/start`, Login, Admin, logica de bani, variabilele din Vercel, `public/sw.js`, cronurile (nu le apelezi).

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
