# Prompt 22 — Rulare de noapte: corecturi adunate

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport. Branch nou din `main` (`32c0522`): `redesign/corecturi-noapte`. Commit-uri mici, push după fiecare bucată. Fără merge.

Context: `CLAUDE.md`, `docs/redesign/tokens.md`, rapoartele `docs/redesign/raport-*.md` (mai ales 15–21). Modulele refăcute respectă regulile kitului (`npm run check:kit`).

## 1. Idempotență (`client_sync_id`) unde lipsește

Regula din `CLAUDE.md`: crearea trimite `client_sync_id`; un duplicat (409 / `23505`) e succes. Cheia vine din `form.clientSyncId` (`useStepForm`): aceeași la reîncercare, alta la deschiderea următoare.

**a) Ajustările de stoc** (`src/components/stocuri/AjustareStocForm.tsx`, `src/lib/supabase/queries/ajustari-stoc.ts`, RPC `create_ajustare_stoc`).
- Migrare nouă, aditivă, `supabase/migrations/<timestamp>_ajustari_stoc_client_sync_id.sql`:
  - coloana `ajustari_stoc.client_sync_id uuid` (nullable);
  - index unic parțial pe `(tenant_id, client_sync_id) where client_sync_id is not null`;
  - `create_ajustare_stoc` primește un parametru nou, opțional, `p_client_sync_id uuid default null`. Dacă există deja o ajustare cu aceeași cheie în tenant, întoarce rândul existent, fără o a doua mișcare în `miscari_stoc`. Păstrează toate verificările de acum (tenant, drepturi, `SECURITY DEFINER`, `search_path`). Citește întâi definiția din producție (`pg_get_functiondef`, doar select) și pornește de la ea.
  - Dacă semnătura se schimbă, șterge vechea variantă în aceeași migrare (`drop function ... (vechii parametri)`), ca să nu rămână două overload-uri; refaci `grant execute` pentru `authenticated` și `revoke ... from public, anon`.
- Aplicația trimite cheia. Actualizează `src/types/supabase.ts` manual pentru coloană și parametru.

**b) Vânzarea rapidă** (`src/components/vanzari/VanzareRapidaForm.tsx`, `saveVanzareRapida`). Acum se ferește de dublură doar în memorie (`pendingComandaId`). Trimite `form.clientSyncId` ca `client_sync_id` la comanda „La poartă” și la vânzare (coloanele există din promptul 17; verifică). La un `23505`, recuperează rândul existent după cheie și continuă (de ex. marcarea ca livrată), fără să creeze altul.

**c) „Comandă din mesaj”** (`src/app/(dashboard)/comenzi/ComenziDinMesajSheet.tsx`). `createComanda` pleacă fără cheie. Fiecare comandă propusă primește o cheie stabilă cât e deschisă foaia (și la reîncercare); o comandă deja salvată nu se mai creează a doua oară. Clientul nou creat din mesaj tot cu cheie (`clienti.client_sync_id` există).

Test unitar pentru fiecare: aceeași cheie de două ori → un singur rând.

## 2. Stocul se reîmprospătează peste tot

Bug: după o acțiune din chatul AI, stocul din `/stocuri` rămâne vechi. `AiBottomSheet.tsx` invalidează `stocGlobal`, dar Stocuri citește `stocGlobalCal1` și `ajustariStoc`; nici `comenziStockSummaryAzi` nu e atins.

- Fă un singur helper, de ex. `invalidateStock(queryClient)` în `src/lib/query-keys.ts` sau lângă el. Acoperă toate cheile care depind de stoc: `stocGlobal`, `stocGlobalCal1`, `ajustariStoc`, `stocuriLocatiiRoot`, `miscariStoc`, `comenziStockSummaryAzi`, `dashboard`, plus ce mai găsești.
- Caută toate locurile care schimbă stocul (recoltare creată/editată/ștearsă, livrare, comandă livrată/anulată, vânzare rapidă, ajustare, chatul AI, „Livrează și copiază”, coada offline din `syncEngine` după sincronizare) și folosește helper-ul.
- Test unitar: helper-ul invalidează lista completă.

## 3. Acasă mai rapidă

Acum Acasă face ~70 de cereri Supabase la încărcare; datele apar în ~4 s. Ținta: **cel mult 25 de cereri** și datele în **sub 2 s** pe un cont demo, pe mobil.

- Măsoară întâi (browserul din aplicație, cont demo nou, `performance.getEntriesByType('resource')` filtrat pe `supabase.co`). Notează în raport numărul înainte și după, pe tipuri de cereri.
- Cauze probabile: aceeași interogare cerută de mai multe carduri cu chei diferite; `getTenantId` repetat la fiecare query; cereri în cascadă (una așteaptă după alta); date de tot sezonul unde ajunge un agregat.
- Ordinea soluțiilor: (1) chei comune în React Query și date partajate între carduri; (2) tenantul rezolvat o dată (cache în modul, invalidat la schimbarea sesiunii); (3) cereri paralele, nu în cascadă; (4) abia la urmă un RPC agregat nou, într-o migrare aditivă separată (`SECURITY DEFINER`, filtrat pe `current_tenant_id()`, `revoke ... from public, anon`).
- Nu schimbi ce arată Acasă, doar cum se încarcă. Verifică pe ecran că cifrele sunt aceleași înainte și după.

## 4. Măturat resturile

- Recitește rapoartele 15–21 și listează ce au notat ca „n-am putut” / „rămâne” / „de verificat”. Repară ce e mic, sigur și nu cere o decizie a lui Andrei. Restul îl treci în raport, cu o recomandare pe scurt.
- Verifică ecranul de succes după „Salvează fără bon” (Cheltuieli și Investiții): trebuie să spună „fără bon”. Pare deja făcut; confirmă și treci mai departe.
- **Nu atinge:** istoricul de etape al culturilor din solar (așteaptă decizie), Asociația, Material săditor, desktopul, `/start`, Login, Admin.

## 5. Verificări și raport

- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`: toate trec.
- Test în producție, **doar într-un cont demo nou**: o ajustare de stoc salvată de două ori (de ex. dublu-click sau reîncercare după oprirea rețelei) → un singur rând; o vânzare rapidă reîncercată → o singură comandă; Stocuri se actualizează după o recoltare din chatul AI. Migrările nu sunt aplicate în producție, deci ce depinde de ele notezi ca „netestat până la aplicarea migrării”.
- Raport în `docs/redesign/raport-22-corecturi-noapte.md`: ce ai schimbat, migrările cu SQL complet și ordinea lor, dacă aplicația merge sau nu fără migrare (ca să știu dacă le aplic înainte de merge), numărul de cereri pe Acasă înainte/după, lista resturilor rămase, verificările, hash-urile commit-urilor.
- Nu comiți `public/sw.js`. Nu apelezi cronuri. Migrările le scrii, nu le aplici. Din baza de date doar citești (select).

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
