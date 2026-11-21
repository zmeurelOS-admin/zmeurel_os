# Prompt 24 — Rulare lungă de noapte: securitate, drepturi, kit, viteză, curățenie

Lucrezi singur toată noaptea, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport. Ce cere o decizie a lui Andrei nu se implementează: îl treci în raport, cu o recomandare.

**Branch:** `redesign/noapte-24`.
- Dacă `main` conține commit-ul `1732880` (promptul 23), pornești din `main`.
- Altfel pornești din `origin/redesign/operator-din-link`.

Commit-uri mici, push după fiecare bucată. Fără merge.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, rapoartele `docs/redesign/raport-*.md` (mai ales 21, 22, 23).

**Ordinea contează.** Dacă noaptea nu ajunge, se termină întâi partea 1.

---

## 1. Audit de securitate: rutele server care folosesc service role

Promptul 23 a găsit o capcană gravă: „Șterge contul” cerut de un operator ar fi șters ferma proprietarului. La fel la golirea și la redenumirea fermei. Același tip de greșeală poate exista și în alte locuri.

- Listează **toate** locurile care folosesc `getSupabaseAdmin()` / `createServiceRoleClient()`: `src/app/api/**`, acțiunile server, `src/lib/**` chemat din ele. Pentru fiecare verifici:
  1. cine poate chema ruta: anonim, orice utilizator logat, proprietar, operator, livrator (token), cron (secret), superadmin;
  2. dacă tenantul pe care se scrie sau se citește vine din sesiune (verificat pe server), nu din corpul cererii, din query sau din antet;
  3. dacă un operator, un operator dezactivat, un livrator sau un operator ascuns (`@operator.zmeurel.local`) poate face o acțiune de proprietar;
  4. dacă rutele de cron cer secretul și nu fac nimic fără el.
- Tabel în raport: ruta → cine are voie → verificarea găsită → OK / reparat / de hotărât.
- **Repari** orice rută unde un ne-proprietar poate face o acțiune de proprietar sau unde tenantul vine de la client. Folosești helper-ele existente (`getFarmOwnerContext`, `owner-auth.ts`) sau unul nou, comun. Fiecare reparație primește un test unitar (cererea unui operator → 403).
- **Funcțiile SQL `SECURITY DEFINER`** (doar citire, `pg_proc` + `pg_get_functiondef`): fiecare verifică `auth.uid()` / `current_tenant_id()` și drepturile? E revocată pentru `anon` și `public`? Ce lipsește reparai într-o migrare aditivă (`create or replace` cu același corp + verificarea), scrisă, neaplicată.

## 2. RLS pentru operatori: drepturile pe module chiar contează la citire?

Raportul 23: operatorul fără modulul Clienți poate citi `clienti` prin API. Poate e intenționat (Comenzi arată numele clientului), poate nu.

- Pentru fiecare tabel cu `tenant_id`, citește politicile (`pg_policies`, doar select). Fă un tabel: tabel → citire (ce verifică) → scriere (ce verifică) → modulul din aplicație care îl folosește.
- Marchează unde un operator poate **scrie** fără dreptul „Scrie” pe modulul acelui tabel. Acestea sunt de reparat: migrare aditivă, cu politici înlocuite, scrisă și NEAPLICATĂ, plus testul RLS din `src/tests/rls/` dacă există infrastructura.
- **Citirea** fără drept pe modul (de ex. `clienti`, `produse`, `parcele` citite din Comenzi sau Recoltări) **nu o schimbi.** O treci în raport cu ce ar strica o restrângere și cu recomandarea ta. E decizia lui Andrei.
- Verifică și livratorul (token, fără cont): ce rute și ce date atinge; nimic în afară de Livrările zilei lui.

## 3. Kitul pe modulele refăcute

- Verifică ce foldere ale modulelor refăcute lipsesc din `KIT_RULE_DIRS` (`scripts/kit-rules.mjs`): Tratamente, Stocuri, Produse, Rapoarte, Parcele, Lucrări, Echipa, Actele fermei, Cheltuieli, Investiții, Vânzări, Mai mult, Notificări, Setări, `/invite`, `/acces-oprit` și ce mai găsești refăcut în 13–23.
- Adaugă-le pe listă și repară abaterile până când `npm run check:kit` trece. **Nu schimbi aspectul;** înlocuiești doar tokenii vechi cu cei canonici, textele sub 13 px, z-index numeric și ce e evident echivalent. Dacă o reparație ar schimba vizibil ecranul, lași fișierul în `KIT_RULE_PENDING_FILES` și notezi.
- ARIA: butoane doar-iconiță fără etichetă, comutatoare fără `role="switch"` / `aria-checked`, tab-uri fără `tablist`. Repari în modulele refăcute.

## 4. Viteză pe paginile principale (ca la Acasă în 22)

- Măsoară numărul de cereri Supabase și timpul până la date pe: Comenzi, Livrări, Recoltări, Stocuri, Tratamente, Parcele, Lucrări, Rapoarte, Clienți. Cont demo nou, build de producție local, mobil.
- Pagina cu peste 15 cereri primește același tratament ca Acasă: chei React Query comune, fără cereri în cascadă, fără date de tot sezonul unde ajunge un agregat. Un RPC nou doar la nevoie, în migrare aditivă separată, neaplicată.
- Nu schimbi ce arată paginile. Tabel înainte/după în raport.

## 5. Desktopul „să funcționeze”

Andrei vrea desktopul doar funcțional, nerefăcut. La 1280 px și 1024 px treci prin toate modulele refăcute. Repari doar ce e **stricat**:
- conținut tăiat sau suprapus;
- foi (`BottomSheet`, `StepForm`) care nu se pot închide sau trec sub bara laterală;
- butoane imposibil de apăsat;
- tabele care ies din ecran fără scroll.

Nu redesenezi nimic. Screenshot-urile înainte/după le pui în `docs/redesign/screenshots/24/`, doar pentru ce ai reparat.

## 6. Curățenie

- Cod mort apărut după 17–23: componente, hook-uri, query-uri, rute și chei din `query-keys.ts` nefolosite (`npx knip` sau `ts-prune`, plus `git grep`). Ștergi doar ce e sigur nefolosit (fără import, fără rută, fără referință din teste e2e). Restul îl listezi.
- Fișiere vechi ale modulelor refăcute rămase lângă cele noi: le ștergi dacă nu le mai importă nimic.
- Dependențe din `package.json` nefolosite: le listezi, nu le scoți.
- Avertismentele de lint (9 vechi): repari ce e mecanic.

## 7. Resturile rămase

- Din `raport-22-corecturi-noapte.md` §4 și `raport-23-operator-din-link.md` §6: repari ce e mic, sigur și nu cere decizie. Restul îl listezi.
- **Bannerul cu actele lipsă:** scrie un test unitar pentru logica din layout (`stareActe` → text banner → randat sau nu), ca să fie acoperit fără demo.
- Triggerul `on_auth_user_created` face o fermă pentru orice utilizator nou, inclusiv pentru operatorii ascunși (aplicația o închide după). Nu-l schimbi. Descrie în raport ce s-ar face și cu ce risc.

## Ce NU atingi

- Asociația (Gustă din Bucovina), chatul AI, Material săditor, `/start`, Login, Admin, magazinul `comanda.zmeurel.ro`.
- Redesignul desktopului.
- Aspectul modulelor refăcute.
- Logica de bani (venit, plăți, sezon).
- Variabilele de mediu din Vercel, cronurile (nu le apelezi), `public/sw.js` (nu-l comiți), `.claude/settings.json`.

## Verificări și raport

- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`: toate trec pe codul final.
- **Teste în browser:** doar într-un cont demo nou; notezi tenantul în raport. Nu folosi un tab deja logat într-un demo vechi (verifică întâi cu leave-demo / sign-out). Operatori ascunși doar legați de demo-ul nou, iar la final îi dezactivezi.
- Migrările le scrii în `supabase/migrations/`, aditive, și NU le aplici. Pentru fiecare spui dacă aplicația merge fără ea. Din baza de date doar citești (select).
- **Raport** în `docs/redesign/raport-24-noapte.md`. Începe cu un rezumat de 10 rânduri pentru Andrei: ce era periculos și s-a reparat, ce trebuie hotărât. Apoi:
  1. tabelul rutelor (partea 1);
  2. tabelul RLS (partea 2);
  3. modulele intrate în kit;
  4. tabelul de viteză;
  5. desktopul;
  6. ce s-a șters;
  7. resturile;
  8. migrările cu SQL complet și ordinea lor;
  9. ce n-ai putut testa;
  10. verificările;
  11. hash-urile commit-urilor.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
